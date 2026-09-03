import logging
from datetime import datetime, timedelta, timezone as dt_timezone

from django.db import transaction
from django.utils import timezone

from .models import DomainInfo

logger = logging.getLogger(__name__)


def _parse_date(date_value):
    """Parse a WHOIS date value into a timezone-aware datetime.

    WHOIS dates can be a single datetime, a list of datetimes, or a string.
    Returns the most recent/valid date if a list is provided.
    """
    if not date_value:
        return None

    if isinstance(date_value, list):
        date_value = date_value[0]

    if isinstance(date_value, datetime):
        if date_value.tzinfo is None:
            date_value = date_value.replace(tzinfo=dt_timezone.utc)
        return date_value

    return None


class DomainService:
    """Service for domain WHOIS monitoring.

    Handles CRUD operations for domain info, deep WHOIS scanning,
    anti-hijacking lock detection, expiration timeline tracking, and bulk operations.
    All business logic lives here, not in views.
    """

    @staticmethod
    def perform_whois_query(domain):
        """Performs a live WHOIS query, extracts registrar, dates, EPP status, and nameservers."""
        clean_domain = domain.strip().replace("https://", "").replace("http://", "").split("/")[0].split(":")[0].lower()

        try:
            import whois

            w = whois.whois(clean_domain)

            registrar = w.registrar or ""

            # Normalize status to list of strings
            raw_status = w.status or []
            if isinstance(raw_status, str):
                status_list = [s.strip() for s in raw_status.split(",") if s.strip()]
            elif isinstance(raw_status, list):
                status_list = [str(s).strip() for s in raw_status if str(s).strip()]
            else:
                status_list = []

            # Determine if domain has Transfer Lock / EPP protection
            status_lower = " ".join(status_list).lower()
            is_locked = (
                "transferprohibited" in status_lower
                or "locked" in status_lower
                or "clienttransferprohibited" in status_lower
                or "servertransferprohibited" in status_lower
            )

            # Normalize nameservers
            raw_ns = w.name_servers or []
            if isinstance(raw_ns, str):
                ns_list = [n.strip().lower() for n in raw_ns.split() if n.strip()]
            elif isinstance(raw_ns, list):
                ns_list = [str(n).strip().lower() for n in raw_ns if str(n).strip()]
            else:
                ns_list = []

            creation_date = _parse_date(w.creation_date)
            expiration_date = _parse_date(w.expiration_date)
            last_updated = _parse_date(w.updated_date)

            now = datetime.now(dt_timezone.utc)
            days_until_expiration = None
            life_percentage = 0.0

            if expiration_date:
                days_until_expiration = (expiration_date - now).days

                if creation_date:
                    total_sec = max((expiration_date - creation_date).total_seconds(), 1)
                    elapsed_sec = max((now - creation_date).total_seconds(), 0)
                    life_percentage = round(min(max(elapsed_sec / total_sec * 100, 0), 100), 1)

            country = str(w.country or "")
            whois_server = str(getattr(w, "whois_server", "") or "")
            dnssec = str(getattr(w, "dnssec", "") or "")

            return {
                "success": True,
                "domain": clean_domain,
                "registrar": str(registrar),
                "creation_date": creation_date,
                "expiration_date": expiration_date,
                "last_updated": last_updated,
                "days_until_expiration": days_until_expiration,
                "life_percentage": life_percentage,
                "is_locked": is_locked,
                "status": status_list,
                "name_servers": ns_list,
                "registrant_country": country,
                "dnssec": dnssec,
                "whois_server": whois_server,
                "error_message": "",
            }

        except Exception as exc:
            logger.warning("Error performing WHOIS query for %s: %s", clean_domain, exc)
            return {
                "success": False,
                "domain": clean_domain,
                "registrar": "",
                "creation_date": None,
                "expiration_date": None,
                "last_updated": None,
                "days_until_expiration": None,
                "life_percentage": 0.0,
                "is_locked": False,
                "status": [],
                "name_servers": [],
                "registrant_country": "",
                "dnssec": "",
                "whois_server": "",
                "error_message": str(exc),
            }

    @staticmethod
    def test_whois(domain):
        """Live WHOIS query preview without persisting to database."""
        return DomainService.perform_whois_query(domain)

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
        clean_domain = domain.strip().replace("https://", "").replace("http://", "").split("/")[0].split(":")[0].lower()
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
        clean_domain = domain.strip().replace("https://", "").replace("http://", "").split("/")[0].split(":")[0].lower()
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
        is_locked=True,
        whois_server="",
        dnssec="",
        error_message="",
    ):
        """Update a domain info record with WHOIS scan results and security attributes."""
        domain_info = DomainInfo.objects.get(id=domain_id)
        domain_info.registrar = registrar
        domain_info.creation_date = creation_date
        domain_info.expiration_date = expiration_date
        domain_info.last_updated = last_updated
        domain_info.status = status
        domain_info.name_servers = name_servers
        domain_info.registrant_country = registrant_country
        domain_info.days_until_expiration = days_until_expiration
        domain_info.is_locked = is_locked
        domain_info.whois_server = whois_server
        domain_info.dnssec = dnssec
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

        locked_count = domains.filter(is_locked=True).count()
        unlocked_count = domains.filter(is_locked=False).count()

        return {
            "total": total,
            "active": active,
            "expiring_30d": expiring_30d,
            "expiring_15d": expiring_15d,
            "expired": expired,
            "error": error,
            "locked_count": locked_count,
            "unlocked_count": unlocked_count,
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
        clean_domain = domain.strip().replace("https://", "").replace("http://", "").split("/")[0].split(":")[0].lower()
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

    @staticmethod
    def bulk_action(organization_id, action, domain_ids):
        """Execute bulk actions (scan, delete) on selected domains."""
        domains = DomainInfo.objects.filter(
            organization_id=organization_id, id__in=domain_ids
        )
        count = domains.count()
        if action == "scan":
            from .tasks import scan_whois
            for d in domains:
                scan_whois.delay(str(d.id))
            return {"action": "scan", "processed": count, "message": f"{count} dominios encolados para consulta WHOIS."}
        elif action == "delete":
            deleted_count = domains.delete()[0]
            return {"action": "delete", "processed": deleted_count, "message": f"{deleted_count} dominios eliminados."}
        else:
            raise ValueError(f"Acción no soportada: {action}")