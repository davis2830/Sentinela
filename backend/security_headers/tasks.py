import logging

import requests
from celery import shared_task

from .models import SecurityHeaderTarget
from .services import SecurityHeadersService

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="security_headers.scan")
def scan_security_headers(self, target_id):
    """Scan security headers for a given target.

    Fetches the URL, extracts response headers, and analyzes
    them for security best practices with scoring.

    Args:
        target_id: UUID string of the SecurityHeaderTarget.
    """
    try:
        target = SecurityHeaderTarget.objects.get(id=target_id)
    except SecurityHeaderTarget.DoesNotExist:
        logger.error("Security header target %s not found.", target_id)
        return

    if not target.enabled:
        logger.info("Security header target %s is disabled, skipping.", target.name)
        return

    url = target.url
    headers = {}
    if "localhost:8000" in url or "127.0.0.1:8000" in url:
        url = url.replace("localhost:8000", "backend:8000").replace("127.0.0.1:8000", "backend:8000")
        headers["Host"] = "localhost"

    logger.info("Scanning security headers for: %s", url)

    try:
        response = requests.get(url, headers=headers, timeout=15, allow_redirects=True)
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
    targets = SecurityHeaderTarget.objects.filter(enabled=True)
    for target in targets:
        scan_security_headers.delay(str(target.id))

    logger.info("Scheduled security header scans for %d targets.", targets.count())