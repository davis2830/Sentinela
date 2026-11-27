"""Compatible, tenant-scoped directories: paginate before serializing relations."""

import csv
import io
from datetime import timedelta
from urllib.parse import urlsplit, urlunsplit

from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .pagination import directory_response, paginate

FIELDS = {
    "monitoring": ("name", "endpoint", "target_type", "last_status", "last_checked_at"),
    "ssl_monitor": ("domain", "port", "is_valid", "days_remaining", "last_scanned_at"),
    "dns_monitor": ("domain", "record_type", "value", "last_attempt_status", "last_scanned_at"),
    "domain": ("domain", "registrar", "expiration_date", "last_scanned_at", "error_message"),
    "api_checks": ("name", "url", "method", "last_status", "last_checked_at"),
    "security_headers": ("name", "url", "last_score", "last_grade", "last_checked_at"),
    "probe": ("name", "hostname", "version", "last_heartbeat", "revoked_at"),
}

SEARCHABLE_BY_MODULE = {
    "monitoring": ("name", "endpoint"),
    "ssl_monitor": ("domain", "issuer", "algorithm"),
    "dns_monitor": ("domain", "value"),
    "domain": ("domain", "registrar"),
    "api_checks": ("name", "url"),
    "security_headers": ("name", "url", "server_header", "powered_by_header"),
    "probe": ("name", "hostname", "ip_address", "version"),
}

ALLOWED_ORDERING = {
    "name",
    "-name",
    "created_at",
    "-created_at",
    "domain",
    "-domain",
    "days_remaining",
    "-days_remaining",
    "expiration_date",
    "-expiration_date",
    "last_latency",
    "-last_latency",
    "last_status",
    "-last_status",
}


def _filter_monitoring(rows, params):
    if params.get("type") and params["type"] != "all":
        rows = rows.filter(target_type=params["type"].lower())
    state = params.get("status", "all")
    if state != "all":
        guardian_paused = Q(runner_type="agent", agent_probe__enabled=False)
        if state in ("disabled", "paused"):
            rows = rows.filter(Q(enabled=False) | guardian_paused)
        else:
            rows = rows.filter(
                enabled=True,
                last_status__in=["down", "error"] if state == "down" else [state],
            ).exclude(guardian_paused)
    if params.get("tag") not in (None, "", "all"):
        rows = rows.filter(tags__contains=[params["tag"]])
    if params.get("agent"):
        from rest_framework.serializers import UUIDField

        rows = rows.filter(agent_probe_id=UUIDField().run_validation(params["agent"]))
    return rows


def _filter_api_checks(rows, params):
    if params.get("method") and params["method"] != "all":
        rows = rows.filter(method=params["method"].upper())
    state = params.get("status", "all")
    if state != "all":
        if state in ("disabled", "paused"):
            rows = rows.filter(enabled=False)
        elif state == "pending":
            rows = rows.filter(enabled=True, last_checked_at__isnull=True)
        else:
            rows = rows.filter(
                enabled=True,
                last_status__in=["fail", "error"]
                if state == "fail"
                else ["down", "error"]
                if state == "down"
                else [state],
            )
    return rows


def _filter_ssl_monitor(rows, params):
    state = params.get("status", "all")
    if state == "expiring":
        return rows.filter(is_valid=True, days_remaining__gte=0, days_remaining__lte=30)
    if state == "critical":
        return rows.filter(is_valid=True, days_remaining__gte=0, days_remaining__lte=7)
    if state == "expired":
        return rows.filter(days_remaining__lt=0)
    if state == "invalid":
        return rows.filter(is_valid=False, last_scanned_at__isnull=False)
    if state == "unmeasured":
        return rows.filter(last_scanned_at__isnull=True)
    return rows


def _filter_domain(rows, params):
    state = params.get("status", "all")
    if state == "expiring":
        return rows.filter(days_until_expiration__gte=0, days_until_expiration__lte=30, error_message="")
    if state == "expired":
        return rows.filter(days_until_expiration__lt=0, error_message="")
    if state == "error":
        return rows.exclude(error_message="")
    if state == "unmeasured":
        return rows.filter(last_scanned_at__isnull=True)
    return rows


def _filter_dns_monitor(rows, params):
    if params.get("type") and params["type"] != "all":
        rows = rows.filter(record_type=params["type"].upper())
    state = params.get("status", "all")
    if state != "all":
        rows = rows.filter(last_attempt_status=state)
    return rows


