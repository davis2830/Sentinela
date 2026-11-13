"""Atomic, fail-closed scan admission; never rely on browser countdowns."""

import math
import uuid
from datetime import timedelta
from functools import wraps

from django.apps import apps
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException
from rest_framework.response import Response

from common.models import ScanLease
from common.subscriptions import require_monitoring


class ScanLimited(APIException):
    status_code = 429
    default_code = "scan_cooldown"

    def __init__(self, seconds, pending=False):
        seconds = max(1, math.ceil(seconds))
        minutes, remainder = divmod(seconds, 60)
        wait = f"{minutes} min {remainder} s" if minutes else f"{seconds} s"
        message = (
            "Ya hay una comprobación pendiente. Espera su resultado."
            if pending
            else f"Tu monitor ya fue comprobado. Podrás comprobarlo nuevamente en {wait}."
        )
        super().__init__(
            {
                "success": False,
                "message": message,
                "errors": {"code": "SCAN_PENDING" if pending else "SCAN_COOLDOWN", "retry_after_seconds": seconds},
            }
        )
        self.detail["success"] = False
        self.detail["errors"]["retry_after_seconds"] = seconds
        self.wait = seconds


def limited_response(exc):
    return Response(exc.detail, status=429, headers={"Retry-After": str(exc.wait)})


def interval_for(resource):
    floor = resource.organization.get_plan_limits()["min_check_interval_seconds"]
    return max(floor, getattr(resource, "interval", 0) or getattr(resource, "check_interval", 0) or 0)


def _lease(resource):
    key = f"{resource.organization_id}:{resource._meta.label_lower}:{resource.pk}"
    lease, _ = ScanLease.objects.get_or_create(resource_key=key, defaults={"organization_id": resource.organization_id})
    return ScanLease.objects.select_for_update().get(pk=lease.pk)


@transaction.atomic
def reserve(resource):
    resource.refresh_from_db()
    require_monitoring(resource.organization)
    if not getattr(resource, "enabled", True):
        raise ScanLimited(1, pending=True)
    lease = _lease(resource)
    now = timezone.now()
    if lease.pending_until and lease.pending_until > now:
        raise ScanLimited((lease.pending_until - now).total_seconds(), pending=True)
    last = getattr(resource, "last_checked_at", None) or getattr(resource, "last_scanned_at", None)
    due = last + timedelta(seconds=interval_for(resource)) if last else now
    if lease.next_allowed_at:
        due = max(due, lease.next_allowed_at)
    if due > now:
        raise ScanLimited((due - now).total_seconds())
    if resource.organization.beta_managed:
        from accounts.beta import consume_budget
        from django.conf import settings
        from rest_framework.exceptions import Throttled

        try:
            consume_budget("beta-global-scans", "global", settings.BETA_GLOBAL_SCANS_PER_MINUTE, 60)
            from common.models import ScanLease
            from organizations.models import Organization

            # The shared budget row serializes this check across organizations.
            pending_count = ScanLease.objects.filter(
                pending_until__gt=now, organization_id__in=Organization.objects.filter(beta_managed=True).values("pk")
            ).count()
            if pending_count >= settings.BETA_MAX_PENDING_SCANS:
                raise ScanLimited(60, pending=True)
            if not last and not lease.next_allowed_at:
                consume_budget("beta-first-scans", str(resource.organization_id), 12, 3600)
        except Throttled as exc:
            raise ScanLimited(exc.wait or 60) from None
    lease.token = uuid.uuid4()
    lease.started = False
    lease.pending_until = now + timedelta(minutes=10)
    lease.next_allowed_at = now + timedelta(seconds=interval_for(resource))
    lease.save()
    return str(lease.token)


def enqueue_scan(resource, task):
    if getattr(resource, "runner_type", None) == "agent":
        # Agent work is dispatched by its authenticated heartbeat, never by cloud.
        raise ScanLimited(1, pending=True)
    token = reserve(resource)
    from .executions import record

    record(resource, token)
    try:
        result = task.delay(str(resource.pk), scan_token=token)
        result.execution_id = token
        record(resource, token, task_id=str(result.id))
        return result
    except Exception:
        with transaction.atomic():
            lease = ScanLease.objects.select_for_update().filter(token=token).first()
            if lease and lease.started:
                # An acknowledgement can be lost after a worker starts. Preserve its state.
                record(resource, token, error_code="ADMISSION_UNCONFIRMED")
            else:
                record(resource, token, state="failed", error_code="BROKER_UNAVAILABLE", finished_at=timezone.now())
                # Invalidate unstarted admission so a late delivery cannot execute it.
                ScanLease.objects.filter(token=token, started=False).update(
                    pending_until=None, next_allowed_at=None, token=None
                )
        raise


