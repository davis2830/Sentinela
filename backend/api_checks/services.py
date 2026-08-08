from django.db import transaction
from django.utils import timezone

from .models import APICheckResult, APICheckTarget


class APICheckService:
    """Service for API check management.

    Handles CRUD operations for API check targets and
    validation result recording.
    All business logic lives here, not in views.
    """

    @staticmethod
    def list_targets(organization_id):
        """Return all API check targets for an organization."""
        return APICheckTarget.objects.filter(
            organization_id=organization_id
        ).order_by("-created_at")

    @staticmethod
    def get_target(target_id, organization_id):
        """Return a single API check target by ID within an organization."""
        return APICheckTarget.objects.get(
            id=target_id, organization_id=organization_id
        )

    @staticmethod
    @transaction.atomic
    def create_target(
        organization_id,
        name,
        url,
        method="GET",
        expected_status=200,
        expected_response_time_ms=2000,
        expected_headers=None,
        expected_schema=None,
        request_headers=None,
        request_body=None,
        enabled=True,
    ):
        """Create a new API check target.

        Args:
            organization_id: UUID of the organization.
            name: Display name for the check.
            url: API endpoint URL.
            method: HTTP method (GET, POST, PUT, PATCH).
            expected_status: Expected HTTP status code (default 200).
            expected_response_time_ms: Max acceptable response time (default 2000).
            expected_headers: Dict of expected response headers.
            expected_schema: JSON schema to validate response body.
            request_headers: Dict of headers to send with request.
            request_body: JSON body to send with request.
            enabled: Whether checks are active (default True).

        Returns:
            The created APICheckTarget instance.
        """
        target = APICheckTarget.objects.create(
            organization_id=organization_id,
            name=name,
            url=url,
            method=method,
            expected_status=expected_status,
            expected_response_time_ms=expected_response_time_ms,
            expected_headers=expected_headers or {},
            expected_schema=expected_schema or {},
            request_headers=request_headers or {},
            request_body=request_body or {},
            enabled=enabled,
        )
        try:
            from .tasks import run_api_check
            run_api_check.delay(str(target.id))
        except Exception:
            pass
        return target

    @staticmethod
    @transaction.atomic
    def get_or_create_api_target(organization_id, name, url, method="GET"):
        """Get or auto-create API check target for monitoring targets."""
        if not url or url in ("http://localhost", "http://127.0.0.1"):
            return None
        target, created = APICheckTarget.objects.get_or_create(
            organization_id=organization_id,
            url=url,
            defaults={"name": name, "method": method},
        )
        if created:
            try:
                from .tasks import run_api_check
                run_api_check.delay(str(target.id))
            except Exception:
                pass
        return target

    @staticmethod
    @transaction.atomic
    def update_target(target_id, organization_id, **fields):
        """Update an existing API check target."""
        target = APICheckTarget.objects.get(
            id=target_id, organization_id=organization_id
        )
        for field, value in fields.items():
            if value is not None:
                setattr(target, field, value)
        target.save()
        try:
            from .tasks import run_api_check
            run_api_check.delay(str(target.id))
        except Exception:
            pass
        return target

    @staticmethod
    def get_api_check_stats(organization_id):
        """Returns KPI summary statistics for API check targets."""
        targets = APICheckTarget.objects.filter(organization_id=organization_id)
        total = targets.count()
        pass_count = targets.filter(last_status="pass").count()
        slow_count = targets.filter(last_status="slow").count()
        fail_count = targets.filter(last_status__in=["fail", "error"]).count()

        # Calculate average response time across recent results
        recent_results = APICheckResult.objects.filter(
            target__organization_id=organization_id,
            response_time_ms__isnull=False,
        ).order_by("-checked_at")[:100]

        avg_latency = 0
        if recent_results.exists():
            times = [r.response_time_ms for r in recent_results if r.response_time_ms]
            avg_latency = round(sum(times) / len(times), 1) if times else 0

        return {
            "total": total,
            "pass_count": pass_count,
            "slow_count": slow_count,
            "fail_count": fail_count,
            "avg_latency": avg_latency,
        }

    @staticmethod
    @transaction.atomic
    def delete_target(target_id, organization_id):
        """Delete an API check target."""
        target = APICheckTarget.objects.get(
            id=target_id, organization_id=organization_id
        )
        target.delete()

    @staticmethod
    def list_results(target_id, organization_id, limit=50):
        """Return recent check results for a target."""
        target = APICheckTarget.objects.get(
            id=target_id, organization_id=organization_id
        )
        return target.results.all()[:limit]

    @staticmethod
    @transaction.atomic
    def record_result(
        target_id,
        status,
        http_status,
        response_time_ms,
        json_valid,
        schema_valid,
        headers_valid,
        response_headers,
        error_message="",
    ):
        """Record an API check result and update target state.

        Called by the run_api_check Celery task after executing the check.

        Args:
            target_id: UUID of the target.
            status: Result status (pass, fail, slow, error).
            http_status: HTTP status code received.
            response_time_ms: Response time in milliseconds.
            json_valid: Whether response is valid JSON.
            schema_valid: Whether response matches expected schema.
            headers_valid: Whether response headers match expected.
            response_headers: Dict of response headers.
            error_message: Error message if check failed.

        Returns:
            The created APICheckResult instance.
        """
        target = APICheckTarget.objects.get(id=target_id)
        now = timezone.now()

        result = APICheckResult.objects.create(
            target=target,
            status=status,
            http_status=http_status,
            response_time_ms=response_time_ms,
            json_valid=json_valid,
            schema_valid=schema_valid,
            headers_valid=headers_valid,
            response_headers=response_headers or {},
            error_message=error_message,
            checked_at=now,
        )

        target.last_checked_at = now
        target.last_status = status
        target.save(update_fields=["last_checked_at", "last_status"])

        return result