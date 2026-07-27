import json
import logging

import requests
from celery import shared_task
from django.utils import timezone

from .models import APICheckTarget
from .services import APICheckService

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="api_checks.run_check")
def run_api_check(self, target_id):
    """Execute an API check for a specific target.

    Validates HTTP status, response time, JSON validity,
    schema compliance, and headers.

    Args:
        target_id: UUID string of the APICheckTarget.
    """
    try:
        target = APICheckTarget.objects.get(id=target_id)
    except APICheckTarget.DoesNotExist:
        logger.error("API check target %s not found.", target_id)
        return

    if not target.enabled:
        logger.info("API check target %s is disabled, skipping.", target.name)
        return

    logger.info("Running API check: %s %s", target.method, target.url)

    try:
        start = timezone.now()
        response = requests.request(
            method=target.method,
            url=target.url,
            headers=target.request_headers or {},
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

        if json_valid and target.expected_schema:
            schema_valid = _validate_schema(response_body, target.expected_schema)

        headers_valid = _validate_headers(response_headers, target.expected_headers)

        status_ok = http_status == target.expected_status
        time_ok = elapsed <= target.expected_response_time_ms

        if not status_ok or not json_valid:
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
    except requests.exceptions.ConnectionError as exc:
        APICheckService.record_result(
            target_id=target.id,
            status="error",
            http_status=None,
            response_time_ms=None,
            json_valid=None,
            schema_valid=None,
            headers_valid=None,
            response_headers={},
            error_message=f"Connection error: {exc}",
        )
    except Exception as exc:
        logger.exception("Error checking API %s: %s", target.name, exc)
        APICheckService.record_result(
            target_id=target.id,
            status="error",
            http_status=None,
            response_time_ms=None,
            json_valid=None,
            schema_valid=None,
            headers_valid=None,
            response_headers={},
            error_message=str(exc),
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
    if not isinstance(body, dict):
        return False

    type_map = {
        "string": str,
        "integer": int,
        "float": (int, float),
        "boolean": bool,
        "list": list,
        "dict": dict,
    }

    for field, expected_type in expected_schema.items():
        if field not in body:
            return False
        python_type = type_map.get(expected_type)
        if python_type and not isinstance(body[field], python_type):
            return False

    return True


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
    """Run API checks for all enabled targets.

    Runs periodically via Celery Beat.
    """
    targets = APICheckTarget.objects.filter(enabled=True)
    for target in targets:
        run_api_check.delay(str(target.id))

    logger.info("Scheduled API checks for %d targets.", targets.count())