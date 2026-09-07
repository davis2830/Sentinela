import logging
import time
from datetime import timedelta

import dns.resolver
from django.db import transaction
from django.utils import timezone

from .models import DNSChangeHistory, DNSRecord

logger = logging.getLogger(__name__)


class DNSMonitorService:
    """Service for DNS record monitoring.

    Handles CRUD operations for DNS records, deep resolution, latency tracking,
    SPF/DMARC analysis, and change detection with full audit trail.
    All business logic lives here, not in views.
    """

    @staticmethod
    def resolve_dns_query(domain, record_type, nameserver=None):
        """Resolves a DNS query, measures latency in ms, and analyzes record contents.

        Returns a dictionary with status, values list, ttl, response_time_ms, and security info.
        """
        clean_domain = domain.strip().replace("https://", "").replace("http://", "").split("/")[0].split(":")[0]
        rec_type = record_type.strip().upper()

        resolver = dns.resolver.Resolver()
        resolver.lifetime = 8.0
        if nameserver:
            resolver.nameservers = [nameserver]

        start_time = time.perf_counter()
        try:
            answers = resolver.resolve(clean_domain, rec_type)
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

            values = []
            ttl = None
            for rdata in answers:
                values.append(str(rdata))
                if ttl is None and answers.rrset:
                    ttl = answers.rrset.ttl

            # Specialized SPF / DMARC analysis for TXT records
            spf_info = None
            dmarc_info = None
            if rec_type == "TXT":
                for v in values:
                    clean_val = v.strip('"')
                    if clean_val.startswith("v=spf1"):
                        is_permissive = "+all" in clean_val or "all" in clean_val.split()
                        spf_info = {
                            "raw": clean_val,
                            "is_valid": True,
                            "policy": "-all" if "-all" in clean_val else ("~all" if "~all" in clean_val else "?all"),
                            "is_permissive": is_permissive,
                        }
                    elif clean_val.startswith("v=DMARC1"):
                        # Extract policy p=
                        policy = "none"
                        for part in clean_val.split(";"):
                            part = part.strip()
                            if part.startswith("p="):
                                policy = part.split("=")[1].strip()
                        dmarc_info = {
                            "raw": clean_val,
                            "policy": policy,
                            "is_enforced": policy in ("quarantine", "reject"),
                        }

            return {
                "success": True,
                "domain": clean_domain,
                "record_type": rec_type,
                "values": values,
                "ttl": ttl,
                "response_time_ms": latency_ms,
                "spf_info": spf_info,
                "dmarc_info": dmarc_info,
                "error_type": None,
                "error_message": None,
            }

        except dns.resolver.NXDOMAIN:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "success": False,
                "domain": clean_domain,
                "record_type": rec_type,
                "values": [],
                "ttl": None,
                "response_time_ms": latency_ms,
                "error_type": "NXDOMAIN",
                "error_message": f"El dominio '{clean_domain}' no existe (NXDOMAIN).",
            }
        except dns.resolver.NoAnswer:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "success": False,
                "domain": clean_domain,
                "record_type": rec_type,
                "values": [],
                "ttl": None,
                "response_time_ms": latency_ms,
                "error_type": "NO_ANSWER",
                "error_message": f"No se encontró registro {rec_type} para '{clean_domain}'.",
            }
        except dns.resolver.Timeout:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "success": False,
                "domain": clean_domain,
                "record_type": rec_type,
                "values": [],
                "ttl": None,
                "response_time_ms": latency_ms,
                "error_type": "TIMEOUT",
                "error_message": f"Tiempo de espera agotado al consultar '{clean_domain}'.",
            }
        except Exception as exc:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "success": False,
                "domain": clean_domain,
                "record_type": rec_type,
                "values": [],
                "ttl": None,
                "response_time_ms": latency_ms,
                "error_type": "ERROR",
                "error_message": str(exc),
            }

    @staticmethod
    def test_resolution(domain, record_type="A"):
        """Live interactive DNS resolution test without persisting to DB."""
        return DNSMonitorService.resolve_dns_query(domain, record_type)

    @staticmethod
    def list_records(organization_id, domain=None):
        """Return all DNS records for an organization."""
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
        records = DNSRecord.objects.filter(organization_id=organization_id)
        total = records.count()
        unique_domains = records.values_list("domain", flat=True).distinct().count()

        since_24h = timezone.now() - timedelta(hours=24)
        changes_24h = DNSChangeHistory.objects.filter(
            record__organization_id=organization_id,
            changed_at__gte=since_24h,
        ).count()

        unresolved = records.filter(value="").count()

        # Compute average response time in ms
        records_with_lat = records.filter(response_time_ms__isnull=False)
        avg_lat = 0
        if records_with_lat.exists():
            avg_lat = round(sum(r.response_time_ms for r in records_with_lat) / records_with_lat.count(), 1)

        return {
            "total": total,
            "unique_domains": unique_domains,
            "changes_24h": changes_24h,
            "unresolved": unresolved,
            "avg_latency_ms": avg_lat,
        }

    @staticmethod
    @transaction.atomic
    def update_record_scan(record_id, new_value, ttl, response_time_ms=None):
        """Update a DNS record with scan results, latency, and detect changes."""
        record = DNSRecord.objects.get(id=record_id)
        old_value = record.value
        now = timezone.now()

        value_changed = old_value != new_value and old_value != ""

        record.value = new_value
        record.ttl = ttl
        if response_time_ms is not None:
            record.response_time_ms = response_time_ms
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

    @staticmethod
    def bulk_action(organization_id, action, record_ids):
        """Execute bulk actions (scan, delete) on selected DNS records."""
        records = DNSRecord.objects.filter(
            organization_id=organization_id, id__in=record_ids
        )
        count = records.count()
        if action == "scan":
            from .tasks import scan_dns_records
            for rec in records:
                scan_dns_records.delay(str(rec.id))
            return {"action": "scan", "processed": count, "message": f"{count} registros DNS encolados para re-resolución."}
        elif action == "delete":
            deleted_count = records.delete()[0]
            return {"action": "delete", "processed": deleted_count, "message": f"{deleted_count} registros eliminados."}
        else:
            raise ValueError(f"Acción no soportada: {action}")