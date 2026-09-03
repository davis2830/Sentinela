import logging
from urllib.parse import urlparse, urlunparse

import requests
from celery import shared_task
from django.utils import timezone

from .models import MonitoringTarget
from .services import MonitoringService

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="monitoring.run_check")
def run_monitoring_check(self, target_id):
    """Execute a monitoring check for a specific target.

    Delegates HTTP/HTTPS/TCP checks to Blackbox Exporter and DNS/SSL checks
    to local libraries. Employs soft-retries via Celery for flapping prevention.

    Args:
        target_id: UUID string of the MonitoringTarget.
    """
    try:
        target = MonitoringTarget.objects.get(id=target_id)
    except MonitoringTarget.DoesNotExist:
        logger.error("Monitoring target %s not found.", target_id)
        return

    if not target.enabled:
        logger.info("Target %s is disabled, skipping.", target.name)
        return

    logger.info("Running check for target: %s (%s)", target.name, target.target_type)

    try:
        if target.target_type in ("http", "https", "api"):
            status, latency, details = _run_http_check(target)
        elif target.target_type == "tcp":
            status, latency, details = _run_tcp_check(target)
        elif target.target_type == "dns":
            status, latency, details = _run_dns_check(target)
        elif target.target_type == "ssl":
            status, latency, details = _run_ssl_check(target)
        else:
            logger.error("Unsupported target type: %s", target.target_type)
            return

        if status in ("down", "error"):
            if self.request.retries < 2:
                logger.info("Check failed for %s. Retrying in 5s (attempt %d/3)...", target.name, self.request.retries + 2)
                raise self.retry(countdown=5)

        MonitoringService.record_check(
            target_id=target.id,
            status=status,
            latency=latency,
            details=details,
        )
    except self.retry_class as retry_exc:
        raise retry_exc
    except Exception as exc:
        logger.exception("Error checking target %s: %s", target.name, exc)
        if self.request.retries < 2:
            logger.info("Exception during check for %s. Retrying in 5s (attempt %d/3)...", target.name, self.request.retries + 2)
            raise self.retry(countdown=5)

        MonitoringService.record_check(
            target_id=target.id,
            status="error",
            latency=None,
            details={"error": str(exc)},
        )


def _run_http_check(target):
    """Perform an HTTP/HTTPS check using Blackbox Exporter."""
    from django.conf import settings
    url = target.endpoint
    if not url.startswith("http"):
        url = f"https://{url}"

    method = (target.http_method or "GET").upper()
    module = "http_post_2xx" if method == "POST" else "http_2xx"

    blackbox_url = f"{settings.BLACKBOX_EXPORTER_URL.rstrip('/')}/probe"

    start = timezone.now()
    try:
        response = requests.get(
            url=blackbox_url,
            params={
                "target": url,
                "module": module,
            },
            timeout=10,
        )
        elapsed = (timezone.now() - start).total_seconds() * 1000

        probe_success = 0.0
        probe_duration = 0.0
        for line in response.text.splitlines():
            if line.startswith("probe_success "):
                probe_success = float(line.split()[1])
            elif line.startswith("probe_duration_seconds "):
                probe_duration = float(line.split()[1])

        latency_ms = (probe_duration * 1000) if probe_duration > 0 else elapsed

        if probe_success == 1.0:
            if latency_ms > target.max_latency_ms:
                status = "slow"
            else:
                status = "up"
        else:
            status = "down"

        return status, round(latency_ms, 2), {
            "blackbox_status": "success" if probe_success == 1.0 else "failed",
            "method": method,
            "url": url,
        }
    except Exception as exc:
        logger.exception("Blackbox HTTP probe exception: %s", exc)
        return "down", None, {"error": str(exc), "url": url}


def _run_tcp_check(target):
    """Perform a TCP connection check using Blackbox Exporter."""
    from django.conf import settings
    host_port = target.endpoint

    if host_port.startswith("localhost") or host_port.startswith("127.0.0.1"):
        host_port = host_port.replace("localhost", "host.docker.internal").replace("127.0.0.1", "host.docker.internal")

    blackbox_url = f"{settings.BLACKBOX_EXPORTER_URL.rstrip('/')}/probe"

    start = timezone.now()
    try:
        response = requests.get(
            url=blackbox_url,
            params={
                "target": host_port,
                "module": "tcp_connect",
            },
            timeout=10,
        )
        elapsed = (timezone.now() - start).total_seconds() * 1000

        probe_success = 0.0
        probe_duration = 0.0
        for line in response.text.splitlines():
            if line.startswith("probe_success "):
                probe_success = float(line.split()[1])
            elif line.startswith("probe_duration_seconds "):
                probe_duration = float(line.split()[1])

        latency_ms = (probe_duration * 1000) if probe_duration > 0 else elapsed

        if probe_success == 1.0:
            status = "up"
        else:
            status = "down"

        return status, round(latency_ms, 2), {
            "blackbox_status": "success" if probe_success == 1.0 else "failed",
            "endpoint": host_port,
        }
    except Exception as exc:
        logger.exception("Blackbox TCP probe exception: %s", exc)
        return "down", None, {"error": str(exc), "endpoint": host_port}


