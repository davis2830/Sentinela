import logging
from celery import shared_task

from .models import DNSRecord
from .services import DNSMonitorService

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="dns.scan_records")
def scan_dns_records(self, record_id):
    """Scan a DNS record for a given record.

    Resolves the DNS query for the specified domain and record type,
    measures query response time, updates the record, and detects zone mutations.

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

    res = DNSMonitorService.resolve_dns_query(domain, record_type)

    if res.get("success"):
        new_value = "\n".join(res.get("values", []))
        DNSMonitorService.update_record_scan(
            record_id=record.id,
            new_value=new_value,
            ttl=res.get("ttl"),
            response_time_ms=res.get("response_time_ms"),
        )
        logger.info(
            "DNS scan complete for %s %s: %d values in %sms (TTL %s)",
            domain,
            record_type,
            len(res.get("values", [])),
            res.get("response_time_ms"),
            res.get("ttl"),
        )
    else:
        DNSMonitorService.update_record_scan(
            record_id=record.id,
            new_value="",
            ttl=None,
            response_time_ms=res.get("response_time_ms"),
        )
        logger.warning(
            "DNS scan failed for %s %s (%s): %s in %sms",
            domain,
            record_type,
            res.get("error_type"),
            res.get("error_message"),
            res.get("response_time_ms"),
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