def _filter_security_headers(rows, params):
    grade = params.get("grade", "all")
    if grade in ("paused", "disabled"):
        return rows.filter(enabled=False)
    if grade == "healthy":
        return rows.filter(enabled=True, last_score__gte=70, info_leak_detected=False, last_checked_at__isnull=False)
    if grade == "warning":
        return rows.filter(enabled=True, last_checked_at__isnull=False).filter(
            Q(last_score__gte=50, last_score__lt=70) | Q(last_score__gte=70, info_leak_detected=True)
        )
    if grade == "critical":
        return rows.filter(enabled=True, last_score__lt=50, last_checked_at__isnull=False)
    if grade == "unmeasured":
        return rows.filter(enabled=True, last_checked_at__isnull=True)
    if grade == "grade_a":
        return rows.filter(enabled=True, last_score__gte=80, last_checked_at__isnull=False)
    if grade == "grade_bc":
        return rows.filter(enabled=True, last_score__gte=60, last_score__lt=80, last_checked_at__isnull=False)
    if grade == "grade_df":
        return rows.filter(enabled=True, last_score__lt=60, last_checked_at__isnull=False)
    return rows


def _filter_probe(rows, params):
    lifecycle = params.get("lifecycle", "active")
    if lifecycle == "revoked":
        rows = rows.filter(revoked_at__isnull=False)
    elif lifecycle != "all":
        rows = rows.filter(revoked_at__isnull=True)
    cutoff = timezone.now() - timedelta(seconds=45)
    if lifecycle == "connected":
        rows = rows.filter(last_heartbeat__gte=cutoff)
    elif lifecycle == "disconnected":
        rows = rows.filter(last_heartbeat__lt=cutoff)
    elif lifecycle == "pending_connection":
        rows = rows.filter(last_heartbeat__isnull=True)
    return rows


# Open/Closed registry: register new connectivity modules here without modifying `filtered()`.
MODULE_FILTERS = {
    "monitoring": _filter_monitoring,
    "api_checks": _filter_api_checks,
    "ssl_monitor": _filter_ssl_monitor,
    "domain": _filter_domain,
    "dns_monitor": _filter_dns_monitor,
    "security_headers": _filter_security_headers,
    "probe": _filter_probe,
}


def filtered(rows, params, module):
    search = params.get("search", "").strip()
    if len(search) > 254:
        raise ValidationError({"search": "Búsqueda demasiado larga."})
    if search:
        lookup = Q()
        for field in SEARCHABLE_BY_MODULE.get(module, ()):
            lookup |= Q(**{field + "__icontains": search})
        if lookup:
            rows = rows.filter(lookup)

    module_filter = MODULE_FILTERS.get(module)
    if module_filter is not None:
        rows = module_filter(rows, params)

    ordering = params.get("ordering", "-created_at")
    if ordering not in ALLOWED_ORDERING or ordering.lstrip("-") not in {f.name for f in rows.model._meta.fields}:
        ordering = "-created_at"
    return rows.order_by(ordering, "id")


def directory(rows, request, serializer, module):
    summary = None
    if module == "monitoring" and "page" in request.query_params:
        guardian_paused = Q(runner_type="agent", agent_probe__enabled=False)
        active_q = Q(enabled=True) & ~guardian_paused
        summary = rows.aggregate(
            total=Count("pk"),
            up=Count("pk", filter=active_q & Q(last_status="up")),
            slow=Count("pk", filter=active_q & Q(last_status="slow")),
            down=Count("pk", filter=active_q & Q(last_status__in=["down", "error"])),
            paused=Count("pk", filter=Q(enabled=False) | guardian_paused),
        )
    rows = filtered(rows, request.query_params, module)
    if request.query_params.get("export") == "csv":
        stream = io.StringIO()
        writer = csv.writer(stream)
        fields = FIELDS[module]
        writer.writerow(fields)
        for item in rows.iterator(chunk_size=250):
            values = []
            for field in fields:
                value = getattr(item, field, None)
                if value is None:
                    value = ""
                if field in ("url", "endpoint") and str(value).startswith(("https://", "http://")):
                    p = urlsplit(str(value))
                    value = urlunsplit((p.scheme, p.netloc, p.path, "", ""))
                if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@")):
                    value = "'" + value
                values.append(value)
            writer.writerow(values)
        response = HttpResponse(stream.getvalue(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="sentinel-{module}.csv"'
        return response
    meta = None
    if "page" in request.query_params:
        rows, meta = paginate(rows, request)
        if summary:
            meta["summary"] = summary
            meta["summary_scope"] = "organization_before_filters"
    return directory_response(serializer(rows, many=True, context={"request": request}).data, meta)
