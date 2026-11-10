"""Allowlisted platform resource summaries; never serialize configurations or credentials."""

from dataclasses import dataclass
from urllib.parse import urlsplit
from django.apps import apps
from django.db.models import Count, Q
from rest_framework.exceptions import ValidationError


@dataclass(frozen=True)
class Resource:
    model: str
    label: str
    limit: str
    name: str
    destination: str | None
    measured: str | None
    state: str


RESOURCES = {
    "monitoring": Resource(
        "monitoring.MonitoringTarget",
        "Uptime",
        "max_monitoring_targets",
        "name",
        "endpoint",
        "last_checked_at",
        "last_status",
    ),
    "ssl": Resource(
        "ssl_monitor.SSLCertificate", "SSL", "max_ssl_certificates", "domain", "domain", "last_scanned_at", "is_valid"
    ),
    "dns": Resource(
        "dns_monitor.DNSRecord", "DNS", "max_dns_records", "domain", "domain", "last_scanned_at", "record_type"
    ),
    "domain": Resource("domain.DomainInfo", "Dominios", "max_domains", "domain", "domain", "last_scanned_at", "status"),
    "api": Resource(
        "api_checks.APICheckTarget", "API Checks", "max_api_checks", "name", "url", "last_checked_at", "last_status"
    ),
    "security": Resource(
        "security_headers.SecurityHeaderTarget",
        "Security Headers",
        "max_security_headers",
        "name",
        "url",
        "last_checked_at",
        "last_grade",
    ),
    "agents": Resource(
        "monitoring.AgentProbe", "Agentes", "max_private_agents", "name", None, "last_heartbeat", "status"
    ),
}


def model_for(spec):
    return apps.get_model(spec.model)


def usage(organization):
    limits = organization.get_plan_limits()
    result = []
    for key, spec in RESOURCES.items():
        qs = model_for(spec).objects.filter(organization_id=organization.pk)
        counts = (
            qs.aggregate(total=Count("pk"), measured=Count("pk", filter=Q(**{spec.measured + "__isnull": False})))
            if spec.measured
            else {"total": qs.count(), "measured": 0}
        )
        result.append(
            {"module": key, "label": spec.label, "limit_key": spec.limit, "limit": limits[spec.limit], **counts}
        )
    return result


def safe_destination(value):
    if not value:
        return None
    try:
        parsed = urlsplit(value if "://" in value else "//" + value)
        host = parsed.hostname or ""
        if ":" in host:
            host = "[" + host + "]"
        authority = host + (":" + str(parsed.port) if parsed.port else "")
        return (parsed.scheme + "://" if parsed.scheme else "") + authority + parsed.path
    except ValueError:
        return "Destino no disponible"


def resource_page(organization, module, page):
    if module not in RESOURCES:
        raise ValidationError({"module": "Módulo no disponible."})
    spec = RESOURCES[module]
    qs = model_for(spec).objects.filter(organization_id=organization.pk).order_by("-created_at", "-id")
    total = qs.count()
    fields = list(
        dict.fromkeys(
            ["id", spec.name, spec.state]
            + ([spec.destination] if spec.destination else [])
            + ([spec.measured] if spec.measured else [])
        )
    )
    items = []
    for row in qs.values(*fields)[(page - 1) * 25 : page * 25]:
        state = row[spec.state]
        if module == "agents":
            state = "online" if model_for(spec)(**row).is_online else "offline"
        if not row.get(spec.measured):
            state = None
        if isinstance(state, (list, dict)):
            state = None
        items.append(
            {
                "id": row["id"],
                "name": row[spec.name],
                "destination": safe_destination(row.get(spec.destination)),
                "state": str(state) if state is not None else None,
                "measured_at": row.get(spec.measured),
            }
        )
    return {
        "module": module,
        "label": spec.label,
        "items": items,
        "total": total,
        "page": page,
        "page_size": 25,
        "has_next": page * 25 < total,
    }
