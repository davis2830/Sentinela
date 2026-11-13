"""Compatible, tenant-scoped directories: paginate before serializing relations."""

import csv
import io
from urllib.parse import urlsplit, urlunsplit
from django.db.models import Q, Count
from django.http import HttpResponse
from rest_framework.exceptions import ValidationError
from .pagination import paginate, directory_response
from django.utils import timezone
from datetime import timedelta

FIELDS = {
    "monitoring": ("name", "endpoint", "target_type", "last_status", "last_checked_at"),
    "ssl_monitor": ("domain", "port", "is_valid", "days_remaining", "last_scanned_at"),
    "dns_monitor": ("domain", "record_type", "value", "last_attempt_status", "last_scanned_at"),
    "domain": ("domain", "registrar", "expiration_date", "last_scanned_at", "error_message"),
    "api_checks": ("name", "url", "method", "last_status", "last_checked_at"),
    "security_headers": ("name", "url", "last_score", "last_grade", "last_checked_at"),
    "probe": ("name", "hostname", "version", "last_heartbeat", "revoked_at"),
}


def filtered(rows, params, module):
    fields = FIELDS[module]
    search = params.get("search", "").strip()
    if len(search) > 254:
        raise ValidationError({"search": "Búsqueda demasiado larga."})
    if search:
        lookup = Q()
        searchable = {
            "ssl_monitor": ("domain", "issuer", "algorithm"),
            "dns_monitor": ("domain", "value"),
            "security_headers": ("name", "url", "server_header", "powered_by_header"),
        }.get(module, fields)
        for field in searchable:
            if field in (
                "name",
                "endpoint",
                "domain",
                "registrar",
                "url",
                "hostname",
                "issuer",
                "algorithm",
                "value",
                "server_header",
                "powered_by_header",
            ):
                lookup |= Q(**{field + "__icontains": search})
        rows = rows.filter(lookup)
    for param, field in (("method", "method"), ("type", "target_type" if module == "monitoring" else "record_type")):
        if params.get(param) and params[param] != "all" and field in fields:
            value = params[param].upper() if module != "monitoring" else params[param].lower()
            rows = rows.filter(**{field: value})
    state = params.get("status", "all")
    if state != "all":
        if module in ("monitoring", "api_checks"):
            rows = (
                rows.filter(enabled=False)
                if state in ("disabled", "paused")
                else rows.filter(
                    enabled=True,
                    last_status__in=["fail", "error"]
                    if state == "fail"
                    else ["down", "error"]
                    if state == "down"
                    else [state],
                )
            )
        elif module == "ssl_monitor":
            if state == "expiring":
                rows = rows.filter(is_valid=True, days_remaining__gte=0, days_remaining__lte=30)
            elif state == "critical":
                rows = rows.filter(is_valid=True, days_remaining__gte=0, days_remaining__lte=7)
            elif state == "expired":
                rows = rows.filter(days_remaining__lt=0)
            elif state == "invalid":
                rows = rows.filter(is_valid=False, last_scanned_at__isnull=False)
            elif state == "unmeasured":
                rows = rows.filter(last_scanned_at__isnull=True)
        elif module == "domain":
            if state == "expiring":
                rows = rows.filter(days_until_expiration__gte=0, days_until_expiration__lte=30, error_message="")
            elif state == "expired":
                rows = rows.filter(days_until_expiration__lt=0, error_message="")
            elif state == "error":
                rows = rows.exclude(error_message="")
            elif state == "unmeasured":
                rows = rows.filter(last_scanned_at__isnull=True)
        elif module == "dns_monitor":
            rows = rows.filter(last_attempt_status=state)
    if module == "security_headers":
        grade = params.get("grade", "all")
        if grade == "healthy":
            rows = rows.filter(last_score__gte=70, info_leak_detected=False, last_checked_at__isnull=False)
        elif grade == "warning":
            rows = rows.filter(last_score__gte=50, last_score__lt=70)
        elif grade == "critical":
            rows = rows.filter(Q(last_score__lt=50) | Q(info_leak_detected=True))
        elif grade == "unmeasured":
            rows = rows.filter(last_checked_at__isnull=True)
        elif grade == "grade_a":
            rows = rows.filter(last_score__gte=80, last_checked_at__isnull=False)
        elif grade == "grade_bc":
            rows = rows.filter(last_score__gte=60, last_score__lt=80, last_checked_at__isnull=False)
        elif grade == "grade_df":
            rows = rows.filter(last_score__lt=60, last_checked_at__isnull=False)
    if module == "monitoring" and params.get("tag") not in (None, "", "all"):
        rows = rows.filter(tags__contains=[params["tag"]])
    if module == "monitoring" and params.get("agent"):
        from rest_framework.serializers import UUIDField

        rows = rows.filter(agent_probe_id=UUIDField().run_validation(params["agent"]))
    if module == "probe":
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
    ordering = params.get("ordering", "-created_at")
    allowed = {
        "name",
        "-name",
        "created_at",
        "-created_at",
        "domain",
        "-domain",
        "last_latency",
        "-last_latency",
        "last_status",
        "-last_status",
    }
    if ordering not in allowed or ordering.lstrip("-") not in {f.name for f in rows.model._meta.fields}:
        ordering = "-created_at"
    return rows.order_by(ordering, "id")


def directory(rows, request, serializer, module):
    summary = None
    if module == "monitoring" and "page" in request.query_params:
        summary = rows.aggregate(
            total=Count("pk"),
            up=Count("pk", filter=Q(enabled=True, last_status="up")),
            slow=Count("pk", filter=Q(enabled=True, last_status="slow")),
            down=Count("pk", filter=Q(enabled=True, last_status__in=["down", "error"])),
            paused=Count("pk", filter=Q(enabled=False)),
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