def _run_dns_check(target):
    """Perform a DNS resolution check."""
    import socket

    endpoint = target.endpoint.strip()
    if "://" in endpoint:
        endpoint = endpoint.split("://")[1]
    host = endpoint.split("/")[0].split(":")[0]

    start = timezone.now()
    try:
        result = socket.getaddrinfo(host, None)
        elapsed = (timezone.now() - start).total_seconds() * 1000
        addresses = list(set(r[4][0] for r in result))
        return "up", round(elapsed, 2), {"addresses": addresses, "host": host}
    except socket.gaierror as exc:
        return "down", None, {"error": str(exc), "domain": host}


def _run_ssl_check(target):
    """Perform an SSL certificate check for a monitoring target."""
    import socket
    import ssl as ssl_module
    from datetime import datetime, timezone as dt_timezone

    endpoint = target.endpoint.strip()
    if "://" in endpoint:
        endpoint = endpoint.split("://")[1]
    host = endpoint.split("/")[0].split(":")[0]

    if host in ("localhost", "127.0.0.1"):
        host = "host.docker.internal"

    start = timezone.now()
    try:
        context = ssl_module.create_default_context()
        with socket.create_connection((host, 443), timeout=10) as sock:
            with context.wrap_socket(sock, server_hostname=host) as ssock:
                cert_info = ssock.getpeercert()

        elapsed = (timezone.now() - start).total_seconds() * 1000

        issuer_info = dict(x[0] for x in cert_info.get("issuer", []))
        issuer_name = issuer_info.get("organizationName") or issuer_info.get("commonName") or "Unknown"

        not_after = cert_info.get("notAfter", "")
        expiration_date = None
        days_remaining = None
        if not_after:
            try:
                expiration_date = datetime.strptime(
                    not_after, "%b %d %H:%M:%S %Y %Z"
                ).replace(tzinfo=dt_timezone.utc)
                now = datetime.now(dt_timezone.utc)
                days_remaining = (expiration_date - now).days
            except ValueError:
                pass

        status = "up"
        if elapsed > (target.max_latency_ms or 2000):
            status = "slow"

        return status, round(elapsed, 2), {
            "host": host,
            "days_remaining": days_remaining,
            "issuer": issuer_name,
            "expiration_date": expiration_date.isoformat() if expiration_date else None,
        }
    except ssl_module.SSLError as exc:
        return "down", None, {"error": f"SSL error: {exc}", "host": host}
    except (socket.timeout, socket.gaierror, ConnectionRefusedError, OSError) as exc:
        return "down", None, {"error": f"Connection error: {exc}", "host": host}


@shared_task(name="monitoring.schedule_checks")
def schedule_all_checks():
    """Schedule checks for all enabled monitoring targets.

    This task runs periodically via Celery Beat and dispatches
    individual check tasks for each enabled target.
    """
    targets = MonitoringTarget.objects.filter(enabled=True)
    for target in targets:
        run_monitoring_check.delay(str(target.id))

    logger.info("Scheduled checks for %d targets.", targets.count())


@shared_task(name="monitoring.check_all")
def check_all():
    """Alias for schedule_all_checks used by Celery Beat."""
    schedule_all_checks()


@shared_task(name="monitoring.register_target_in_submonitors")
def register_target_in_submonitors(target_id):
    """Asynchronously registers the target in all other relevant monitoring submodules."""
    try:
        target = MonitoringTarget.objects.get(id=target_id)
    except MonitoringTarget.DoesNotExist:
        logger.error("Target %s not found for submonitor registration.", target_id)
        return

    organization_id = target.organization_id
    endpoint = target.endpoint
    name = target.name
    target_type = target.target_type

    if target_type.lower() in ("https", "ssl"):
        try:
            from ssl_monitor.services import SSLMonitorService
            SSLMonitorService.get_or_create_certificate(organization_id, endpoint)
        except Exception as exc:
            logger.warning("Failed to register target in ssl_monitor: %s", exc)

    try:
        from dns_monitor.services import DNSMonitorService
        DNSMonitorService.get_or_create_dns_record(organization_id, endpoint, record_type="A")
    except Exception as exc:
        logger.warning("Failed to register target in dns_monitor: %s", exc)

    try:
        from domain.services import DomainService
        DomainService.get_or_create_domain(organization_id, endpoint)
    except Exception as exc:
        logger.warning("Failed to register target in domain: %s", exc)

    try:
        from api_checks.services import APICheckService
        method = target.http_method or "GET"
        full_url = endpoint if endpoint.startswith("http") else f"https://{endpoint}"
        APICheckService.get_or_create_api_target(organization_id, name, full_url, method=method)
    except Exception as exc:
        logger.warning("Failed to register target in api_checks: %s", exc)

    try:
        from security_headers.services import SecurityHeadersService
        SecurityHeadersService.get_or_create_target(organization_id, name, endpoint)
    except Exception as exc:
        logger.warning("Failed to register target in security_headers: %s", exc)