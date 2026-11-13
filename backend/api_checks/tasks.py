import json
import logging
from common.scan_limits import guarded_scan, enqueue_many
from common.subscriptions import eligible_organization_ids

import requests
from celery import shared_task
from django.utils import timezone

from .models import APICheckTarget
from .services import APICheckService
from .schema import differences
from common import safe_http

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="api_checks.run_check", soft_time_limit=510, time_limit=540)
@guarded_scan("api_checks.APICheckTarget")
def run_api_check(self, target_id):
    """Execute an API check for a specific target.

    Validates HTTP status, response time, JSON validity,
    schema compliance, and headers.

    Args:
        target_id: UUID string of the APICheckTarget.
    """
    try:
        target = APICheckTarget.objects.select_related("organization").get(id=target_id)
        from common.subscriptions import monitoring_allowed

        if not monitoring_allowed(target.organization):
            return {"status": "skipped", "reason": "subscription_required"}
    except APICheckTarget.DoesNotExist:
        logger.error("API check target %s not found.", target_id)
        return

    if not target.enabled:
        logger.info("API check target %s is disabled, skipping.", target.name)
        return

    logger.info("Running API check method=%s target=%s", target.method, target.pk)

    try:
        target_url = target.url
        headers = dict(target.request_headers or {})

        start = timezone.now()
        response = safe_http.request(
            method=target.method,
            url=target_url,
            headers=headers,
            json=target.request_body or None,
            timeout=15,
        )
        elapsed = (timezone.now() - start).total_seconds() * 1000

        http_status = response.status_code
        response_headers = dict(response.headers)

        json_valid = False
        schema_valid = None
        response_body = None

        try:
            response_body = response.json()
            json_valid = True
        except (json.JSONDecodeError, ValueError):
            json_valid = False

        schema_failures = differences(response_body, target.expected_schema) if target.expected_schema else []
        if target.expected_schema:
            schema_valid = json_valid and not schema_failures

        headers_valid = _validate_headers(response_headers, target.expected_headers)

        status_ok = http_status == target.expected_status
        time_ok = elapsed <= target.expected_response_time_ms
        schema_ok = schema_valid is None or schema_valid is True

        if not status_ok or not schema_ok or not headers_valid:
            result_status = "fail"
        elif not time_ok:
            result_status = "slow"
        else:
            result_status = "pass"

        APICheckService.record_result(
            target_id=target.id,
            status=result_status,
            http_status=http_status,
            response_time_ms=round(elapsed, 2),
            json_valid=json_valid,
            schema_valid=schema_valid,
            headers_valid=headers_valid,
            response_headers=response_headers,
            error_message="",
            schema_failures=schema_failures,
        )

        logger.info(
            "API check complete for %s: %s (HTTP %d, %.0fms)",
            target.name,
            result_status,
            http_status,
            elapsed,
        )

    except requests.exceptions.Timeout:
        APICheckService.record_result(
            target_id=target.id,
            status="error",
            http_status=None,
            response_time_ms=None,
            json_valid=None,
            schema_valid=None,
            headers_valid=None,
            response_headers={},
            error_message="Request timeout",
        )
    except requests.exceptions.ConnectionError:
        APICheckService.record_result(
            target_id=target.id,
            status="error",
            http_status=None,
            response_time_ms=None,
            json_valid=None,
            schema_valid=None,
            headers_valid=None,
            response_headers={},
            error_message="No se pudo conectar con el endpoint.",
        )
    except Exception as exc:
        logger.error("Error checking API target=%s category=%s", target.pk, type(exc).__name__)
        APICheckService.record_result(
            target_id=target.id,
            status="error",
            http_status=None,
            response_time_ms=None,
            json_valid=None,
            schema_valid=None,
            headers_valid=None,
            response_headers={},
            error_message="No se pudo completar la medición del endpoint.",
        )


def _validate_schema(body, expected_schema):
    """Basic schema validation.

    Checks that all keys in expected_schema exist in the response body
    and have the expected type.

    Args:
        body: The parsed JSON response body.
        expected_schema: Dict mapping field names to expected type strings.

    Returns:
        bool: True if all fields match, False otherwise.
    """
    return not differences(body, expected_schema)


def _validate_headers(response_headers, expected_headers):
    """Validate that expected headers are present in the response.

    Args:
        response_headers: Dict of actual response headers.
        expected_headers: Dict of expected header name -> value.

    Returns:
        bool: True if all expected headers match, False otherwise.
    """
    if not expected_headers:
        return True

    lower_response = {k.lower(): v for k, v in response_headers.items()}

    for header, expected_value in expected_headers.items():
        actual = lower_response.get(header.lower())
        if actual is None:
            return False
        if expected_value and str(expected_value).lower() not in str(actual).lower():
            return False

    return True


@shared_task(name="api_checks.run_all")
def run_all_api_checks():
    """Run API checks for all enabled targets whose check interval has elapsed.

    Runs periodically via Celery Beat every 30 seconds.
    """
    now = timezone.now()
    targets = APICheckTarget.objects.filter(
        enabled=True,
        organization__status="active",
        organization_id__in=eligible_organization_ids(),
    ).select_related("organization")
    count = 0
    for target in targets:
        if not target.last_checked_at:
            count += enqueue_many([target], run_api_check)["queued_count"]
        else:
            elapsed_sec = (now - target.last_checked_at).total_seconds()
            interval = max(
                target.check_interval or 300, target.organization.get_plan_limits()["min_check_interval_seconds"]
            )
            if elapsed_sec >= interval:
                count += enqueue_many([target], run_api_check)["queued_count"]

    logger.info("Scheduled periodic API checks for %d targets (total active: %d).", count, targets.count())
