from datetime import timedelta
import logging
import socket
from time import perf_counter
from common.scan_limits import guarded_scan, enqueue_many
from common.subscriptions import eligible_organization_ids, monitoring_allowed

from celery import shared_task
from django.utils import timezone

from .models import AgentProbe, MonitoringTarget
from .services import MonitoringService
from common import safe_http
from common.security import resolve_safe_target_endpoint

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="monitoring.run_check", soft_time_limit=510, time_limit=540)
@guarded_scan("monitoring.MonitoringTarget")
def run_monitoring_check(self, target_id):
    """Execute a monitoring check for a specific target.

    Uses DNS-pinned connections for HTTP/HTTPS/TCP and local DNS/SSL checks.
    All attempts obey the same per-resource scan cadence.

    Args:
        target_id: UUID string of the MonitoringTarget.
    """
    try:
        target = MonitoringTarget.objects.select_related("organization").get(id=target_id)

        if not monitoring_allowed(target.organization):
            return {"status": "skipped", "reason": "subscription_required"}
    except MonitoringTarget.DoesNotExist:
        logger.error("Monitoring target %s not found.", target_id)
        return

    if not target.enabled:
        logger.info("Target %s is disabled, skipping.", target.name)
        return

    if getattr(target, "runner_type", "cloud") == "agent":
        logger.info("Target %s is assigned to private agent probe, skipping cloud runner.", target.name)
        return

    logger.info("Running check for target: %s (%s)", target.name, target.target_type)

    try:
        from .runners import run_target_check
        result = run_target_check(target)
        status, latency, details = result.status, result.latency, result.details

        MonitoringService.record_check(
            target_id=target.id,
            status=status,
            latency=latency,
            details={
                **details,
                "evaluation_policy": {
                    "max_latency_ms": target.max_latency_ms,
                    "expected_status": target.expected_status,
                    "source": "cloud_execution",
                },
            },
        )
    except Exception as exc:
        logger.exception("Error checking target %s: %s", target.name, exc)
        MonitoringService.record_check(
            target_id=target.id,
            status="error",
            latency=None,
            details={
                "error": type(exc).__name__,
                "evaluation_policy": {
                    "max_latency_ms": target.max_latency_ms,
                    "expected_status": target.expected_status,
                    "source": "cloud_execution",
                },
            },
        )


def _run_http_check(target):
    """Execute the configured request through the pinned, no-redirect client."""
    from .runners import HTTPCheckRunner
    res = HTTPCheckRunner.run(target)
    return res.status, res.latency, res.details


def _run_tcp_check(target):
    """Connect only to a public IP obtained by the security resolver."""
    from .runners import TCPCheckRunner
    res = TCPCheckRunner.run(target)
    return res.status, res.latency, res.details


def _run_dns_check(target):
    """Perform a DNS resolution check."""
    from .runners import DNSCheckRunner
    res = DNSCheckRunner.run(target)
    return res.status, res.latency, res.details


def _run_ssl_check(target):
    """Perform an SSL certificate check for a monitoring target."""
    from .runners import SSLCheckRunner
    res = SSLCheckRunner.run(target)
    return res.status, res.latency, res.details


@shared_task(name="monitoring.schedule_checks")
def schedule_all_checks():
    """Schedule checks for all enabled monitoring targets.

    This task runs periodically via Celery Beat and dispatches
    individual check tasks for each enabled target.
    """
    targets = (
        MonitoringTarget.objects.filter(
            enabled=True,
            organization__status="active",
            organization_id__in=eligible_organization_ids(),
        )
        .exclude(
            runner_type="agent",
        )
        .select_related("organization")
    )
    count = 0
    now = timezone.now()
    for target in targets:
        interval = max(target.interval, target.organization.get_plan_limits()["min_check_interval_seconds"])
        if target.last_checked_at and (now - target.last_checked_at).total_seconds() < interval:
            continue
        count += enqueue_many([target], run_monitoring_check)["queued_count"]
    logger.info("Scheduled checks for %d targets.", count)


@shared_task(name="monitoring.check_all")
def check_all():
    """Alias for schedule_all_checks used by Celery Beat."""
    schedule_all_checks()


