from datetime import timedelta
import math
from django.utils import timezone
from rest_framework import serializers
from .schema import validate_contract
from common.scan_serializers import ScanAvailabilitySerializer, AvailabilityListSerializer

from .models import APICheckResult, APICheckTarget


def _describe_failure_reason(target: APICheckTarget, latest: APICheckResult | None) -> str | None:
    """Return a concise, factual Spanish reason for non-passing API check states."""
    if not target.enabled or latest is None or latest.status == "pass":
        return None
    if latest.status == "rate_limited" or (latest.http_status == 429 and target.expected_status != 429):
        return "429 · límite de velocidad"
    if latest.status == "error" or latest.http_status is None:
        msg = (latest.error_message or "").strip()
        low = msg.lower()
        if "timeout" in low or "tiempo" in low:
            return "sin respuesta · tiempo agotado"
        if "host" in low or "resuelve" in low or "dns" in low:
            return "sin respuesta · host no resuelve"
        if "política" in low or "bloqueado" in low:
            return "destino bloqueado por seguridad"
        return "sin respuesta · error de conexión"
    if latest.http_status != target.expected_status:
        return f"{latest.http_status} ≠ {target.expected_status}"
    if latest.schema_valid is False:
        failures = latest.schema_failures or []
        if failures:
            first = failures[0]
            if first.get("code") == "INVALID_JSON_OBJECT":
                return "respuesta no es JSON válido"
            field = first.get("field", "campo")
            if first.get("received") == "missing":
                extra = f" (+{len(failures) - 1})" if len(failures) > 1 else ""
                return f'schema: falta "{field}"{extra}'
            return f'schema: "{field}" ≠ {first.get("expected", "tipo")}'
        return "schema JSON inválido"
    if latest.headers_valid is False:
        return "headers esperados no coinciden"
    if latest.status == "slow" and latest.response_time_ms is not None:
        return f"{round(latest.response_time_ms)} ms > {target.expected_response_time_ms} ms"
    return None


def _percentile_95(values: list[float]) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    idx = max(0, min(len(ordered) - 1, math.ceil(0.95 * len(ordered)) - 1))
    return round(ordered[idx], 1)


