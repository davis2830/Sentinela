from rest_framework import serializers
from common.scan_serializers import ScanAvailabilitySerializer, AvailabilityListSerializer

from .models import SecurityHeaderResult, SecurityHeaderTarget


class SecurityHeaderTargetSerializer(ScanAvailabilitySerializer):
    """Serializer for SecurityHeaderTarget model with prefetched scan telemetry and alert context."""

    last_error_message = serializers.SerializerMethodField()
    headers_found_count = serializers.SerializerMethodField()
    headers_missing_count = serializers.SerializerMethodField()
    recent_results = serializers.SerializerMethodField()
    alert_summary = serializers.SerializerMethodField()

    def _get_results_desc(self, instance: SecurityHeaderTarget) -> list[SecurityHeaderResult]:
        cached = getattr(instance, "_cached_header_results_desc", None)
        if cached is not None:
            return cached
        if hasattr(instance, "prefetched_recent_results"):
            rows = list(instance.prefetched_recent_results)[:12]
        else:
            rows = list(instance.results.order_by("-checked_at")[:12])
        instance._cached_header_results_desc = rows
        return rows

    def get_last_error_message(self, instance: SecurityHeaderTarget):
        rows = self._get_results_desc(instance)
        if not rows:
            return None
        msg = (rows[0].error_message or "").strip()
        return msg or None

    def get_headers_found_count(self, instance: SecurityHeaderTarget):
        rows = self._get_results_desc(instance)
        if not rows or rows[0].error_message:
            return None
        found = rows[0].headers_found
        return len(found) if isinstance(found, (dict, list)) else 0

    def get_headers_missing_count(self, instance: SecurityHeaderTarget):
        rows = self._get_results_desc(instance)
        if not rows or rows[0].error_message:
            return None
        missing = rows[0].headers_missing
        return len(missing) if isinstance(missing, (dict, list)) else 0

    def get_recent_results(self, instance: SecurityHeaderTarget):
        rows = self._get_results_desc(instance)[:12]
        return [
            {
                "id": str(r.id),
                "score": r.score,
                "grade": r.grade,
                "response_time_ms": r.response_time_ms,
                "error_message": (r.error_message or "").strip() or None,
                "leaks_count": len(r.info_leaks) if isinstance(r.info_leaks, dict) else 0,
                "checked_at": r.checked_at.isoformat() if r.checked_at else None,
            }
            for r in reversed(rows)
        ]

    def get_alert_summary(self, instance: SecurityHeaderTarget):
        from alerts.models import AlertRule
        from notifications.models import NotificationChannel

        org_id = instance.organization_id
        rules_cache = self.context.setdefault("_sec_headers_org_rules", {})
        if org_id not in rules_cache:
            rules_cache[org_id] = list(
                AlertRule.objects.filter(
                    organization_id=org_id,
                    target_type=AlertRule.TargetType.SECURITY_HEADERS,
                    enabled=True,
                ).only("id", "name", "condition", "threshold", "severity", "target_id", "snoozed_until")
            )
        channels_cache = self.context.setdefault("_sec_headers_org_channels", {})
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

    class Meta:
        list_serializer_class = AvailabilityListSerializer
        model = SecurityHeaderTarget
        fields = (
            "scan_availability",
            "id",
            "organization",
            "name",
            "url",
            "enabled",
            "last_checked_at",
            "last_score",
            "last_grade",
            "last_response_time_ms",
            "has_hsts",
            "has_csp",
            "has_xfo",
            "info_leak_detected",
            "server_header",
            "powered_by_header",
            "last_error_message",
            "headers_found_count",
            "headers_missing_count",
            "recent_results",
            "alert_summary",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization",
            "last_checked_at",
            "last_score",
            "last_grade",
            "last_response_time_ms",
            "has_hsts",
            "has_csp",
            "has_xfo",
            "info_leak_detected",
            "server_header",
            "powered_by_header",
            "last_error_message",
            "headers_found_count",
            "headers_missing_count",
            "recent_results",
            "alert_summary",
            "created_at",
            "updated_at",
        )


class SecurityHeaderTargetCreateSerializer(serializers.Serializer):
    """Serializer for target creation."""

    name = serializers.CharField(max_length=255)
    url = serializers.CharField(max_length=500)
    enabled = serializers.BooleanField(default=True)

    def validate(self, attrs):
        url = attrs.get("url")
        if url:
            from common.security import validate_safe_public_url

            validate_safe_public_url(url)
        return attrs


class SecurityHeaderTargetUpdateSerializer(serializers.Serializer):
    """Serializer for target updates; revalidates SSRF whenever URL changes."""

    name = serializers.CharField(max_length=255, required=False)
    url = serializers.CharField(max_length=500, required=False)
    enabled = serializers.BooleanField(required=False)

    def validate(self, attrs):
        url = attrs.get("url")
        existing_url = self.context.get("existing_url")
        if url and (not existing_url or url.strip() != existing_url.strip()):
            from common.security import validate_safe_public_url

            validate_safe_public_url(url)
        return attrs


class SecurityHeaderResultSerializer(serializers.ModelSerializer):
    """Serializer for SecurityHeaderResult model."""

    class Meta:
        model = SecurityHeaderResult
        fields = (
            "id",
            "target",
            "score",
            "grade",
            "response_time_ms",
            "headers_found",
            "headers_missing",
            "directives_analysis",
            "info_leaks",
            "raw_headers",
            "error_message",
            "checked_at",
            "created_at",
        )
        read_only_fields = ("id", "target", "created_at")
