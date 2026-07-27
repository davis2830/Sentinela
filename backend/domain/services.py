from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .models import DomainInfo


class DomainService:
    """Service for domain WHOIS monitoring.

    Handles CRUD operations for domain info, WHOIS scanning,
    and expiration analysis.
    All business logic lives here, not in views.
    """

    @staticmethod
    def list_domains(organization_id):
        """Return all domain info records for an organization."""
        return DomainInfo.objects.filter(
            organization_id=organization_id
        ).order_by("-created_at")

    @staticmethod
    def get_domain(domain_id, organization_id):
        """Return a single domain info by ID within an organization."""
        return DomainInfo.objects.get(
            id=domain_id, organization_id=organization_id
        )

    @staticmethod
    @transaction.atomic
    def create_domain(organization_id, domain):
        """Create a new domain info record.

        The actual WHOIS data will be populated by the
        scan_whois Celery task.

        Args:
            organization_id: UUID of the organization.
            domain: Domain name to monitor.

        Returns:
            The created DomainInfo instance.
        """
        return DomainInfo.objects.create(
            organization_id=organization_id,
            domain=domain,
        )

    @staticmethod
    @transaction.atomic
    def update_domain_scan(
        domain_id,
        registrar,
        creation_date,
        expiration_date,
        last_updated,
        status,
        name_servers,
        registrant_country,
        days_until_expiration,
        error_message="",
    ):
        """Update a domain info record with WHOIS scan results.

        Called by the scan_whois Celery task after retrieving
        the WHOIS data for the domain.

        Args:
            domain_id: UUID of the DomainInfo record.
            registrar: Domain registrar name.
            creation_date: Domain creation date.
            expiration_date: Domain expiration date.
            last_updated: Last WHOIS update date.
            status: Domain status string.
            name_servers: Name servers string.
            registrant_country: Registrant country code.
            days_until_expiration: Days until expiration.
            error_message: Error message if scan failed.

        Returns:
            The updated DomainInfo instance.
        """
        domain_info = DomainInfo.objects.get(id=domain_id)
        domain_info.registrar = registrar
        domain_info.creation_date = creation_date
        domain_info.expiration_date = expiration_date
        domain_info.last_updated = last_updated
        domain_info.status = status
        domain_info.name_servers = name_servers
        domain_info.registrant_country = registrant_country
        domain_info.days_until_expiration = days_until_expiration
        domain_info.last_scanned_at = timezone.now()
        domain_info.error_message = error_message
        domain_info.save()
        return domain_info

    @staticmethod
    @transaction.atomic
    def delete_domain(domain_id, organization_id):
        """Delete a domain info record."""
        domain_info = DomainInfo.objects.get(
            id=domain_id, organization_id=organization_id
        )
        domain_info.delete()

    @staticmethod
    def get_expiring_soon(organization_id, days=30):
        """Return domains expiring within the given number of days.

        Args:
            organization_id: UUID of the organization.
            days: Number of days threshold (default 30).

        Returns:
            QuerySet of DomainInfo instances expiring soon.
        """
        threshold = timezone.now() + timedelta(days=days)
        return DomainInfo.objects.filter(
            organization_id=organization_id,
            expiration_date__lte=threshold,
        ).order_by("expiration_date")

    @staticmethod
    def get_expired(organization_id):
        """Return all expired domains for an organization."""
        return DomainInfo.objects.filter(
            organization_id=organization_id,
            expiration_date__lt=timezone.now(),
        ).order_by("expiration_date")