class APICheckTargetSerializer(ScanAvailabilitySerializer):
    """Serializer for APICheckTarget model with real 24h telemetry and alert context."""

    failure_reason = serializers.SerializerMethodField()
    consecutive_failures = serializers.SerializerMethodField()
    failing_since = serializers.SerializerMethodField()
    last_schema_valid = serializers.SerializerMethodField()
    last_schema_failures = serializers.SerializerMethodField()
    recent_results = serializers.SerializerMethodField()
    uptime_24h = serializers.SerializerMethodField()
    p95_latency_24h = serializers.SerializerMethodField()
    failures_24h = serializers.SerializerMethodField()
    checks_24h = serializers.SerializerMethodField()
    alert_summary = serializers.SerializerMethodField()

    def _get_results_desc(self, instance: APICheckTarget) -> list[APICheckResult]:
        cached = getattr(instance, "_cached_api_results_desc", None)
        if cached is not None:
            return cached
        if hasattr(instance, "prefetched_recent_results"):
            rows = list(instance.prefetched_recent_results)
        else:
            since_24h = timezone.now() - timedelta(hours=24)
            rows = list(instance.results.filter(checked_at__gte=since_24h).order_by("-checked_at")[:200])
            if not rows:
                rows = list(instance.results.order_by("-checked_at")[:12])
        instance._cached_api_results_desc = rows
        return rows

    def _get_results_24h(self, instance: APICheckTarget) -> list[APICheckResult]:
        cutoff = timezone.now() - timedelta(hours=24)
        return [r for r in self._get_results_desc(instance) if r.checked_at and r.checked_at >= cutoff]

    def get_failure_reason(self, instance: APICheckTarget):
        rows = self._get_results_desc(instance)
        return _describe_failure_reason(instance, rows[0] if rows else None)

    def get_consecutive_failures(self, instance: APICheckTarget) -> int:
        if not instance.enabled:
            return 0
        count = 0
        for row in self._get_results_desc(instance):
            if row.status in ("fail", "error", "rate_limited"):
                count += 1
            else:
                break
        return count

    def get_failing_since(self, instance: APICheckTarget):
        if not instance.enabled:
            return None
        rows = self._get_results_desc(instance)
        if not rows or rows[0].status not in ("fail", "error", "rate_limited"):
            return None
        earliest = rows[0].checked_at
        for row in rows[1:]:
            if row.status in ("fail", "error", "rate_limited"):
                earliest = row.checked_at
            else:
                break
        return earliest.isoformat() if earliest else None

    def get_last_schema_valid(self, instance: APICheckTarget):
        rows = self._get_results_desc(instance)
        return rows[0].schema_valid if rows else None

    def get_last_schema_failures(self, instance: APICheckTarget):
        rows = self._get_results_desc(instance)
        return (rows[0].schema_failures or []) if rows else []

    def get_recent_results(self, instance: APICheckTarget):
        rows = self._get_results_desc(instance)[:12]
        return [
            {
                "id": str(r.id),
                "status": r.status,
                "http_status": r.http_status,
                "response_time_ms": r.response_time_ms,
                "schema_valid": r.schema_valid,
                "headers_valid": r.headers_valid,
                "reason": _describe_failure_reason(instance, r),
                "checked_at": r.checked_at.isoformat() if r.checked_at else None,
            }
            for r in reversed(rows)
        ]

    def get_checks_24h(self, instance: APICheckTarget) -> int:
        return len(self._get_results_24h(instance))

    def get_failures_24h(self, instance: APICheckTarget) -> int:
        return sum(1 for r in self._get_results_24h(instance) if r.status in ("fail", "error"))

    def get_uptime_24h(self, instance: APICheckTarget):
        rows = self._get_results_24h(instance)
        if not rows:
            return None
        ok = sum(1 for r in rows if r.status in ("pass", "slow"))
        return round((ok / len(rows)) * 100, 1)

    def get_p95_latency_24h(self, instance: APICheckTarget):
        latencies = [
            float(r.response_time_ms)
            for r in self._get_results_24h(instance)
            if r.response_time_ms is not None
        ]
        return _percentile_95(latencies)

    def get_alert_summary(self, instance: APICheckTarget):
        from alerts.models import AlertRule
        from notifications.models import NotificationChannel

        org_id = instance.organization_id
        rules_cache = self.context.setdefault("_api_org_rules", {})
        if org_id not in rules_cache:
            rules_cache[org_id] = list(
                AlertRule.objects.filter(
                    organization_id=org_id,
                    target_type=AlertRule.TargetType.API_CHECK,
                    enabled=True,
                ).only("id", "name", "condition", "threshold", "severity", "target_id", "snoozed_until")
            )
        channels_cache = self.context.setdefault("_api_org_channels", {})
        if org_id not in channels_cache:
            channels_cache[org_id] = list(
                NotificationChannel.objects.filter(
                    organization_id=org_id,
                    enabled=True,
                ).only("id", "name", "channel_type")
            )

        matched_rules = [
            {
                "id": str(r.pk),
                "name": r.name,
                "condition": r.condition,
                "threshold": r.threshold,
                "severity": r.severity,
                "snoozed_until": r.snoozed_until.isoformat() if r.snoozed_until else None,
            }
            for r in rules_cache[org_id]
            if r.target_id is None or str(r.target_id) == str(instance.pk)
        ]
        destinations = [
            {
                "id": str(ch.pk),
                "name": ch.name,
                "channel_type": ch.channel_type,
            }
            for ch in channels_cache[org_id]
        ]
        return {"rules": matched_rules, "destinations": destinations}

    def to_representation(self, instance):
        data = super().to_representation(instance)
        user = getattr(self.context.get("request"), "user", None)
        if (
            not user
            or not (user.is_staff or user.is_superuser)
            or getattr(getattr(self.context.get("request"), "auth", None), "scope", None) == "read"
        ):
            data["request_headers"] = {}
            data["request_body"] = {}
        return data

    class Meta:
        list_serializer_class = AvailabilityListSerializer
        model = APICheckTarget
        fields = (
            "scan_availability",
            "id",
            "organization",
            "name",
            "url",
            "method",
            "expected_status",
            "expected_response_time_ms",
            "expected_headers",
            "expected_schema",
            "request_headers",
            "request_body",
            "check_interval",
            "alert_after_failures",
            "enabled",
            "last_checked_at",
            "last_status",
            "last_response_time_ms",
            "last_http_status",
            "failure_reason",
            "consecutive_failures",
            "failing_since",
            "last_schema_valid",
            "last_schema_failures",
            "recent_results",
            "uptime_24h",
            "p95_latency_24h",
            "failures_24h",
            "checks_24h",
            "alert_summary",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization",
            "last_checked_at",
            "last_status",
            "last_response_time_ms",
            "last_http_status",
            "failure_reason",
            "consecutive_failures",
            "failing_since",
            "last_schema_valid",
            "last_schema_failures",
            "recent_results",
            "uptime_24h",
            "p95_latency_24h",
            "failures_24h",
            "checks_24h",
            "alert_summary",
            "created_at",
            "updated_at",
        )


