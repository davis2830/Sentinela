"""Read-only dossier discovery and explicit, tenant-safe resource associations.

No DNS/network calls, resource provisioning or scan reservations happen here.
WHOIS uses configured ancestor domains, never a guessed last-two-label domain.
"""
import ipaddress
import re
from urllib.parse import urlsplit, urlunsplit

from django.db import transaction
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from rest_framework.exceptions import ValidationError

from .models import MonitoringTarget, TargetCoverage


def normalize_host(value):
    return value.rstrip(".").lower().encode("idna").decode("ascii")


def identity(value):
    parsed = urlsplit(value)
    if parsed.scheme.lower() not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("URL HTTP/HTTPS inválida")
    host = normalize_host(parsed.hostname)
    port = parsed.port or (443 if parsed.scheme.lower() == "https" else 80)
    authority = f"[{host}]" if ":" in host else host
    default = 443 if parsed.scheme.lower() == "https" else 80
    if port != default:
        authority += f":{port}"
    url = urlunsplit((parsed.scheme.lower(), authority, parsed.path or "/", parsed.query, ""))
    return host, port, url, parsed.scheme.lower()


def registry():
    from ssl_monitor.models import SSLCertificate
    from ssl_monitor.serializers import SSLCertificateSerializer
    from dns_monitor.models import DNSRecord
    from dns_monitor.serializers import DNSRecordSerializer
    from domain.models import DomainInfo
    from domain.serializers import DomainInfoSerializer
    from security_headers.models import SecurityHeaderTarget
    from security_headers.serializers import SecurityHeaderTargetSerializer
    return {
        "ssl": (SSLCertificate, SSLCertificateSerializer),
        "dns": (DNSRecord, DNSRecordSerializer),
        "domain": (DomainInfo, DomainInfoSerializer),
        "security": (SecurityHeaderTarget, SecurityHeaderTargetSerializer),
    }


def applicable(target, module):
    if target.target_type not in ("http", "https") or target.runner_type == "agent" or target.agent_probe_id:
        return False
    try:
        host, _, _, scheme = identity(target.endpoint)
        if module == "ssl":
            return scheme == "https"
        if module in ("domain", "dns"):
            try:
                ipaddress.ip_address(host)
                return False
            except ValueError:
                return "." in host
        return True
    except (ValueError, UnicodeError):
        return False


def matches(target, module, resource):
    if resource.organization_id != target.organization_id or not applicable(target, module):
        return False
    try:
        host, port, url, _ = identity(target.endpoint)
        if module == "security":
            return identity(resource.url)[2] == url
        resource_host = normalize_host(resource.domain)
        if module == "ssl":
            return resource_host == host and resource.port == port
        if module == "dns":
            return resource_host == host
        # Only configured, explicitly selected ancestor domains. No PSL guess.
        return "." in resource_host and (resource_host == host or host.endswith("." + resource_host))
    except (ValueError, UnicodeError):
        return False


def candidates(target, module):
    model, _ = registry()[module]
    if not applicable(target, module):
        return []
    host, port, url, _ = identity(target.endpoint)
    qs = model.objects.filter(organization_id=target.organization_id)
    if module in ("dns", "ssl"):
        qs = qs.filter(Q(domain__iexact=host) | Q(domain__iexact=host + "."))
        if module == "ssl":
            qs = qs.filter(port=port)
    elif module == "domain":
        ancestors = [".".join(host.split(".")[i:]) for i in range(len(host.split(".")) - 1)]
        query = Q(pk__in=[])
        for ancestor in ancestors:
            query |= Q(domain__iexact=ancestor) | Q(domain__iexact=ancestor + ".")
        qs = qs.filter(query)
    else:
        # Keep path/query exact; no redirects or broad substring matching.
        scheme = urlsplit(url).scheme
        authority = re.escape(f"[{host}]" if ":" in host else host)
        default = 443 if scheme == "https" else 80
        port_pattern = f"(?::{port})?" if port == default else f":{port}"
        qs = qs.filter(url__iregex=f"^{scheme}://{authority}{port_pattern}(/|$)")
    return [r for r in qs.order_by("created_at") if matches(target, module, r)]


