import logging
import socket
import ssl as ssl_mod
from datetime import datetime, timedelta, timezone as dt_tz
import hashlib

from django.db import transaction
from django.utils import timezone

from .models import SSLCertificate

logger = logging.getLogger(__name__)


class SSLMonitorService:
    """Service for SSL certificate monitoring.

    Handles certificate retrieval, deep TLS scanning, and expiration analysis.
    All business logic lives here, not in views.
    """

    @staticmethod
    def perform_ssl_scan(domain, port=443):
        """Connects to a host via TLS and extracts deep certificate metrics.

        Returns a dictionary with certificate parameters, validity, SANs, and security grade.
        """
        clean_domain = domain.strip().replace("https://", "").replace("http://", "").split("/")[0]
        if ":" in clean_domain:
            parts = clean_domain.split(":", 1)
            clean_domain = parts[0]
            try:
                port = int(parts[1])
            except ValueError:
                port = port or 443

        port = int(port or 443)

        try:
            context = ssl_mod.create_default_context()
            with socket.create_connection((clean_domain, port), timeout=10) as sock:
                with context.wrap_socket(sock, server_hostname=clean_domain) as ssock:
                    cert_der = ssock.getpeercert(binary_form=True)
                    cert_info = ssock.getpeercert()
                    tls_version = ssock.version() or ""
                    cipher = ssock.cipher()

            issuer_dict = dict(x[0] for x in cert_info.get("issuer", []))
            subject_dict = dict(x[0] for x in cert_info.get("subject", []))

            san_domains = []
            for entry_type, entry_value in cert_info.get("subjectAltName", []):
                if entry_type.lower() in ("dns", "uri", "ip address"):
                    if entry_value not in san_domains:
                        san_domains.append(entry_value)

            issuer_str = ", ".join(f"{k}={v}" for k, v in issuer_dict.items())
            subject_str = ", ".join(f"{k}={v}" for k, v in subject_dict.items())

            not_before = cert_info.get("notBefore", "")
            issued_at = None
            if not_before:
                try:
                    issued_at = datetime.strptime(not_before, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=dt_tz.utc)
                except ValueError:
                    pass

            not_after = cert_info.get("notAfter", "")
            expiration_date = None
            if not_after:
                try:
                    expiration_date = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=dt_tz.utc)
                except ValueError:
                    pass

            now = datetime.now(dt_tz.utc)
            days_remaining = None
            if expiration_date:
                days_remaining = (expiration_date - now).days

            # Calculate lifetime percentage consumed
            percentage_used = None
            if issued_at and expiration_date:
                total_seconds = (expiration_date - issued_at).total_seconds()
                if total_seconds > 0:
                    elapsed_seconds = (now - issued_at).total_seconds()
                    percentage_used = min(100.0, max(0.0, round((elapsed_seconds / total_seconds) * 100, 1)))

            fingerprint = hashlib.sha256(cert_der).hexdigest() if cert_der else ""
            algorithm = "SHA-256"

            # Compute Security Grade (A+, A, B, C, F)
            if not expiration_date or (days_remaining is not None and days_remaining <= 0):
                security_grade = "F"
            elif tls_version == "TLSv1.3" and (days_remaining is not None and days_remaining > 30):
                security_grade = "A+"
            elif tls_version in ("TLSv1.3", "TLSv1.2") and (days_remaining is not None and days_remaining > 15):
                security_grade = "A"
            elif days_remaining is not None and days_remaining <= 15:
                security_grade = "B"
            else:
                security_grade = "C"

            return {
                "domain": clean_domain,
                "port": port,
                "is_valid": True,
                "issuer": issuer_str,
                "subject": subject_str,
                "issued_at": issued_at,
                "expiration_date": expiration_date,
                "days_remaining": days_remaining,
                "percentage_used": percentage_used,
                "algorithm": algorithm,
                "fingerprint": fingerprint,
                "san_domains": san_domains,
                "tls_version": tls_version,
                "cipher_suite": cipher[0] if cipher else "",
                "security_grade": security_grade,
                "error_message": "",
            }

        except ssl_mod.SSLError as exc:
            logger.warning("SSL Error connecting to %s:%d: %s", clean_domain, port, exc)
            return {
                "domain": clean_domain,
                "port": port,
                "is_valid": False,
                "security_grade": "F",
                "error_message": f"Error SSL/TLS: {exc}",
            }
        except socket.gaierror as exc:
            logger.warning("DNS resolution error for %s:%d: %s", clean_domain, port, exc)
            return {
                "domain": clean_domain,
                "port": port,
                "is_valid": False,
                "security_grade": "F",
                "error_message": f"Error resolución DNS: {exc}",
            }
        except Exception as exc:
            logger.warning("Connection error for %s:%d: %s", clean_domain, port, exc)
            return {
                "domain": clean_domain,
                "port": port,
                "is_valid": False,
                "security_grade": "F",
                "error_message": f"Error de conexión: {exc}",
            }

    @staticmethod
    def test_connection(domain, port=443):
        """Test SSL connection on-the-fly for modal live check without storing."""
        return SSLMonitorService.perform_ssl_scan(domain, port=port)

    @staticmethod
    def list_certificates(organization_id):
        """Return all SSL certificates for an organization."""
        return SSLCertificate.objects.filter(
            organization_id=organization_id
        ).order_by("-created_at")

    @staticmethod
    def get_certificate(certificate_id, organization_id):
        """Return a single certificate by ID within an organization."""
        return SSLCertificate.objects.get(
            id=certificate_id, organization_id=organization_id
        )

    @staticmethod
    def get_by_domain(domain, organization_id):
        """Return a certificate by domain within an organization."""
        clean_domain = domain.strip().replace("https://", "").replace("http://", "").split("/")[0].split(":")[0]
        return SSLCertificate.objects.get(
            domain=clean_domain, organization_id=organization_id
        )

    @staticmethod
    @transaction.atomic
    def create_certificate(organization_id, domain, port=443):
        """Create a new SSL certificate record and trigger immediate scan."""
        clean_domain = domain.strip().replace("https://", "").replace("http://", "").split("/")[0]
        if ":" in clean_domain:
            parts = clean_domain.split(":", 1)
            clean_domain = parts[0]
            try:
                port = int(parts[1])
            except ValueError:
                port = port or 443

        port = int(port or 443)

        cert, created = SSLCertificate.objects.get_or_create(
            organization_id=organization_id,
            domain=clean_domain,
            defaults={"port": port},
        )
        if not created and cert.port != port:
            cert.port = port
            cert.save(update_fields=["port"])

        try:
            from .tasks import scan_ssl_certificate
            scan_ssl_certificate.delay(str(cert.id))
        except Exception:
            pass
        return cert

    @staticmethod
    @transaction.atomic
    def get_or_create_certificate(organization_id, domain):
        """Get or auto-create SSL certificate for monitoring targets."""
        clean_domain = domain.strip().replace("https://", "").replace("http://", "").split("/")[0]
        if not clean_domain or clean_domain in ("localhost", "127.0.0.1", "host.docker.internal"):
            return None
        return SSLMonitorService.create_certificate(organization_id, clean_domain)

    @staticmethod
    @transaction.atomic
    def update_certificate_scan(
        certificate_id,
        issuer,
        subject,
        expiration_date,
        algorithm,
        fingerprint,
        days_remaining,
        is_valid,
        error_message="",
        san_domains=None,
        tls_version="",
        issued_at=None,
        security_grade="A",
        port=443,
    ):
        """Update a certificate with scan results."""
        cert = SSLCertificate.objects.get(id=certificate_id)
        cert.issuer = issuer
        cert.subject = subject
        cert.expiration_date = expiration_date
        cert.algorithm = algorithm
        cert.fingerprint = fingerprint
        cert.days_remaining = days_remaining
        cert.is_valid = is_valid
        cert.last_scanned_at = timezone.now()
        cert.error_message = error_message
        cert.san_domains = san_domains or []
        cert.tls_version = tls_version
        cert.issued_at = issued_at
        cert.security_grade = security_grade
        cert.port = port
        cert.save()
        return cert

    @staticmethod
    def get_certificate_stats(organization_id):
        """Returns KPI summary statistics for SSL certificates."""
        certs = SSLCertificate.objects.filter(organization_id=organization_id)
        total = certs.count()
        valid = certs.filter(is_valid=True, days_remaining__gt=15).count()
        expiring_15d = certs.filter(is_valid=True, days_remaining__gte=0, days_remaining__lte=15).count()
        expiring_30d = certs.filter(is_valid=True, days_remaining__gte=0, days_remaining__lte=30).count()
        expired = certs.filter(is_valid=True, days_remaining__lt=0).count()
        invalid = certs.filter(is_valid=False).count()

        valid_certs = certs.filter(is_valid=True, days_remaining__isnull=False)
        total_days = sum(c.days_remaining for c in valid_certs if c.days_remaining is not None)
        avg_days = round(total_days / valid_certs.count(), 1) if valid_certs.exists() else 0

        return {
            "total": total,
            "valid": valid,
            "expiring_15d": expiring_15d,
            "expiring_30d": expiring_30d,
            "expired": expired,
            "invalid": invalid,
            "avg_days_remaining": avg_days,
        }

    @staticmethod
    @transaction.atomic
    def delete_certificate(certificate_id, organization_id):
        """Delete an SSL certificate record."""
        cert = SSLCertificate.objects.get(
            id=certificate_id, organization_id=organization_id
        )
        cert.delete()

    @staticmethod
    @transaction.atomic
    def update_certificate_domain(certificate_id, organization_id, domain, port=443):
        """Update domain for an existing SSL certificate."""
        clean_domain = domain.strip().replace("https://", "").replace("http://", "").split("/")[0]
        if ":" in clean_domain:
            parts = clean_domain.split(":", 1)
            clean_domain = parts[0]
            try:
                port = int(parts[1])
            except ValueError:
                port = port or 443

        cert = SSLCertificate.objects.get(
            id=certificate_id, organization_id=organization_id
        )
        cert.domain = clean_domain
        cert.port = port
        cert.save()
        try:
            from .tasks import scan_ssl_certificate
            scan_ssl_certificate.delay(str(cert.id))
        except Exception:
            pass
        return cert

    @staticmethod
    def get_expiring_soon(organization_id, days=15):
        """Return certificates expiring within the given number of days."""
        threshold = timezone.now() + timedelta(days=days)
        return SSLCertificate.objects.filter(
            organization_id=organization_id,
            expiration_date__lte=threshold,
            is_valid=True,
        ).order_by("expiration_date")

    @staticmethod
    def get_expired(organization_id):
        """Return all expired certificates for an organization."""
        return SSLCertificate.objects.filter(
            organization_id=organization_id,
            expiration_date__lt=timezone.now(),
            is_valid=True,
        ).order_by("expiration_date")

    @staticmethod
    def bulk_action(organization_id, action, certificate_ids):
        """Perform bulk actions (scan, delete) on selected certificates."""
        certs = SSLCertificate.objects.filter(
            organization_id=organization_id, id__in=certificate_ids
        )
        count = certs.count()
        if action == "scan":
            from .tasks import scan_ssl_certificate
            for cert in certs:
                scan_ssl_certificate.delay(str(cert.id))
            return {"action": "scan", "processed": count, "message": f"{count} certificados encolados para re-escaneo."}
        elif action == "delete":
            deleted_count = certs.delete()[0]
            return {"action": "delete", "processed": deleted_count, "message": f"{deleted_count} certificados eliminados."}
        else:
            raise ValueError(f"Acción no soportada: {action}")