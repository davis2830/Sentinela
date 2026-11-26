import ipaddress
import logging
from datetime import date, datetime, timedelta, timezone as dt_timezone
from urllib.parse import urlsplit

from django.db import transaction
from django.utils import timezone
from common.beta_quota import beta_creation

from .models import DomainChangeHistory, DomainInfo

logger = logging.getLogger(__name__)

MULTIPART_TLDS = {
    "co.uk",
    "org.uk",
    "com.mx",
    "org.mx",
    "gob.mx",
    "com.gt",
    "org.gt",
    "gob.gt",
    "edu.gt",
    "com.ar",
    "com.br",
    "com.co",
    "com.es",
    "com.pe",
    "com.au",
    "co.jp",
    "com.sv",
    "com.hn",
    "com.cr",
    "com.pa",
}


def extract_root_domain(host):
    """Extract the registrable apex domain from a hostname (best-effort without PSL)."""
    clean = (host or "").strip().lower().rstrip(".")
    if not clean or "." not in clean:
        return None
    try:
        ipaddress.ip_address(clean)
        return None
    except ValueError:
        pass
    parts = [p for p in clean.split(".") if p]
    if len(parts) <= 2:
        return clean
    last_two = f"{parts[-2]}.{parts[-1]}"
    if last_two in MULTIPART_TLDS and len(parts) >= 3:
        return ".".join(parts[-3:])
    return last_two


def _parse_date(date_value):
    """Parse a WHOIS date value into a timezone-aware datetime."""
    if not date_value:
        return None

    if isinstance(date_value, list):
        parsed = [value for item in date_value if (value := _parse_date(item)) is not None]
        return max(parsed) if parsed else None
    if isinstance(date_value, str):
        try:
            date_value = datetime.fromisoformat(date_value.replace("Z", "+00:00"))
        except ValueError:
            return None

    if isinstance(date_value, datetime):
        if date_value.tzinfo is None:
            date_value = date_value.replace(tzinfo=dt_timezone.utc)
        return date_value

    return None


def _parse_manual_date(value):
    """Parse YYYY-MM-DD or date object for manual_expiration_date."""
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value.strip()[:10])
        except ValueError as exc:
            raise ValueError("Fecha manual inválida. Usa formato AAAA-MM-DD.") from exc
    raise ValueError("Fecha manual inválida.")


def _normalize_ns_set(raw_ns):
    if not raw_ns:
        return set()
    if isinstance(raw_ns, (list, tuple, set)):
        items = raw_ns
    else:
        items = str(raw_ns).replace(",", "\n").splitlines()
    return {str(n).strip().lower().rstrip(".") for n in items if str(n).strip()}


def _days_from_manual_date(manual_date):
    if not manual_date:
        return None
    today = timezone.now().date()
    return (manual_date - today).days