def snapshot(target, request):
    links = TargetCoverage.objects.filter(target=target).select_related("ssl", "domain", "security").prefetch_related("dns").first()
    sections = {}
    related = [("monitoring", str(target.pk))]
    alert_types = {"ssl": "ssl", "dns": "dns", "domain": "domain", "security": "security_headers"}
    for module, (_, serializer) in registry().items():
        allowed = applicable(target, module)
        stored = list(links.dns.all()) if links and module == "dns" else [getattr(links, module)] if links and getattr(links, module, None) else []
        valid = [r for r in stored if matches(target, module, r)]
        # If any stored association drifted, never present a partial set as valid.
        if len(valid) != len(stored):
            valid = []
        # Serializers receive a list, not a queryset. Cache the already validated
        # tenant once to avoid an organization lookup per linked DNS record.
        for resource in valid:
            resource.organization = target.organization
        related.extend((alert_types[module], str(r.pk)) for r in valid)
        choices = candidates(target, module) if allowed else []
        sections[module] = {
            "status": "not_applicable" if not allowed else "needs_review" if len(stored) and not valid else "linked" if valid else "unlinked",
            "resources": serializer(valid, many=True, context={"request": request}).data,
            "candidates": [{"id": str(r.pk), "label": f"{r.domain} · {r.record_type}" if module == "dns" else f"{r.domain}:{r.port}" if module == "ssl" else r.url if module == "security" else r.domain} for r in choices[:50]],
            "candidates_truncated": len(choices) > 50,
        }
    from alerts.models import Alert
    from incidents.models import Incident, IncidentAlert
    from alerts.serializers import AlertSerializer
    from incidents.serializers import IncidentSerializer
    from audit.models import AuditLog
    query = Q(pk__in=[])
    for kind, pk in related:
        query |= Q(target_type=kind, target_id=pk)
    alerts = Alert.objects.filter(query, organization_id=target.organization_id).order_by("-triggered_at")[:25]
    incident_ids = IncidentAlert.objects.filter(alert_id__in=[a.pk for a in alerts], incident__organization_id=target.organization_id).values("incident_id")
    incidents = Incident.objects.filter(Q(pk__in=incident_ids) | query, organization_id=target.organization_id).select_related("assigned_to", "assigned_team").order_by("-opened_at")[:10]
    logs = AuditLog.objects.filter(organization_id=target.organization_id, metadata__target_id=str(target.pk)).order_by("-timestamp")[:25]
    return {"sections": sections, "activity": {
        "alerts": AlertSerializer(alerts, many=True).data,
        "incidents": IncidentSerializer(incidents, many=True).data,
        "changes": list(logs.values("id", "description", "timestamp")),
    }}


@transaction.atomic
def set_links(target_id, organization_id, selections, request):
    target = MonitoringTarget.objects.select_for_update().get(pk=target_id, organization_id=organization_id)
    if not isinstance(selections, dict) or not selections or set(selections) - set(registry()):
        raise ValidationError("Selecciona una cobertura válida.")
    resolved = {}
    for module, ids in selections.items():
        if not isinstance(ids, list) or len(ids) > (50 if module == "dns" else 1) or any(not isinstance(i, str) for i in ids) or len(set(ids)) != len(ids):
            raise ValidationError({module: "Selección inválida."})
        model, _ = registry()[module]
        try:
            resources = list(model.objects.filter(pk__in=ids, organization_id=organization_id))
        except (ValueError, TypeError, DjangoValidationError) as exc:
            raise ValidationError({module: "Selección inválida."}) from exc
        if len(resources) != len(ids) or any(not matches(target, module, r) for r in resources):
            raise ValidationError({module: "El recurso no corresponde a este endpoint o no está disponible."})
        if ids and not applicable(target, module):
            raise ValidationError({module: "No aplica a este tipo de endpoint."})
        resolved[module] = resources
    links, _ = TargetCoverage.objects.get_or_create(target=target)
    for module, resources in resolved.items():
        if module == "dns":
            links.dns.set(resources)
        else:
            setattr(links, module, resources[0] if resources else None)
    links.save()
    from audit.services import AuditService
    AuditService.log_from_request(request, "update", "monitoring", "Cobertura del endpoint actualizada.", {"target_id": str(target.pk), "coverage": selections})
    return links


def link_provisioned(target, module, resource):
    """Only provisioning can automatically associate the resource it actually used."""
    if not resource or module == "domain" or module not in registry() or not matches(target, module, resource):
        return
    links, _ = TargetCoverage.objects.get_or_create(target=target)
    if module == "dns":
        links.dns.add(resource)
    elif not getattr(links, module + "_id"):
        setattr(links, module, resource)
        links.save(update_fields=[module, "updated_at"])
