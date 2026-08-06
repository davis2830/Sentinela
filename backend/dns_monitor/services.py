from django.db import transaction
from django.utils import timezone

from .models import DNSChangeHistory, DNSRecord


class DNSMonitorService:
    """Service for DNS record monitoring.

    Handles CRUD operations for DNS records, scanning, and
    change detection with full audit trail.
    All business logic lives here, not in views.
    """

    @staticmethod
    def list_records(organization_id, domain=None):
        """Return all DNS records for an organization.

        Args:
            organization_id: UUID of the organization.
            domain: Optional domain filter.

        Returns:
            QuerySet of DNSRecord instances.
        """
        qs = DNSRecord.objects.filter(organization_id=organization_id)
        if domain:
            qs = qs.filter(domain=domain)
        return qs.order_by("-created_at")

    @staticmethod
    def get_record(record_id, organization_id):
        """Return a single DNS record by ID within an organization."""
        return DNSRecord.objects.get(id=record_id, organization_id=organization_id)

    @staticmethod
    @transaction.atomic
    def create_record(organization_id, domain, record_type):
        """Create a new DNS record to monitor.

        Args:
            organization_id: UUID of the organization.
            domain: Domain name to monitor.
            record_type: One of A, AAAA, MX, TXT, NS, CNAME.

        Returns:
            The created DNSRecord instance.
        """
        return DNSRecord.objects.create(
            organization_id=organization_id,
            domain=domain,
            record_type=record_type,
        )

    @staticmethod
    @transaction.atomic
    def delete_record(record_id, organization_id):
        """Delete a DNS record."""
        record = DNSRecord.objects.get(
            id=record_id, organization_id=organization_id
        )
        record.delete()

    @staticmethod
    @transaction.atomic
    def update_record_scan(record_id, new_value, ttl):
        """Update a DNS record with scan results and detect changes.

        If the value has changed since the last scan, a DNSChangeHistory
        entry is created to maintain the audit trail.

        Args:
            record_id: UUID of the DNS record.
            new_value: The resolved DNS value string.
            ttl: The TTL value from the DNS response.

        Returns:
            The updated DNSRecord instance.
        """
        record = DNSRecord.objects.get(id=record_id)
        old_value = record.value
        now = timezone.now()

        value_changed = old_value != new_value

        record.value = new_value
        record.ttl = ttl
        record.last_scanned_at = now

        if value_changed:
            record.last_change_at = now
            DNSChangeHistory.objects.create(
                record=record,
                old_value=old_value,
                new_value=new_value,
            )

        record.save()
        return record

    @staticmethod
    def get_change_history(record_id, organization_id, limit=50):
        """Return change history for a DNS record.

        Args:
            record_id: UUID of the DNS record.
            organization_id: UUID of the organization (for scoping).
            limit: Maximum number of entries to return (default 50).

        Returns:
            QuerySet of DNSChangeHistory instances.
        """
        record = DNSRecord.objects.get(
            id=record_id, organization_id=organization_id
        )
        return record.change_history.all()[:limit]

    @staticmethod
    def get_domains(organization_id):
        """Return unique domains being monitored for an organization.

        Returns:
            List of distinct domain strings.
        """
        return (
            DNSRecord.objects.filter(organization_id=organization_id)
            .values_list("domain", flat=True)
            .distinct()
            .order_by("domain")
        )