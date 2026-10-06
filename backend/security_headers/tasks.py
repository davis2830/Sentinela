import logging
from common.scan_limits import guarded_scan, enqueue_many
from common.subscriptions import eligible_organization_ids

import requests
from celery import shared_task

from .models import SecurityHeaderTarget
from .services import SecurityHeadersService
from common import safe_http

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="security_headers.scan", soft_time_limit=510, time_limit=540)
@guarded_scan('security_headers.SecurityHeaderTarget')
def scan_security_headers(self, target_id):
    """Scan security headers for a given target.

    Fetches the URL, extracts response headers, and analyzes
    them for security best practices with scoring.

    Args:
        target_id: UUID string of the SecurityHeaderTarget.
    """
    try:
        target = SecurityHeaderTarget.objects.select_related("organization").get(id=target_id)
        from common.subscriptions import monitoring_allowed
        if not monitoring_allowed(target.organization):
            return {"status": "skipped", "reason": "subscription_required"}
    except SecurityHeaderTarget.DoesNotExist:
        logger.error("Security header target %s not found.", target_id)
        return

    if not target.enabled:
        logger.info("Security header target %s is disabled, skipping.", target.name)
        return

    url = target.url
    headers = {}

    logger.info("Scanning security headers for: %s", url)

    try:
        response = safe_http.get(url, headers=headers, timeout=15)
        response_time_ms = int(response.elapsed.total_seconds() * 1000)
        raw_headers = dict(response.headers)

        analysis = SecurityHeadersService.analyze_headers(raw_headers)

        SecurityHeadersService.record_result(
            target_id=target.id,
            score=analysis["score"],
            grade=analysis["grade"],
            response_time_ms=response_time_ms,
            headers_found=analysis["headers_found"],
            headers_missing=analysis["headers_missing"],
            directives_analysis=analysis["directives_analysis"],
            info_leaks=analysis["info_leaks"],
            raw_headers=raw_headers,
            error_message="",
        )

        logger.info(
            "Security headers scan complete for %s: score=%s grade=%s latency=%sms",
            url,
            analysis["score"],
            analysis["grade"],
            response_time_ms,
        )

    except requests.exceptions.Timeout:
        SecurityHeadersService.record_result(
            target_id=target.id,
            score=0,
            grade="F",
            headers_found={},
            headers_missing=[],
            raw_headers={},
            error_message="Request timeout",
        )
    except requests.exceptions.ConnectionError as exc:
        SecurityHeadersService.record_result(
            target_id=target.id,
            score=0,
            grade="F",
            headers_found={},
            headers_missing=[],
            raw_headers={},
            error_message=f"Connection error: {exc}",
        )
    except Exception as exc:
        logger.exception("Error scanning security headers for %s: %s", url, exc)
        SecurityHeadersService.record_result(
            target_id=target.id,
            score=0,
            grade="F",
            headers_found={},
            headers_missing=[],
            raw_headers={},
            error_message=str(exc),
        )


@shared_task(name="security_headers.scan_all")
def scan_all_security_headers():
    """Scan security headers for all enabled targets.

    Runs periodically via Celery Beat.
    """
    targets = SecurityHeaderTarget.objects.filter(
        enabled=True,
        organization__status="active",
        organization_id__in=eligible_organization_ids(),
    )
    enqueue_many(targets, scan_security_headers)

    logger.info("Scheduled security header scans for %d targets.", targets.count())
