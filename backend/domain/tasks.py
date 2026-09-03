import logging
from celery import shared_task

from .models import DomainInfo
from .services import DomainService

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="domain.scan_whois")
def scan_whois(self, domain_id):
    """Scan WHOIS information for a given domain.

    Queries the registrar, creation/expiration dates, status, name servers,
    and checks for EPP domain transfer lock protection.

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

    res = DomainService.perform_whois_query(domain)

    if res.get("success"):
        DomainService.update_domain_scan(
            domain_id=domain_info.id,
            registrar=res.get("registrar", ""),
            creation_date=res.get("creation_date"),
            expiration_date=res.get("expiration_date"),
            last_updated=res.get("last_updated"),
            status=", ".join(res.get("status", [])),
            name_servers="\n".join(res.get("name_servers", [])),
            registrant_country=res.get("registrant_country", ""),
            days_until_expiration=res.get("days_until_expiration"),
            is_locked=res.get("is_locked", True),
            whois_server=res.get("whois_server", ""),
            dnssec=res.get("dnssec", ""),
            error_message="",
        )
        logger.info(
            "WHOIS scan complete for %s: expires in %s days (locked: %s)",
            domain,
            res.get("days_until_expiration"),
            res.get("is_locked"),
        )
    else:
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
            is_locked=False,
            whois_server="",
            dnssec="",
            error_message=f"WHOIS error: {res.get('error_message')}",
        )
        logger.error("WHOIS error for %s: %s", domain, res.get("error_message"))


@shared_task(name="domain.scan_all")
def scan_all_domains():
    """Scan WHOIS for all domains for all organizations.

    Runs periodically via Celery Beat.
    """
    domains = DomainInfo.objects.all()
    for domain in domains:
        scan_whois.delay(str(domain.id))

    logger.info("Scheduled WHOIS scans for %d domains.", domains.count())