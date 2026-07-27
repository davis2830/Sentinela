import logging

import requests
from celery import shared_task
from django.utils import timezone

from .models import MonitoringTarget
from .services import MonitoringService

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="monitoring.run_check")
def run_monitoring_check(self, target_id):
    """Execute a monitoring check for a specific target.

    Delegates the actual probe to Blackbox Exporter via Prometheus
    or performs a direct HTTP/TCP check depending on target type.

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
            _run_http_check(target)
        elif target.target_type == "tcp":
            _run_tcp_check(target)
        elif target.target_type == "dns":
            _run_dns_check(target)
        elif target.target_type == "ssl":
            _run_ssl_check(target)
    except Exception as exc:
        logger.exception("Error checking target %s: %s", target.name, exc)
        MonitoringService.record_check(
            target_id=target.id,
            status="error",
            latency=None,
            details={"error": str(exc)},
        )


def _run_http_check(target):
    """Perform an HTTP/HTTPS check.

    Measures response time and checks for valid status codes.
    """
    url = target.endpoint
    if not url.startswith("http"):
        url = f"https://{url}"

    start = timezone.now()
    try:
        response = requests.get(url, timeout=10, allow_redirects=True)
        elapsed = (timezone.now() - start).total_seconds() * 1000

        if response.status_code < 400:
            if elapsed > 2000:
                status = "slow"
            else:
                status = "up"
        else:
            status = "down"

        MonitoringService.record_check(
            target_id=target.id,
            status=status,
            latency=round(elapsed, 2),
            details={
                "status_code": response.status_code,
                "url": url,
            },
        )
    except requests.exceptions.Timeout:
        MonitoringService.record_check(
            target_id=target.id,
            status="down",
            latency=None,
            details={"error": "timeout", "url": url},
        )
    except requests.exceptions.ConnectionError:
        MonitoringService.record_check(
            target_id=target.id,
            status="down",
            latency=None,
            details={"error": "connection_error", "url": url},
        )


def _run_tcp_check(target):
    """Perform a TCP connection check."""
    import socket

    parts = target.endpoint.split(":")
    host = parts[0]
    port = int(parts[1]) if len(parts) > 1 else 80

    start = timezone.now()
    try:
        sock = socket.create_connection((host, port), timeout=5)
        sock.close()
        elapsed = (timezone.now() - start).total_seconds() * 1000
        MonitoringService.record_check(
            target_id=target.id,
            status="up",
            latency=round(elapsed, 2),
            details={"host": host, "port": port},
        )
    except (socket.timeout, ConnectionRefusedError, OSError) as exc:
        MonitoringService.record_check(
            target_id=target.id,
            status="down",
            latency=None,
            details={"error": str(exc), "host": host, "port": port},
        )


def _run_dns_check(target):
    """Perform a DNS resolution check."""
    import socket

    start = timezone.now()
    try:
        result = socket.getaddrinfo(target.endpoint, None)
        elapsed = (timezone.now() - start).total_seconds() * 1000
        addresses = [r[4][0] for r in result]
        MonitoringService.record_check(
            target_id=target.id,
            status="up",
            latency=round(elapsed, 2),
            details={"addresses": addresses},
        )
    except socket.gaierror as exc:
        MonitoringService.record_check(
            target_id=target.id,
            status="down",
            latency=None,
            details={"error": str(exc), "domain": target.endpoint},
        )


def _run_ssl_check(target):
    """Perform an SSL certificate check.

    Delegates to the ssl_monitor app's task for detailed analysis.
    """
    from ssl_monitor.tasks import scan_ssl_certificate

    scan_ssl_certificate.delay(str(target.id))


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