class DomainService:
    """Service for domain WHOIS / RDAP monitoring.

    Handles CRUD operations for domain info, RDAP/WHOIS scanning,
    transfer-lock & hijacking change detection, manual expiration fallback,
    cross-module unwatched domain discovery, and bulk operations.
    """

    @staticmethod
    def perform_whois_query(domain):
        """Performs a live RDAP/WHOIS query, extracts registrar, dates, EPP status, and nameservers."""
        clean_domain = domain.strip().replace("https://", "").replace("http://", "").split("/")[0].split(":")[0].lower()

        try:
            from common.security import validate_safe_target_endpoint

            validate_safe_target_endpoint(f"https://{clean_domain}", allow_private=False)
            from .rdap import query

            try:
                return query(clean_domain)
            except Exception:
                logger.info("RDAP unavailable; using WHOIS fallback for %s", clean_domain)
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
                None
                if not status_list
                else (
                    "transferprohibited" in status_lower
                    or "transfer prohibited" in status_lower
                    or "locked" in status_lower
                    or "clienttransferprohibited" in status_lower
                    or "servertransferprohibited" in status_lower
                )
            )

            # Normalize nameservers
            raw_ns = w.name_servers or []
            if isinstance(raw_ns, str):
                ns_list = sorted({n.strip().lower().rstrip(".") for n in raw_ns.split() if n.strip()})
            elif isinstance(raw_ns, list):
                ns_list = sorted({str(n).strip().lower().rstrip(".") for n in raw_ns if str(n).strip()})
            else:
                ns_list = []

            creation_date = _parse_date(w.creation_date)
            expiration_date = _parse_date(w.expiration_date)
            last_updated = _parse_date(w.updated_date)

            now = datetime.now(dt_timezone.utc)
            days_until_expiration = None
            remaining_percentage = None

            if expiration_date:
                days_until_expiration = (expiration_date - now).days
                if creation_date:
                    total_sec = max((expiration_date - creation_date).total_seconds(), 1)
                    remaining_sec = max((expiration_date - now).total_seconds(), 0)
                    remaining_percentage = round(min(max(remaining_sec / total_sec * 100, 0), 100), 1)

            country = str(w.country or "")
            whois_server = str(getattr(w, "whois_server", "") or "")
            dnssec = str(getattr(w, "dnssec", "") or "")

            return {
                "data_source": "whois",
                "source_url": "",
                "success": True,
                "domain": clean_domain,
                "registrar": str(registrar),
                "creation_date": creation_date,
                "expiration_date": expiration_date,
                "last_updated": last_updated,
                "days_until_expiration": days_until_expiration,
                "remaining_percentage": remaining_percentage,
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
                "remaining_percentage": None,
                "is_locked": None,
                "status": [],
                "name_servers": [],
                "registrant_country": "",
                "dnssec": "",
                "whois_server": "",
                "error_message": str(exc),
            }

    @staticmethod
    def test_whois(domain):
        """Live RDAP/WHOIS query preview without persisting to database."""
        return DomainService.perform_whois_query(domain)

    @staticmethod
    def list_domains(organization_id):
        """Return all domain info records for an organization (with prefetched history & links)."""
        return (
            DomainInfo.objects.filter(organization_id=organization_id)
            .prefetch_related("change_history", "targetcoverage_set__target")
            .order_by("days_until_expiration", "domain")
        )

    @staticmethod
    def get_domain(domain_id, organization_id):
        """Return a single domain info by ID within an organization."""
        return (
            DomainInfo.objects.filter(id=domain_id, organization_id=organization_id)
            .prefetch_related("change_history", "targetcoverage_set__target")
            .get()
        )

    @staticmethod
    @transaction.atomic
    @beta_creation("domains")
    def create_domain(organization_id, domain, manual_expiration_date=None):
        """Create a new domain info record and trigger immediate RDAP/WHOIS scan."""
        clean_domain = domain.strip().replace("https://", "").replace("http://", "").split("/")[0].split(":")[0].lower()
        parsed_manual = _parse_manual_date(manual_expiration_date)
        manual_days = _days_from_manual_date(parsed_manual)
        domain_info, created = DomainInfo.objects.get_or_create(
            organization_id=organization_id,
            domain=clean_domain,
            defaults={
                "manual_expiration_date": parsed_manual,
                "days_until_expiration": manual_days,
                "data_source": "manual" if parsed_manual else "",
            },
        )
        if not created:
            if parsed_manual is not None:
                domain_info.manual_expiration_date = parsed_manual
                if not domain_info.expiration_date:
                    domain_info.days_until_expiration = manual_days
                domain_info.save(update_fields=["manual_expiration_date", "days_until_expiration", "updated_at"])
            return domain_info
        from .tasks import scan_whois
        from common.executions import initial_scan

        initial_scan(domain_info, scan_whois)
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
        is_locked=None,
        whois_server="",
        dnssec="",
        error_message="",
        data_source="",
        source_url="",
    ):
        """Update a domain info record with RDAP/WHOIS results and log registration changes."""
        domain_info = DomainInfo.objects.get(id=domain_id)
        from common.execution_context import assert_current

        assert_current(domain_info)
        now = timezone.now()

        if error_message:
            domain_info.error_message = error_message[:500]
            domain_info.last_scanned_at = now
            # If a manual expiration fallback exists, keep days_until_expiration fresh
            if not domain_info.expiration_date and domain_info.manual_expiration_date:
                domain_info.days_until_expiration = _days_from_manual_date(domain_info.manual_expiration_date)
                if not domain_info.data_source:
                    domain_info.data_source = "manual"
            domain_info.save(
                update_fields=["error_message", "last_scanned_at", "days_until_expiration", "data_source", "updated_at"]
            )
            return domain_info

        # Detect security-relevant changes vs previously verified scan
        had_baseline = bool(domain_info.last_successful_at)
        changes_recorded = []
        if had_baseline:
            old_reg = (domain_info.registrar or "").strip()
            new_reg = (registrar or "").strip()
            if old_reg and new_reg and old_reg.lower() != new_reg.lower():
                changes_recorded.append(("registrar", old_reg, new_reg))

            old_ns = _normalize_ns_set(domain_info.name_servers)
            new_ns = _normalize_ns_set(name_servers)
            if old_ns and new_ns and old_ns != new_ns:
                changes_recorded.append(
                    ("name_servers", "\n".join(sorted(old_ns)), "\n".join(sorted(new_ns)))
                )

            if domain_info.is_locked is not None and is_locked is not None and domain_info.is_locked != is_locked:
                changes_recorded.append(
                    (
                        "is_locked",
                        "Transferencia bloqueada" if domain_info.is_locked else "Sin bloqueo",
                        "Transferencia bloqueada" if is_locked else "Sin bloqueo",
                    )
                )

        canonical_ns = "\n".join(sorted(_normalize_ns_set(name_servers)))
        effective_days = days_until_expiration
        if effective_days is None and domain_info.manual_expiration_date:
            effective_days = _days_from_manual_date(domain_info.manual_expiration_date)

        domain_info.data_source = data_source or ("manual" if domain_info.manual_expiration_date else "")
        domain_info.source_url = source_url
        domain_info.last_successful_at = now
        domain_info.registrar = registrar
        domain_info.creation_date = creation_date
        domain_info.expiration_date = expiration_date
        domain_info.last_updated = last_updated
        domain_info.status = status
        domain_info.name_servers = canonical_ns
        domain_info.registrant_country = registrant_country
        domain_info.days_until_expiration = effective_days
        domain_info.is_locked = is_locked
        domain_info.whois_server = whois_server
        domain_info.dnssec = dnssec
        domain_info.last_scanned_at = now
        domain_info.error_message = ""

        if changes_recorded:
            domain_info.last_change_at = now
            for field_name, old_val, new_val in changes_recorded:
                DomainChangeHistory.objects.create(
                    domain_info=domain_info,
                    field_name=field_name,
                    old_value=old_val,
                    new_value=new_val,
                )

        domain_info.save()
        return domain_info

    @staticmethod
    @transaction.atomic
    def acknowledge_changes(domain_id, organization_id):
        """Acknowledge reviewed registration changes (NS/registrar/lock)."""
        domain_info = DomainInfo.objects.select_for_update().get(id=domain_id, organization_id=organization_id)
        domain_info.changes_acknowledged_at = timezone.now()
        domain_info.save(update_fields=["changes_acknowledged_at", "updated_at"])
        return domain_info

    @staticmethod
    def get_change_history(domain_id, organization_id, limit=50):
        domain_info = DomainInfo.objects.get(id=domain_id, organization_id=organization_id)
        return domain_info.change_history.all()[:limit]

    @staticmethod
    def get_unwatched_domains(organization_id):
        """Discover root domains active in Uptime, SSL, or DNS that are not yet monitored in DomainInfo."""
        from dns_monitor.models import DNSRecord
        from monitoring.models import MonitoringTarget
        from ssl_monitor.models import SSLCertificate

        watched = set(
            DomainInfo.objects.filter(organization_id=organization_id).values_list("domain", flat=True)
        )
        watched_lower = {d.lower().rstrip(".") for d in watched}

        discovered = {}

        def _record(host, bucket):
            root = extract_root_domain(host)
            if not root or root in watched_lower:
                return
            entry = discovered.setdefault(
                root,
                {"domain": root, "targets_count": 0, "dns_count": 0, "ssl_count": 0, "sources": set()},
            )
            entry[bucket] += 1
            entry["sources"].add(host.lower().rstrip("."))

        for endpoint in MonitoringTarget.objects.filter(
            organization_id=organization_id,
            target_type__in=("http", "https"),
            runner_type="cloud",
            agent_probe__isnull=True,
        ).values_list("endpoint", flat=True):
            try:
                host = urlsplit(endpoint).hostname
                if host:
                    _record(host, "targets_count")
            except ValueError:
                continue

        for dom in SSLCertificate.objects.filter(organization_id=organization_id).values_list("domain", flat=True):
            _record(dom, "ssl_count")

        for dom in DNSRecord.objects.filter(organization_id=organization_id).values_list("domain", flat=True):
            _record(dom, "dns_count")

        result = []
        for entry in discovered.values():
            result.append(
                {
                    "domain": entry["domain"],
                    "targets_count": entry["targets_count"],
                    "dns_count": entry["dns_count"],
                    "ssl_count": entry["ssl_count"],
                    "sources": sorted(entry["sources"])[:5],
                }
            )
        result.sort(
            key=lambda x: (-(x["targets_count"] + x["ssl_count"] + x["dns_count"]), x["domain"])
        )
        return result[:10]

    @staticmethod
    def get_domain_stats(organization_id):
        """Returns KPI summary statistics for monitored WHOIS domains."""
        domains = DomainInfo.objects.filter(organization_id=organization_id)
        total = domains.count()
        active = domains.filter(error_message="", days_until_expiration__gt=60).count()
        expiring_30d = domains.filter(
            error_message="", days_until_expiration__gte=0, days_until_expiration__lte=30
        ).count()
        expiring_15d = domains.filter(
            error_message="", days_until_expiration__gte=0, days_until_expiration__lte=15
        ).count()
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
        domain_info = DomainInfo.objects.get(id=domain_id, organization_id=organization_id)
        domain_info.delete()

    @staticmethod
    @transaction.atomic
    def update_domain_record(domain_id, organization_id, domain=None, manual_expiration_date=..., trigger_scan=True):
        """Update domain name and/or manual_expiration_date for an existing domain record."""
        domain_info = DomainInfo.objects.get(id=domain_id, organization_id=organization_id)
        domain_changed = False

        if domain:
            clean_domain = domain.strip().replace("https://", "").replace("http://", "").split("/")[0].split(":")[0].lower()
            if clean_domain != domain_info.domain:
                domain_info.domain = clean_domain
                domain_changed = True

        if manual_expiration_date is not ...:
            parsed_manual = _parse_manual_date(manual_expiration_date)
            domain_info.manual_expiration_date = parsed_manual
            if not domain_info.expiration_date:
                domain_info.days_until_expiration = _days_from_manual_date(parsed_manual)
                if parsed_manual and not domain_info.data_source:
                    domain_info.data_source = "manual"

        domain_info.save()

        if trigger_scan and domain_changed:
            from .tasks import scan_whois
            from common.executions import initial_scan

            initial_scan(domain_info, scan_whois)
        return domain_info

    @staticmethod
    def get_expiring_soon(organization_id, days=60):
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
        from common.bulk import operate
        from .tasks import scan_whois

        return operate(DomainInfo, organization_id, action, domain_ids, scan_whois)
