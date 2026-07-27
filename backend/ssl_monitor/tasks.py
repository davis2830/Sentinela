import logging
import socket
import ssl as ssl_module
from datetime import datetime, timezone as dt_timezone

from celery import shared_task

from .models import SSLCertificate
from .services import SSLMonitorService

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="ssl_monitor.scan_certificate")
def scan_ssl_certificate(self, certificate_id):
    """Scan an SSL certificate for a given certificate record.

    Connects to the domain on port 443, retrieves the certificate,
    and extracts issuer, subject, expiration date, algorithm, and fingerprint.

    Args:
        certificate_id: UUID string of the SSLCertificate record.
    """
    try:
        cert = SSLCertificate.objects.get(id=certificate_id)
    except SSLCertificate.DoesNotExist:
        logger.error("SSL certificate %s not found.", certificate_id)
        return

    domain = cert.domain
    logger.info("Scanning SSL certificate for domain: %s", domain)

    try:
        context = ssl_module.create_default_context()
        with socket.create_connection((domain, 443), timeout=10) as sock:
            with context.wrap_socket(sock, server_hostname=domain) as ssock:
                cert_der = ssock.getpeercert(binary_form=True)
                cert_info = ssock.getpeercert()

        issuer = dict(x[0] for x in cert_info.get("issuer", []))
        subject = dict(x[0] for x in cert_info.get("subject", []))

        issuer_str = ", ".join(
            f"{k}={v}" for k, v in issuer.items()
        ) if issuer else ""
        subject_str = ", ".join(
            f"{k}={v}" for k, v in subject.items()
        ) if subject else ""

        not_after = cert_info.get("notAfter", "")
        expiration_date = None
        if not_after:
            try:
                expiration_date = datetime.strptime(
                    not_after, "%b %d %H:%M:%S %Y %Z"
                ).replace(tzinfo=dt_timezone.utc)
            except ValueError:
                pass

        days_remaining = None
        if expiration_date:
            now = datetime.now(dt_timezone.utc)
            days_remaining = (expiration_date - now).days

        fingerprint = ""
        if cert_der:
            import hashlib
            fingerprint = hashlib.sha256(cert_der).hexdigest()

        algorithm = "SHA-256"

        SSLMonitorService.update_certificate_scan(
            certificate_id=cert.id,
            issuer=issuer_str,
            subject=subject_str,
            expiration_date=expiration_date,
            algorithm=algorithm,
            fingerprint=fingerprint,
            days_remaining=days_remaining,
            is_valid=True,
            error_message="",
        )

        logger.info(
            "SSL scan complete for %s: expires in %d days",
            domain,
            days_remaining or 0,
        )

    except ssl_module.SSLError as exc:
        logger.error("SSL error for %s: %s", domain, exc)
        SSLMonitorService.update_certificate_scan(
            certificate_id=cert.id,
            issuer="",
            subject="",
            expiration_date=None,
            algorithm="",
            fingerprint="",
            days_remaining=None,
            is_valid=False,
            error_message=f"SSL error: {exc}",
        )
    except socket.gaierror as exc:
        logger.error("DNS resolution error for %s: %s", domain, exc)
        SSLMonitorService.update_certificate_scan(
            certificate_id=cert.id,
            issuer="",
            subject="",
            expiration_date=None,
            algorithm="",
            fingerprint="",
            days_remaining=None,
            is_valid=False,
            error_message=f"DNS error: {exc}",
        )
    except (socket.timeout, ConnectionRefusedError, OSError) as exc:
        logger.error("Connection error for %s: %s", domain, exc)
        SSLMonitorService.update_certificate_scan(
            certificate_id=cert.id,
            issuer="",
            subject="",
            expiration_date=None,
            algorithm="",
            fingerprint="",
            days_remaining=None,
            is_valid=False,
            error_message=f"Connection error: {exc}",
        )


@shared_task(name="ssl_monitor.scan_all")
def scan_all_certificates():
    """Scan all SSL certificates for all organizations.

    Runs periodically via Celery Beat.
    """
    certs = SSLCertificate.objects.all()
    for cert in certs:
        scan_ssl_certificate.delay(str(cert.id))

    logger.info("Scheduled SSL scans for %d certificates.", certs.count())