@shared_task(name="monitoring.register_target_in_submonitors")
def register_target_in_submonitors(target_id, related_modules=None, actor_id=None):
    """Asynchronously registers the target in all other relevant monitoring submodules."""
    try:
        target = MonitoringTarget.objects.get(id=target_id)
    except MonitoringTarget.DoesNotExist:
        logger.error("Target %s not found for submonitor registration.", target_id)
        return

    from common.subscriptions import monitoring_allowed
    from .discovery import coverage
    from organizations.services import QuotaService
    from organizations.models import Organization
    from ssl_monitor.models import SSLCertificate
    from ssl_monitor.services import SSLMonitorService
    from dns_monitor.models import DNSRecord
    from dns_monitor.services import DNSMonitorService
    from domain.models import DomainInfo
    from domain.services import DomainService
    from api_checks.models import APICheckTarget
    from api_checks.services import APICheckService
    from security_headers.models import SecurityHeaderTarget
    from security_headers.services import SecurityHeadersService

    if not monitoring_allowed(target.organization):
        return {"status": "skipped", "reason": "subscription_required"}
    modules, host, port, url = coverage(
        target.target_type,
        target.endpoint,
        "agent" if target.agent_probe_id else target.runner_type,
        related_modules,
    )
    org_id = target.organization_id
    handlers = {
        "ssl": (
            SSLCertificate,
            {"domain": host},
            "ssl_certificates",
            lambda: SSLMonitorService.create_certificate(org_id, host, port),
        ),
        "dns": (
            DNSRecord,
            {"domain": host, "record_type": "A"},
            "dns_records",
            lambda: DNSMonitorService.get_or_create_dns_record(org_id, host),
        ),
        "domain": (DomainInfo, {"domain": host}, "domains", lambda: DomainService.get_or_create_domain(org_id, host)),
        "api": (
            APICheckTarget,
            {"url": url},
            "api_checks",
            lambda: APICheckService.get_or_create_api_target(org_id, target.name, url, target.http_method),
        ),
        "security": (
            SecurityHeaderTarget,
            {"url": url},
            "security_headers",
            lambda: SecurityHeadersService.get_or_create_target(org_id, target.name, url),
        ),
    }
    result = {"created": [], "existing": [], "failed": {}}
    from django.db import transaction

    for module in sorted(modules):
        model, lookup, quota, create = handlers[module]
        try:
            # Serialize quota checks and creation per tenant; retries never duplicate resources.
            with transaction.atomic():
                org = Organization.objects.select_for_update().get(id=org_id)
                if not monitoring_allowed(org):
                    return {"status": "skipped", "reason": "subscription_required"}
                if actor_id is not None:
                    from accounts.models import User
                    from accounts.eligibility import require_identity
                    from common.authorization import RELATED_MODULES, effective_permissions

                    actor = (
                        User.objects.select_related("organization")
                        .filter(pk=actor_id, organization_id=org_id, is_active=True)
                        .first()
                    )
                    try:
                        if actor is None:
                            raise ValueError("Operador no disponible.")
                        require_identity(actor)
                        if RELATED_MODULES[module] + ".create" not in effective_permissions(actor):
                            raise ValueError("La autorización del operador cambió.")
                    except ValueError:
                        result["failed"][module] = "authorization_changed"
                        continue
                existing = model.objects.filter(organization_id=org_id, **lookup).first()
                if existing:
                    from .coverage import link_provisioned

                    link_provisioned(target, module, existing)
                    result["existing"].append(module)
                    continue
                QuotaService.check_quota(org, quota)
                resource = create()
                from .coverage import link_provisioned

                link_provisioned(target, module, resource)
                result["created"].append(module)
        except Exception as exc:
            result["failed"][module] = "provisioning_failed"
            logger.warning("Submonitor %s provisioning failed for target %s: %s", module, target_id, exc)
    MonitoringTarget.objects.filter(pk=target.pk, organization_id=org_id).update(
        coverage_status={"state": "completed", **result}
    )
    return result


@shared_task(name="monitoring.purge_old_checks_by_retention")
def purge_old_checks_by_retention():
    """Deprecated task alias retained for one release."""
    logger.warning("monitoring.purge_old_checks_by_retention is deprecated; use monitoring.purge_telemetry.")
    return purge_telemetry()


@shared_task(name="monitoring.check_sentinine_heartbeats")
def check_sentinine_heartbeats():
    """Watchdog task: Checks for inactive Sentinine probe agents and marks them offline.

    Runs periodically via Celery Beat (every 60s). If an AgentProbe has had no heartbeat
    for > 45 seconds and is currently marked 'online', its status transitions to 'offline'.
    Dispatches a critical operational alert notifying operators of the disconnected probe.
    """
    cutoff = timezone.now() - timedelta(seconds=45)
    stale_probes = AgentProbe.objects.filter(
        status=AgentProbe.ProbeStatus.ONLINE,
        last_heartbeat__lt=cutoff,
    )
    count = 0
    for probe in stale_probes:
        probe.status = AgentProbe.ProbeStatus.OFFLINE
        probe.save(update_fields=["status"])
        count += 1
        logger.warning(
            "Sentinine Agent '%s' (%s) marked OFFLINE (last heartbeat: %s).",
            probe.name,
            probe.id,
            probe.last_heartbeat,
        )

        try:
            from alerts.services import AlertService

            AlertService.create_alert(
                organization_id=probe.organization_id,
                rule_id=None,
                title=f"Guardián Sentinine desconectado: {probe.name}",
                message=(
                    f"El agente Sentinine '{probe.name}' en la red local ha dejado de emitir latidos (heartbeat). "
                    f"Los objetivos de infraestructura asignados a esta sonda no están siendo auditados."
                ),
                severity="critical",
                target_type="agent_probe",
                target_id=probe.id,
                metadata={
                    "probe_id": str(probe.id),
                    "probe_name": probe.name,
                    "last_heartbeat": probe.last_heartbeat.isoformat() if probe.last_heartbeat else None,
                },
            )
        except Exception as alert_exc:
            logger.debug("Could not dispatch offline alert for probe %s: %s", probe.name, alert_exc)

    return f"Checked Sentinine probes: {count} transitioned to OFFLINE."


@shared_task(name="monitoring.purge_telemetry")
def purge_telemetry():
    """Enforce tenant-aware telemetry retention in PostgreSQL."""
    from django.core.management import call_command

    logger.info("Executing tenant-aware telemetry purge task.")
    try:
        call_command("purge_telemetry")
        return "Tenant-aware telemetry purge completed."
    except Exception as exc:
        logger.error("Failed to execute telemetry purge: %s", exc)
        return f"Error during telemetry purge: {str(exc)}"


@shared_task(name="monitoring.purge_old_telemetry")
def purge_old_telemetry(days=None):
    """Deprecated Celery alias retained for one release."""
    logger.warning("monitoring.purge_old_telemetry is deprecated; use monitoring.purge_telemetry.")
    return purge_telemetry()
