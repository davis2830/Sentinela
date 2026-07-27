import logging

import dns.resolver
from celery import shared_task

from .models import DNSRecord
from .services import DNSMonitorService

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="dns.scan_records")
def scan_dns_records(self, record_id):
    """Scan a DNS record for a given record.

    Resolves the DNS query for the specified domain and record type,
    then updates the record with the result and detects changes.

    Args:
        record_id: UUID string of the DNSRecord.
    """
    try:
        record = DNSRecord.objects.get(id=record_id)
    except DNSRecord.DoesNotExist:
        logger.error("DNS record %s not found.", record_id)
        return

    domain = record.domain
    record_type = record.record_type
    logger.info("Scanning DNS %s record for domain: %s", record_type, domain)

    try:
        resolver = dns.resolver.Resolver()
        resolver.lifetime = 10

        answers = resolver.resolve(domain, record_type)

        values = []
        ttl = None
        for rdata in answers:
            values.append(str(rdata))
            if ttl is None:
                ttl = answers.rrset.ttl

        new_value = "\n".join(values)

        DNSMonitorService.update_record_scan(
            record_id=record.id,
            new_value=new_value,
            ttl=ttl,
        )

        logger.info(
            "DNS scan complete for %s %s: %d records found",
            domain,
            record_type,
            len(values),
        )

    except dns.resolver.NXDOMAIN:
        logger.warning("Domain %s does not exist (NXDOMAIN).", domain)
        DNSMonitorService.update_record_scan(
            record_id=record.id,
            new_value="",
            ttl=None,
        )
    except dns.resolver.NoAnswer:
        logger.warning("No %s record found for %s.", record_type, domain)
        DNSMonitorService.update_record_scan(
            record_id=record.id,
            new_value="",
            ttl=None,
        )
    except dns.resolver.Timeout:
        logger.error("DNS query timeout for %s.", domain)
        DNSMonitorService.update_record_scan(
            record_id=record.id,
            new_value="",
            ttl=None,
        )
    except Exception as exc:
        logger.exception("Error scanning DNS for %s: %s", domain, exc)
        DNSMonitorService.update_record_scan(
            record_id=record.id,
            new_value="",
            ttl=None,
        )


@shared_task(name="dns.scan_all")
def scan_all_dns_records():
    """Scan all DNS records for all organizations.

    Runs periodically via Celery Beat.
    """
    records = DNSRecord.objects.all()
    for record in records:
        scan_dns_records.delay(str(record.id))

    logger.info("Scheduled DNS scans for %d records.", records.count())