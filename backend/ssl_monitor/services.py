from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .models import SSLCertificate


class SSLMonitorService:
    """Service for SSL certificate monitoring.

    Handles certificate retrieval, scanning, and expiration analysis.
    All business logic lives here, not in views.
    """

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
        return SSLCertificate.objects.get(
            domain=domain, organization_id=organization_id
        )

    @staticmethod
    @transaction.atomic
    def create_certificate(organization_id, domain):
        """Create a new SSL certificate record and trigger immediate scan."""
        clean_domain = domain.strip().replace("https://", "").replace("http://", "").split("/")[0].split(":")[0]
        cert, created = SSLCertificate.objects.get_or_create(
            organization_id=organization_id,
            domain=clean_domain,
        )
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
        clean_domain = domain.strip().replace("https://", "").replace("http://", "").split("/")[0].split(":")[0]
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
    def update_certificate_domain(certificate_id, organization_id, domain):
        """Update domain for an existing SSL certificate."""
        clean_domain = domain.strip().replace("https://", "").replace("http://", "").split("/")[0].split(":")[0]
        cert = SSLCertificate.objects.get(
            id=certificate_id, organization_id=organization_id
        )
        cert.domain = clean_domain
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