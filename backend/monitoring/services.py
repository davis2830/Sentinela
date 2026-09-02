from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .models import MonitoringCheck, MonitoringTarget


class MonitoringService:
    """Service for monitoring target management.

    Handles CRUD operations for targets and check retrieval.
    All business logic lives here, not in views.
    """

    @staticmethod
    def list_targets(organization_id):
        """Return all monitoring targets for an organization."""
        return MonitoringTarget.objects.filter(
            organization_id=organization_id
        ).order_by("-created_at")

    @staticmethod
    def get_target(target_id, organization_id):
        """Return a single target by ID within an organization."""
        return MonitoringTarget.objects.get(
            id=target_id, organization_id=organization_id
        )

    @staticmethod
    @transaction.atomic
    def create_target(
        organization_id,
        name,
        target_type,
        endpoint,
        interval=60,
        enabled=True,
        tags=None,
    ):
        """Create a new monitoring target.

        Args:
            organization_id: UUID of the organization.
            name: Display name for the target.
            target_type: One of HTTP, HTTPS, TCP, DNS, API, SSL.
            endpoint: URL, domain, or address to monitor.
            interval: Check interval in seconds (default 60).
            enabled: Whether checks are active (default True).
            tags: List of custom string tags.

        Returns:
            The created MonitoringTarget instance.
        """
        target = MonitoringTarget.objects.create(
            organization_id=organization_id,
            name=name,
            target_type=target_type,
            endpoint=endpoint,
            interval=interval,
            enabled=enabled,
            tags=tags or [],
        )
        # Asynchronously register in submonitors after transaction commits
        from .tasks import register_target_in_submonitors
        transaction.on_commit(lambda: register_target_in_submonitors.delay(str(target.id)))

        return target

    @staticmethod
    @transaction.atomic
    def update_target(target_id, organization_id, **fields):
        """Update an existing monitoring target."""
        target = MonitoringTarget.objects.get(
            id=target_id, organization_id=organization_id
        )
        for field, value in fields.items():
            if value is not None:
                setattr(target, field, value)
        target.save()
        return target

    @staticmethod
    @transaction.atomic
    def delete_target(target_id, organization_id):
        """Delete a monitoring target."""
        target = MonitoringTarget.objects.get(
            id=target_id, organization_id=organization_id
        )
        target.delete()

    @staticmethod
    def list_checks(target_id, organization_id, limit=100):
        """Return recent checks for a target.

        Args:
            target_id: UUID of the target.
            organization_id: UUID of the organization (for scoping).
            limit: Maximum number of checks to return (default 100).

        Returns:
            QuerySet of MonitoringCheck instances.
        """
        target = MonitoringTarget.objects.get(
            id=target_id, organization_id=organization_id
        )
        return target.checks.all()[:limit]

    @staticmethod
    @transaction.atomic
    def record_check(target_id, status, latency, details=None):
        """Record a monitoring check result and update target state.

        Called by Celery tasks after executing a check.

        Args:
            target_id: UUID of the target.
            status: Check status (up, down, slow, error).
            latency: Response time in milliseconds.
            details: Optional dict with extra check information.

        Returns:
            The created MonitoringCheck instance.
        """
        target = MonitoringTarget.objects.get(id=target_id)
        now = timezone.now()

        check = MonitoringCheck.objects.create(
            target=target,
            status=status,
            latency=latency,
            checked_at=now,
            details=details or {},
        )

        target.last_checked_at = now
        target.last_status = status
        target.last_latency = latency
        target.save(update_fields=["last_checked_at", "last_status", "last_latency"])

        return check

    @staticmethod
    def get_uptime_stats(target_id, organization_id, hours=24):
        """Calculate uptime percentage for a target over a time window.

        Args:
            target_id: UUID of the target.
            organization_id: UUID of the organization (for scoping).
            hours: Time window in hours (default 24).

        Returns:
            dict with total_checks, up_checks, uptime_percentage.
        """
        target = MonitoringTarget.objects.get(
            id=target_id, organization_id=organization_id
        )
        since = timezone.now() - timedelta(hours=hours)
        checks = target.checks.filter(checked_at__gte=since)

        total = checks.count()
        up = checks.filter(status="up").count()
        percentage = (up / total * 100) if total > 0 else 0.0

        return {
            "target_id": str(target_id),
            "hours": hours,
            "total_checks": total,
            "up_checks": up,
            "uptime_percentage": round(percentage, 2),
        }