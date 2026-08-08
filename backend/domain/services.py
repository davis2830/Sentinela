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
        """Create a new domain info record and trigger immediate WHOIS scan."""
        clean_domain = domain.strip().replace("https://", "").replace("http://", "").split("/")[0].split(":")[0]
        domain_info, created = DomainInfo.objects.get_or_create(
            organization_id=organization_id,
            domain=clean_domain,
        )
        try:
            from .tasks import scan_whois
            scan_whois.delay(str(domain_info.id))
        except Exception:
            pass
        return domain_info

    @staticmethod
    @transaction.atomic
    def get_or_create_domain(organization_id, domain):
        """Get or auto-create domain info for monitoring targets."""
        clean_domain = domain.strip().replace("https://", "").replace("http://", "").split("/")[0].split(":")[0]
        if not clean_domain or clean_domain in ("localhost", "127.0.0.1", "host.docker.internal"):
            return None
        return DomainService.create_domain(organization_id, clean_domain)

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
        """Update a domain info record with WHOIS scan results."""
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
    def get_domain_stats(organization_id):
        """Returns KPI summary statistics for monitored WHOIS domains."""
        domains = DomainInfo.objects.filter(organization_id=organization_id)
        total = domains.count()
        active = domains.filter(error_message="", days_until_expiration__gt=30).count()
        expiring_30d = domains.filter(error_message="", days_until_expiration__gte=0, days_until_expiration__lte=30).count()
        expiring_15d = domains.filter(error_message="", days_until_expiration__gte=0, days_until_expiration__lte=15).count()
        expired = domains.filter(error_message="", days_until_expiration__lt=0).count()
        error = domains.exclude(error_message="").count()

        return {
            "total": total,
            "active": active,
            "expiring_30d": expiring_30d,
            "expiring_15d": expiring_15d,
            "expired": expired,
            "error": error,
        }

    @staticmethod
    @transaction.atomic
    def delete_domain(domain_id, organization_id):
        """Delete a domain info record."""
        domain_info = DomainInfo.objects.get(
            id=domain_id, organization_id=organization_id
        )
        domain_info.delete()

    @staticmethod
    @transaction.atomic
    def update_domain_record(domain_id, organization_id, domain):
        """Update domain name for an existing WHOIS domain record."""
        clean_domain = domain.strip().replace("https://", "").replace("http://", "").split("/")[0].split(":")[0]
        domain_info = DomainInfo.objects.get(
            id=domain_id, organization_id=organization_id
        )
        domain_info.domain = clean_domain
        domain_info.save()
        try:
            from .tasks import scan_whois
            scan_whois.delay(str(domain_info.id))
        except Exception:
            pass
        return domain_info

    @staticmethod
    def get_expiring_soon(organization_id, days=30):
        """Return domains expiring within the given number of days."""
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