def enqueue_many(resources, task, report=False):
    import logging

    queued = 0
    skipped = 0
    unknown = 0
    results = []
    for resource in resources:
        try:
            admitted = enqueue_scan(resource, task)
            queued += 1
            if report:
                results.append({"id": str(resource.pk), "state": "applied", "execution_id": str(admitted.execution_id)})
        except ScanLimited:
            skipped += 1
            if report:
                results.append({"id": str(resource.pk), "state": "skipped", "code": "SCAN_UNAVAILABLE"})
        except Exception:
            unknown += 1
            logging.getLogger(__name__).exception("Batch scan admission unconfirmed resource=%s", resource.pk)
            if report:
                results.append({"id": str(resource.pk), "state": "unknown", "code": "RECONCILE_REQUIRED"})
    return {
        "queued_count": queued,
        "skipped_count": skipped,
        "unknown_count": unknown,
        **(
            {"results": results, "counts": {"applied": queued, "skipped": skipped, "failed": 0, "unknown": unknown}}
            if report
            else {}
        ),
        "message": f"{queued} comprobaciones encoladas; {skipped} omitidas; {unknown} admisiones sin confirmar. No se reintentaron automáticamente.",
    }


@transaction.atomic
def start(resource, token):
    resource.refresh_from_db()
    require_monitoring(resource.organization)
    if not getattr(resource, "enabled", True):
        return False
    lease = _lease(resource)
    now = timezone.now()
    if str(lease.token) != str(token) or lease.started or not lease.pending_until or lease.pending_until <= now:
        return False
    lease.started = True
    lease.pending_until = now + timedelta(minutes=10)
    lease.next_allowed_at = max(lease.next_allowed_at or now, now + timedelta(seconds=interval_for(resource)))
    lease.save()
    return True


def finish(resource, token):
    ScanLease.objects.filter(
        resource_key=f"{resource.organization_id}:{resource._meta.label_lower}:{resource.pk}", token=token
    ).update(pending_until=None, next_allowed_at=timezone.now() + timedelta(seconds=interval_for(resource)))


@transaction.atomic
def accept_agent_result(resource):
    lease = _lease(resource)
    from monitoring.models import AgentExecution

    if AgentExecution.objects.filter(pk=lease.token, organization_id=resource.organization_id).exists():
        return False  # A protocol-v2 reservation requires its execution ID.
    if not lease.started or not lease.pending_until or lease.pending_until <= timezone.now():
        return False
    finish(resource, lease.token)
    return True


def guarded_scan(model_label):
    """Protect direct task calls and duplicates delivered by Celery as well."""

    def decorate(func):
        @wraps(func)
        def wrapper(self, resource_id, *args, **kwargs):
            model = apps.get_model(model_label)
            try:
                resource = model.objects.select_related("organization").get(pk=resource_id)
            except model.DoesNotExist:
                return {"status": "skipped", "reason": "not_found"}
            from common.subscriptions import monitoring_allowed

            if not monitoring_allowed(resource.organization):
                return {"status": "skipped", "reason": "subscription_required"}
            if getattr(resource, "runner_type", None) == "agent":
                return {"status": "skipped", "reason": "agent_required"}
            token = kwargs.pop("scan_token", None)
            try:
                token = token or reserve(resource)
                if not start(resource, token):
                    return {"status": "skipped", "reason": "duplicate_or_expired"}
            except ScanLimited:
                return {"status": "skipped", "reason": "scan_cooldown"}
            from .executions import record
            from .execution_context import current, fingerprint, ConfigurationChanged
            from .models import ScanExecution

            if getattr(resource, "runner_type", None) == "agent":
                record(resource, token, state="failed", error_code="AGENT_REQUIRED", finished_at=timezone.now())
                finish(resource, token)
                return {"status": "skipped", "reason": "agent_required"}
            receipt = ScanExecution.objects.filter(pk=token).first()
            if receipt and receipt.configuration_hash and receipt.configuration_hash != fingerprint(resource):
                record(resource, token, state="failed", error_code="CONFIGURATION_CHANGED", finished_at=timezone.now())
                finish(resource, token)
                return {"status": "skipped", "reason": "configuration_changed"}
            context = current.set((str(resource.pk), fingerprint(resource)))
            record(
                resource,
                token,
                state="running",
                started_at=timezone.now(),
                expires_at=timezone.now() + timedelta(minutes=10),
            )
            try:
                result = func(self, resource_id, *args, **kwargs)
                resource.refresh_from_db()
                from .execution_context import matches

                record(
                    resource,
                    token,
                    state="completed" if matches(resource) else "failed",
                    error_code="" if matches(resource) else "CONFIGURATION_CHANGED",
                    finished_at=timezone.now(),
                )
                return result
            except Exception as exc:
                record(
                    resource,
                    token,
                    state="failed",
                    error_code="CONFIGURATION_CHANGED" if isinstance(exc, ConfigurationChanged) else "EXECUTION_FAILED",
                    finished_at=timezone.now(),
                )
                raise
            finally:
                current.reset(context)
                finish(resource, token)

        return wrapper

    return decorate
