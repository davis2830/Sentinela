import ipaddress
import logging
import time
from datetime import timedelta

import dns.resolver
from django.db import transaction
from common.beta_quota import beta_creation
from django.utils import timezone

from .models import DNSChangeHistory, DNSRecord

logger = logging.getLogger(__name__)


class DNSMonitorService:
    """Service for DNS record monitoring.

    Handles CRUD operations for DNS records, public multi-resolver resolution,
    propagation consistency checks, latency tracking, SPF/DMARC analysis,
    and set-based change detection with full audit trail.
    All business logic lives here, not in views.
    """

    PUBLIC_RESOLVERS = (
        ("1.1.1.1", "Cloudflare"),
        ("8.8.8.8", "Google"),
    )

    @staticmethod
    def _normalize_value_set(raw_values):
        """Return a canonical deduplicated set of non-empty DNS answer strings."""
        if isinstance(raw_values, str):
            items = raw_values.splitlines()
        else:
            items = raw_values or []
        return {str(v).strip() for v in items if str(v).strip()}

    @staticmethod
    def _values_to_cidr_reference(raw_values):
        """Convert IPv4/IPv6 answers into deduplicated /24 (IPv4) or /48 (IPv6) CIDR ranges."""
        result = set()
        for val in DNSMonitorService._normalize_value_set(raw_values):
            if "/" in val:
                try:
                    result.add(str(ipaddress.ip_network(val, strict=False)))
                    continue
                except ValueError:
                    pass
            try:
                addr = ipaddress.ip_address(val)
                prefix = 24 if addr.version == 4 else 48
                result.add(str(ipaddress.ip_network(f"{addr}/{prefix}", strict=False)))
            except ValueError:
                result.add(val)
        return sorted(result)

    @staticmethod
    def _evaluate_reference_match(current_values, expected_values, reference_mode="exact"):
        """Compare resolved DNS answers against expected values according to reference_mode.

        Modes:
        - exact: exact set match (still honors explicit CIDR notation like 216.198.79.0/24).
        - cidr: every resolved IP must fall inside at least one configured CIDR/network
                (bare IPv4 defaults to /24, bare IPv6 defaults to /48).
        - provider: every resolved IP must share the same /24 (IPv4) or /48 (IPv6) provider
                    prefix as any expected IP.
        """
        expected_set = DNSMonitorService._normalize_value_set(expected_values)
        if not expected_set:
            return None
        current_set = DNSMonitorService._normalize_value_set(current_values)
        if not current_set:
            return False

        mode = (reference_mode or "exact").lower()
        has_explicit_cidr = any("/" in e for e in expected_set)

        if mode == "exact" and not has_explicit_cidr:
            return {v.lower() for v in expected_set} == {v.lower() for v in current_set}

        networks = []
        literals = set()
        for entry in expected_set:
            if "/" in entry:
                try:
                    networks.append(ipaddress.ip_network(entry, strict=False))
                    continue
                except ValueError:
                    pass
            try:
                addr = ipaddress.ip_address(entry)
                if mode in ("cidr", "provider"):
                    prefix = 24 if addr.version == 4 else 48
                    networks.append(ipaddress.ip_network(f"{addr}/{prefix}", strict=False))
                else:
                    networks.append(ipaddress.ip_network(f"{addr}/{addr.max_prefixlen}", strict=False))
            except ValueError:
                literals.add(entry.lower())

        for val in current_set:
            if val.lower() in literals:
                continue
            try:
                addr = ipaddress.ip_address(val)
            except ValueError:
                return False
            if not any(addr in net for net in networks):
                return False
        return True

    @staticmethod
    def _query_single_resolver(clean_domain, rec_type, nameserver_ip, label):
        start_time = time.perf_counter()
        try:
            resolver = dns.resolver.Resolver(configure=False)
            resolver.nameservers = [nameserver_ip]
            resolver.lifetime = 5.0
            resolver.timeout = 3.0
            answers = resolver.resolve(clean_domain, rec_type)
            latency_ms = round((time.perf_counter() - start_time) * 1000, 1)

            values = []
            ttl = None
            for rdata in answers:
                val = str(rdata).strip()
                if val and val not in values:
                    values.append(val)
                if ttl is None and answers.rrset:
                    ttl = answers.rrset.ttl

            return {
                "resolver": nameserver_ip,
                "label": label,
                "success": True,
                "values": sorted(values),
                "ttl": ttl,
                "latency_ms": latency_ms,
                "error_type": None,
                "error_message": None,
            }
        except dns.resolver.NXDOMAIN:
            return {
                "resolver": nameserver_ip,
                "label": label,
                "success": False,
                "values": [],
                "ttl": None,
                "latency_ms": round((time.perf_counter() - start_time) * 1000, 1),
                "error_type": "NXDOMAIN",
                "error_message": f"El dominio '{clean_domain}' no existe (NXDOMAIN).",
            }
        except dns.resolver.NoAnswer:
            return {
                "resolver": nameserver_ip,
                "label": label,
                "success": False,
                "values": [],
                "ttl": None,
                "latency_ms": round((time.perf_counter() - start_time) * 1000, 1),
                "error_type": "NO_ANSWER",
                "error_message": f"No se encontró registro {rec_type} para '{clean_domain}'.",
            }
        except dns.resolver.NoNameservers:
            return {
                "resolver": nameserver_ip,
                "label": label,
                "success": False,
                "values": [],
                "ttl": None,
                "latency_ms": round((time.perf_counter() - start_time) * 1000, 1),
                "error_type": "SERVFAIL",
                "error_message": f"El servidor DNS devolvió SERVFAIL para '{clean_domain}'.",
            }
        except dns.resolver.Timeout:
            return {
                "resolver": nameserver_ip,
                "label": label,
                "success": False,
                "values": [],
                "ttl": None,
                "latency_ms": round((time.perf_counter() - start_time) * 1000, 1),
                "error_type": "TIMEOUT",
                "error_message": f"Tiempo de espera agotado al consultar '{clean_domain}'.",
            }
        except Exception as exc:
            return {
                "resolver": nameserver_ip,
                "label": label,
                "success": False,
                "values": [],
                "ttl": None,
                "latency_ms": round((time.perf_counter() - start_time) * 1000, 1),
                "error_type": "ERROR",
                "error_message": str(exc)[:300],
            }

    @staticmethod
    def resolve_dns_query(domain, record_type, nameserver=None):
        """Resolves a DNS query against public resolvers (1.1.1.1 & 8.8.8.8),
        measures real resolution latency, checks propagation consistency, and analyzes SPF/DMARC.
        """
        clean_domain = domain.strip().replace("https://", "").replace("http://", "").split("/")[0].split(":")[0]
        rec_type = record_type.strip().upper()

        start_time = time.perf_counter()
        try:
            from common.security import resolve_safe_target_endpoint, validate_safe_target_endpoint

            validate_safe_target_endpoint(f"http://{clean_domain}", allow_private=False)
            targets = list(DNSMonitorService.PUBLIC_RESOLVERS)
            if nameserver:
                _, _, _, nameserver_ips = resolve_safe_target_endpoint(
                    f"http://{nameserver}:53",
                    allow_private=False,
                )
                targets = [(nameserver_ips[0], nameserver)]
        except Exception as exc:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 1)
            return {
                "resolver": "",
                "resolver_results": [],
                "propagation_status": "error",
                "success": False,
                "domain": clean_domain,
                "record_type": rec_type,
                "values": [],
                "ttl": None,
                "response_time_ms": latency_ms,
                "error_type": "ERROR",
                "error_message": str(exc),
            }

        results = [
            DNSMonitorService._query_single_resolver(clean_domain, rec_type, ip, label)
            for ip, label in targets
        ]
        succeeded = [r for r in results if r["success"]]

        if not succeeded:
            primary_err = results[0]
            return {
                "resolver": primary_err["resolver"],
                "resolver_results": results,
                "propagation_status": "error",
                "success": False,
                "domain": clean_domain,
                "record_type": rec_type,
                "values": [],
                "ttl": None,
                "response_time_ms": primary_err["latency_ms"],
                "error_type": primary_err["error_type"],
                "error_message": primary_err["error_message"],
            }

        primary = succeeded[0]
        values = primary["values"]
        ttl = primary["ttl"]
        latency_ms = primary["latency_ms"]

        # Compare value sets across all succeeding resolvers to detect propagation drift
        if len(succeeded) >= 2:
            sets = [frozenset(v.lower() for v in r["values"]) for r in succeeded]
            propagation_status = "consistent" if len(set(sets)) == 1 else "propagating"
        else:
            propagation_status = "consistent"

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
            "resolver": primary["resolver"],
            "resolver_results": results,
            "propagation_status": propagation_status,
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

    @staticmethod
    def test_resolution(domain, record_type="A"):
        """Live interactive DNS resolution test without persisting to DB."""
        return DNSMonitorService.resolve_dns_query(domain, record_type)

    @staticmethod
    def list_records(organization_id, domain=None):
        """Return all DNS records for an organization (with prefetched history & Uptime links)."""
        qs = (
            DNSRecord.objects.filter(organization_id=organization_id)
            .prefetch_related("change_history", "targetcoverage_set__target")
        )
        if domain:
            qs = qs.filter(domain=domain)
        return qs.order_by("-created_at")

    @staticmethod
    def get_record(record_id, organization_id):
        """Return a single DNS record by ID within an organization."""
        return DNSRecord.objects.get(id=record_id, organization_id=organization_id)

    @staticmethod
    @transaction.atomic
    @beta_creation("dns_records")
    def create_record(organization_id, domain, record_type, expected_values=None, reference_mode="exact"):
        """Create a new DNS record to monitor and trigger immediate resolution."""
        clean_domain = domain.strip().replace("https://", "").replace("http://", "").split("/")[0].split(":")[0]
        exp_list = list(expected_values or [])
        mode = reference_mode or DNSRecord.ReferenceMode.EXACT
        record, created = DNSRecord.objects.get_or_create(
            organization_id=organization_id,
            domain=clean_domain,
            record_type=record_type,
            defaults={
                "expected_values": exp_list,
                "reference_mode": mode,
                "reference_updated_at": timezone.now() if exp_list else None,
            },
        )
        if not created:
            return record
        from .tasks import scan_dns_records
        from common.executions import initial_scan

        initial_scan(record, scan_dns_records)
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
        record = DNSRecord.objects.get(id=record_id, organization_id=organization_id)
        record.delete()

    @staticmethod
    @transaction.atomic
    def update_record(record_id, organization_id, domain=None, record_type=None, expected_values=None, reference_mode=None):
        """Update domain, record_type, expected_values, or reference_mode for a DNS record."""
        record = DNSRecord.objects.get(id=record_id, organization_id=organization_id)
        if reference_mode is not None:
            record.reference_mode = reference_mode
        if expected_values is not None:
            record.expected_values = expected_values
            record.reference_updated_at = timezone.now() if expected_values else None
        if expected_values is not None or reference_mode is not None:
            record.matches_expected = DNSMonitorService._evaluate_reference_match(
                record.value,
                record.expected_values,
                record.reference_mode,
            )
        if domain:
            record.domain = domain.strip().replace("https://", "").replace("http://", "").split("/")[0].split(":")[0]
        if record_type:
            record.record_type = record_type
        record.save()
        from .tasks import scan_dns_records
        from common.executions import initial_scan

        initial_scan(record, scan_dns_records)
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

        unresolved = records.exclude(last_attempt_status="success").count()

        # Compute average response time in ms
        from django.db.models import Avg

        average = records.filter(last_attempt_status="success").aggregate(value=Avg("response_time_ms"))["value"]
        avg_lat = round(average, 1) if average is not None else None

        return {
            "total": total,
            "unique_domains": unique_domains,
            "changes_24h": changes_24h,
            "unresolved": unresolved,
            "avg_latency_ms": avg_lat,
        }

    @staticmethod
    @transaction.atomic
    def accept_current_as_reference(record_id, organization_id, reference_mode=None):
        """Accept the currently resolved DNS values as the expected reference baseline."""
        record = DNSRecord.objects.select_for_update().get(id=record_id, organization_id=organization_id)
        current_set = DNSMonitorService._normalize_value_set(record.value)
        if not current_set:
            raise ValueError("El registro no tiene valores resueltos para guardar como referencia.")
        mode = reference_mode or record.reference_mode or DNSRecord.ReferenceMode.EXACT
        if mode not in {c[0] for c in DNSRecord.ReferenceMode.choices}:
            raise ValueError("Modo de referencia inválido.")
        record.reference_mode = mode
        if mode == DNSRecord.ReferenceMode.CIDR:
            record.expected_values = DNSMonitorService._values_to_cidr_reference(current_set)
        else:
            record.expected_values = sorted(current_set)
        record.reference_updated_at = timezone.now()
        record.matches_expected = True
        record.save(
            update_fields=[
                "expected_values",
                "reference_mode",
                "reference_updated_at",
                "matches_expected",
                "updated_at",
            ]
        )
        return record

    @staticmethod
    @transaction.atomic
    def update_record_scan(
        record_id,
        new_value,
        ttl,
        response_time_ms=None,
        error_code="",
        error_message="",
        resolver="",
        resolver_results=None,
        propagation_status="",
    ):
        """Update a DNS record with scan results, set-based change detection, and resolver consensus."""
        record = DNSRecord.objects.get(id=record_id)
        from common.execution_context import assert_current

        assert_current(record)
        old_value = record.value
        now = timezone.now()

        record.last_scanned_at = now
        record.last_attempt_status = "error" if error_code else "success"
        record.last_error_code = error_code
        record.last_error_message = error_message[:500]
        if resolver:
            record.resolver = resolver
        if resolver_results is not None:
            record.resolver_results = resolver_results
        if propagation_status:
            record.propagation_status = propagation_status

        if error_code:
            record.matches_expected = None
            record.save()
            return record

        record.last_successful_at = now
        old_set = DNSMonitorService._normalize_value_set(old_value)
        new_set = DNSMonitorService._normalize_value_set(new_value)
        canonical_new = "\n".join(sorted(new_set))

        record.matches_expected = DNSMonitorService._evaluate_reference_match(
            new_set,
            record.expected_values,
            record.reference_mode,
        )
        # Compare sets so round-robin IP ordering never triggers false mutations
        value_changed = bool(old_set) and (old_set != new_set)

        record.value = canonical_new
        record.ttl = ttl
        if response_time_ms is not None:
            record.response_time_ms = response_time_ms
        record.last_scanned_at = now

        if value_changed:
            record.last_change_at = now
            DNSChangeHistory.objects.create(
                record=record,
                old_value="\n".join(sorted(old_set)),
                new_value=canonical_new,
            )

        record.save()
        return record

    @staticmethod
    def get_change_history(record_id, organization_id, limit=50):
        """Return change history for a DNS record."""
        record = DNSRecord.objects.get(id=record_id, organization_id=organization_id)
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
        from common.bulk import operate
        from .tasks import scan_dns_records

        return operate(DNSRecord, organization_id, action, record_ids, scan_dns_records)
