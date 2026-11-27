import json
import logging
import re
from common.scan_limits import guarded_scan, enqueue_many
from common.security import SSRFSecurityException
from common.subscriptions import eligible_organization_ids

import requests
from celery import shared_task
from django.utils import timezone

from .models import APICheckTarget
from .services import APICheckService
from .schema import differences
from common import safe_http

logger = logging.getLogger(__name__)

_SENSITIVE_KEY_RE = re.compile(
    r"(authorization|cookie|token|secret|password|passwd|api[_-]?key|access[_-]?key|private[_-]?key|session|jwt|bearer|credential)",
    re.IGNORECASE,
)
_JWT_RE = re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b")
_BEARER_RE = re.compile(r"(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}", re.IGNORECASE)
_KV_SECRET_RE = re.compile(
    r'("?(?:token|access_token|refresh_token|password|secret|api_key|authorization)"?\s*[:=]\s*"?)([^",\s&}]+)',
    re.IGNORECASE,
)
MAX_PREVIEW_CHARS = 2048


def _redact_string(text: str) -> str:
    masked = _JWT_RE.sub("<JWT_REDACTADO>", text)
    masked = _BEARER_RE.sub(r"\1<REDACTADO>", masked)
    masked = _KV_SECRET_RE.sub(r"\1<REDACTADO>", masked)
    return masked


def _redact_json_value(value, depth=0):
    if depth > 6:
        return "..."
    if isinstance(value, dict):
        sanitized = {}
        for k, v in value.items():
            if _SENSITIVE_KEY_RE.search(str(k)):
                sanitized[k] = "<REDACTADO>"
            else:
                sanitized[k] = _redact_json_value(v, depth + 1)
        return sanitized
    if isinstance(value, list):
        return [_redact_json_value(item, depth + 1) for item in value[:25]]
    if isinstance(value, str):
        return _redact_string(value)
    return value


def _build_redacted_preview(response, response_body) -> str:
    """Build a ~2 KB redacted response preview for failed/degraded executions."""
    try:
        if response_body is not None:
            sanitized = _redact_json_value(response_body)
            raw = json.dumps(sanitized, ensure_ascii=False, indent=2)
        else:
            raw = _redact_string(response.text[: MAX_PREVIEW_CHARS * 2])
    except Exception:
        return ""
    if len(raw) > MAX_PREVIEW_CHARS:
        return raw[:MAX_PREVIEW_CHARS] + "\n… (truncado a 2 KB)"
    return raw


@shared_task(bind=True, name="api_checks.run_check", soft_time_limit=510, time_limit=540)
@guarded_scan("api_checks.APICheckTarget")
def run_api_check(self, target_id):
    """Execute an API check for a specific target.

    Validates HTTP status, response time, JSON validity,
    schema compliance, headers, and rate-limit (429) responses.
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

        error_message = ""
        if http_status == 429 and target.expected_status != 429:
            result_status = "rate_limited"
            error_message = "Límite de velocidad del servidor (HTTP 429)"
        elif not status_ok or not schema_ok or not headers_valid:
            result_status = "fail"
        elif not time_ok:
            result_status = "slow"
        else:
            result_status = "pass"

        response_preview = (
            _build_redacted_preview(response, response_body) if result_status != "pass" else ""
        )

        APICheckService.record_result(
            target_id=target.id,
            status=result_status,
            http_status=http_status,
            response_time_ms=round(elapsed, 2),
            json_valid=json_valid,
            schema_valid=schema_valid,
            headers_valid=headers_valid,
            response_headers=response_headers,
            response_preview=response_preview,
            error_message=error_message,
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
            error_message="Tiempo de espera agotado",
        )
    except requests.exceptions.ConnectionError as exc:
        msg = str(exc).lower()
        reason = (
            "Host no resuelve"
            if any(k in msg for k in ("name or service not known", "nameresolutionerror", "nodename", "getaddrinfo", "failed to resolve"))
            else "No se pudo conectar con el endpoint"
        )
        APICheckService.record_result(
            target_id=target.id,
            status="error",
            http_status=None,
            response_time_ms=None,
            json_valid=None,
            schema_valid=None,
            headers_valid=None,
            response_headers={},
            error_message=reason,
        )
    except SSRFSecurityException as exc:
        msg = str(exc).lower()
        reason = (
            "Host no resuelve"
            if any(k in msg for k in ("resolver", "dns", "resolución", "getaddrinfo", "dominio"))
            else "Destino bloqueado por política de seguridad"
        )
        logger.error("Error checking API target=%s category=SSRFSecurityException", target.pk)
        APICheckService.record_result(
            target_id=target.id,
            status="error",
            http_status=None,
            response_time_ms=None,
            json_valid=None,
            schema_valid=None,
            headers_valid=None,
            response_headers={},
            error_message=reason,
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
            error_message="No se pudo completar la medición del endpoint",
        )


def _validate_schema(body, expected_schema):
    """Basic schema validation."""
    return not differences(body, expected_schema)


def _validate_headers(response_headers, expected_headers):
    """Validate that expected headers are present in the response."""
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
    """Run API checks for all enabled targets whose check interval has elapsed."""
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
