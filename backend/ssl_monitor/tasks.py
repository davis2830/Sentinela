import logging
from celery import shared_task

from .models import SSLCertificate
from .services import SSLMonitorService

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="ssl_monitor.scan_certificate")
def scan_ssl_certificate(self, certificate_id):
    """Scan an SSL certificate for a given certificate record.

    Connects to the domain on configured port (default 443), retrieves the certificate,
    and extracts issuer, subject, expiration date, issued date, algorithm, and fingerprint.

    Args:
        certificate_id: UUID string of the SSLCertificate record.
    """
    try:
        cert = SSLCertificate.objects.get(id=certificate_id)
    except SSLCertificate.DoesNotExist:
        logger.error("SSL certificate %s not found.", certificate_id)
        return

    domain = cert.domain
    port = cert.port or 443
    logger.info("Scanning SSL certificate for %s:%d", domain, port)

    res = SSLMonitorService.perform_ssl_scan(domain, port=port)

    if res.get("is_valid"):
        SSLMonitorService.update_certificate_scan(
            certificate_id=cert.id,
            issuer=res.get("issuer", ""),
            subject=res.get("subject", ""),
            expiration_date=res.get("expiration_date"),
            algorithm=res.get("algorithm", "SHA-256"),
            fingerprint=res.get("fingerprint", ""),
            days_remaining=res.get("days_remaining"),
            is_valid=True,
            error_message="",
            san_domains=res.get("san_domains", []),
            tls_version=res.get("tls_version", ""),
            issued_at=res.get("issued_at"),
            security_grade=res.get("security_grade", "A"),
            port=port,
        )
        logger.info(
            "SSL scan complete for %s:%d: expires in %s days (grade %s)",
            domain,
            port,
            res.get("days_remaining"),
            res.get("security_grade"),
        )
    else:
        SSLMonitorService.update_certificate_scan(
            certificate_id=cert.id,
            issuer="",
            subject="",
            expiration_date=None,
            algorithm="",
            fingerprint="",
            days_remaining=None,
            is_valid=False,
            error_message=res.get("error_message", "Fallo de conexión SSL"),
            san_domains=[],
            tls_version="",
            issued_at=None,
            security_grade="F",
            port=port,
        )
        logger.error("SSL scan failed for %s:%d: %s", domain, port, res.get("error_message"))


@shared_task(name="ssl_monitor.scan_all")
def scan_all_certificates():
    """Scan all SSL certificates for all organizations.

    Runs periodically via Celery Beat.
    """
    certs = SSLCertificate.objects.all()
    for cert in certs:
        scan_ssl_certificate.delay(str(cert.id))

    logger.info("Scheduled SSL scans for %d certificates.", certs.count())