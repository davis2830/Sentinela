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
        """Create a new SSL certificate record.

        The actual certificate data will be populated by the
        scan_ssl_certificate Celery task.

        Args:
            organization_id: UUID of the organization.
            domain: Domain name to monitor.

        Returns:
            The created SSLCertificate instance.
        """
        return SSLCertificate.objects.create(
            organization_id=organization_id,
            domain=domain,
        )

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
    ):
        """Update a certificate with scan results.

        Called by the scan_ssl_certificate Celery task after
        retrieving the certificate from the domain.

        Args:
            certificate_id: UUID of the certificate.
            issuer: Certificate issuer string.
            subject: Certificate subject string.
            expiration_date: Certificate expiration datetime.
            algorithm: Signature algorithm.
            fingerprint: Certificate fingerprint.
            days_remaining: Days until expiration.
            is_valid: Whether the certificate is valid.
            error_message: Error message if scan failed.

        Returns:
            The updated SSLCertificate instance.
        """
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
        cert.save()
        return cert

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
        cert = SSLCertificate.objects.get(
            id=certificate_id, organization_id=organization_id
        )
        cert.domain = domain
        cert.save()
        return cert

    @staticmethod
    def get_expiring_soon(organization_id, days=15):
        """Return certificates expiring within the given number of days.

        Args:
            organization_id: UUID of the organization.
            days: Number of days threshold (default 15).

        Returns:
            QuerySet of SSLCertificate instances expiring soon.
        """
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