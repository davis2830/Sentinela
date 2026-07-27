import logging
from datetime import datetime, timezone as dt_timezone

from celery import shared_task

from .models import DomainInfo
from .services import DomainService

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="domain.scan_whois")
def scan_whois(self, domain_id):
    """Scan WHOIS information for a given domain.

    Uses the python-whois library to query the domain registrar,
    creation date, expiration date, status, and name servers.

    Args:
        domain_id: UUID string of the DomainInfo record.
    """
    try:
        domain_info = DomainInfo.objects.get(id=domain_id)
    except DomainInfo.DoesNotExist:
        logger.error("Domain info %s not found.", domain_id)
        return

    domain = domain_info.domain
    logger.info("Scanning WHOIS for domain: %s", domain)

    try:
        import whois

        w = whois.whois(domain)

        registrar = w.registrar or ""
        status = ", ".join(w.status) if isinstance(w.status, list) else (w.status or "")
        name_servers = "\n".join(w.name_servers) if isinstance(w.name_servers, list) else (w.name_servers or "")
        registrant_country = w.country or ""

        creation_date = _parse_date(w.creation_date)
        expiration_date = _parse_date(w.expiration_date)
        last_updated = _parse_date(w.updated_date)

        days_until_expiration = None
        if expiration_date:
            now = datetime.now(dt_timezone.utc)
            days_until_expiration = (expiration_date - now).days

        DomainService.update_domain_scan(
            domain_id=domain_info.id,
            registrar=str(registrar),
            creation_date=creation_date,
            expiration_date=expiration_date,
            last_updated=last_updated,
            status=str(status),
            name_servers=str(name_servers),
            registrant_country=str(registrant_country),
            days_until_expiration=days_until_expiration,
            error_message="",
        )

        logger.info(
            "WHOIS scan complete for %s: expires in %d days",
            domain,
            days_until_expiration or 0,
        )

    except Exception as exc:
        logger.error("WHOIS error for %s: %s", domain, exc)
        DomainService.update_domain_scan(
            domain_id=domain_info.id,
            registrar="",
            creation_date=None,
            expiration_date=None,
            last_updated=None,
            status="",
            name_servers="",
            registrant_country="",
            days_until_expiration=None,
            error_message=f"WHOIS error: {exc}",
        )


def _parse_date(date_value):
    """Parse a WHOIS date value into a timezone-aware datetime.

    WHOIS dates can be a single datetime or a list of datetimes.
    Returns the most recent date if a list is provided.
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


@shared_task(name="domain.scan_all")
def scan_all_domains():
    """Scan WHOIS for all domains across all organizations.

    Runs periodically via Celery Beat.
    """
    domains = DomainInfo.objects.all()
    for domain in domains:
        scan_whois.delay(str(domain.id))

    logger.info("Scheduled WHOIS scans for %d domains.", domains.count())