class APICheckTargetCreateSerializer(serializers.Serializer):
    """Serializer for API check target creation."""

    name = serializers.CharField(max_length=255)
    url = serializers.CharField(max_length=500)
    method = serializers.ChoiceField(choices=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"], default="GET")
    expected_status = serializers.IntegerField(default=200, min_value=100, max_value=599)
    expected_response_time_ms = serializers.IntegerField(default=2000, min_value=1, max_value=120000)
    expected_headers = serializers.DictField(required=False, default=dict)
    expected_schema = serializers.DictField(required=False, default=dict)
    request_headers = serializers.DictField(required=False, default=dict)
    request_body = serializers.DictField(required=False, default=dict)
    check_interval = serializers.IntegerField(required=False, min_value=10)
    alert_after_failures = serializers.IntegerField(required=False, default=2, min_value=1, max_value=10)
    enabled = serializers.BooleanField(default=True)

    def validate_expected_schema(self, value):
        return validate_contract(value)

    def validate(self, attrs):
        if "check_interval" not in attrs:
            request = self.context.get("request")
            organization = getattr(getattr(request, "user", None), "organization", None)
            attrs["check_interval"] = (
                organization.get_plan_limits()["min_check_interval_seconds"] if organization else 300
            )
        url = attrs.get("url")
        if url:
            from common.security import validate_safe_public_url

            validate_safe_public_url(url)
        return attrs


class APICheckTargetUpdateSerializer(serializers.Serializer):
    """Serializer for API check target updates."""

    name = serializers.CharField(max_length=255, required=False)
    url = serializers.CharField(max_length=500, required=False)
    method = serializers.ChoiceField(choices=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"], required=False)
    expected_status = serializers.IntegerField(required=False, min_value=100, max_value=599)
    expected_response_time_ms = serializers.IntegerField(required=False, min_value=1, max_value=120000)
    expected_headers = serializers.DictField(required=False)
    expected_schema = serializers.DictField(required=False)
    request_headers = serializers.DictField(required=False)
    request_body = serializers.DictField(required=False)
    check_interval = serializers.IntegerField(required=False, min_value=10)
    alert_after_failures = serializers.IntegerField(required=False, min_value=1, max_value=10)
    enabled = serializers.BooleanField(required=False)

    def validate_expected_schema(self, value):
        return validate_contract(value)

    def validate(self, attrs):
        url = attrs.get("url")
        if url:
            from common.security import validate_safe_public_url

            validate_safe_public_url(url)
        return attrs


class APICheckResultSerializer(serializers.ModelSerializer):
    """Serializer for APICheckResult model."""

    class Meta:
        model = APICheckResult
        fields = (
            "id",
            "target",
            "status",
            "http_status",
            "response_time_ms",
            "json_valid",
            "schema_valid",
            "schema_failures",
            "headers_valid",
            "response_headers",
            "response_preview",
            "error_message",
            "checked_at",
            "created_at",
        )
        read_only_fields = ("id", "target", "created_at")
