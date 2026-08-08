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
        """Create a new DNS record to monitor and trigger immediate resolution."""
        clean_domain = domain.strip().replace("https://", "").replace("http://", "").split("/")[0].split(":")[0]
        record, created = DNSRecord.objects.get_or_create(
            organization_id=organization_id,
            domain=clean_domain,
            record_type=record_type,
        )
        try:
            from .tasks import scan_dns_records
            scan_dns_records.delay(str(record.id))
        except Exception:
            pass
        return record

    @staticmethod
    @transaction.atomic
    def get_or_create_dns_record(organization_id, domain, record_type="A"):
        """Get or auto-create DNS record for monitoring targets."""
        clean_domain = domain.strip().replace("https://", "").replace("http://", "").split("/")[0].split(":")[0]
        if not clean_domain or clean_domain in ("localhost", "127.0.0.1", "host.docker.internal"):
            return None
        return DNSMonitorService.create_record(organization_id, clean_domain, record_type)

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
    def update_record(record_id, organization_id, domain=None, record_type=None):
        """Update domain or record_type for a DNS record."""
        record = DNSRecord.objects.get(
            id=record_id, organization_id=organization_id
        )
        if domain:
            record.domain = domain.strip().replace("https://", "").replace("http://", "").split("/")[0].split(":")[0]
        if record_type:
            record.record_type = record_type
        record.save()
        try:
            from .tasks import scan_dns_records
            scan_dns_records.delay(str(record.id))
        except Exception:
            pass
        return record

    @staticmethod
    def get_dns_stats(organization_id):
        """Returns KPI summary statistics for DNS records."""
        from datetime import timedelta
        records = DNSRecord.objects.filter(organization_id=organization_id)
        total = records.count()
        unique_domains = records.values_list("domain", flat=True).distinct().count()

        since_24h = timezone.now() - timedelta(hours=24)
        changes_24h = DNSChangeHistory.objects.filter(
            record__organization_id=organization_id,
            changed_at__gte=since_24h,
        ).count()

        unresolved = records.filter(value="").count()

        return {
            "total": total,
            "unique_domains": unique_domains,
            "changes_24h": changes_24h,
            "unresolved": unresolved,
        }

    @staticmethod
    @transaction.atomic
    def update_record_scan(record_id, new_value, ttl):
        """Update a DNS record with scan results and detect changes."""
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
        """Return change history for a DNS record."""
        record = DNSRecord.objects.get(
            id=record_id, organization_id=organization_id
        )
        return record.change_history.all()[:limit]

    @staticmethod
    def get_domains(organization_id):
        """Return unique domains being monitored for an organization."""
        return (
            DNSRecord.objects.filter(organization_id=organization_id)
            .values_list("domain", flat=True)
            .distinct()
            .order_by("domain")
        )