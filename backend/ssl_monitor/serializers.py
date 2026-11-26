from rest_framework import serializers
from common.scan_serializers import ScanAvailabilitySerializer, AvailabilityListSerializer

from .models import SSLCertificate


class SSLCertificateSerializer(ScanAvailabilitySerializer):
    """Serializer for SSLCertificate model."""

    linked_targets = serializers.SerializerMethodField()
    suggested_targets = serializers.SerializerMethodField()
    alert_summary = serializers.SerializerMethodField()

    def get_linked_targets(self, instance):
        # Use prefetched targetcoverage_set when available to avoid N+1 queries
        coverages = getattr(instance, "_prefetched_objects_cache", {}).get("targetcoverage_set")
        if coverages is None:
            from monitoring.models import TargetCoverage

            coverages = TargetCoverage.objects.filter(
                ssl=instance,
                target__organization_id=instance.organization_id,
            ).select_related("target")
        result = []
        for cov in coverages:
            target = getattr(cov, "target", None)
            if target is not None and target.organization_id == instance.organization_id:
                result.append(
                    {
                        "id": str(target.pk),
                        "name": target.name,
                        "endpoint": target.endpoint,
                        "enabled": bool(target.enabled),
                    }
                )
        return result

    def get_suggested_targets(self, instance):
        linked = self.get_linked_targets(instance)
        linked_ids = {t["id"] for t in linked}
        only_paused_linked = bool(linked) and all(not t.get("enabled", True) for t in linked)
        if linked and not only_paused_linked:
            return []
        from monitoring.models import MonitoringTarget
        from monitoring.coverage import matches

        # Reuse cached org HTTPS targets when serializing a list
        cache = self.context.setdefault("_ssl_org_targets", {})
        org_id = instance.organization_id
        if org_id not in cache:
            cache[org_id] = list(
                MonitoringTarget.objects.filter(
                    organization_id=org_id,
                    target_type__in=("http", "https"),
                    runner_type="cloud",
                    agent_probe__isnull=True,
                )
                .order_by("-enabled", "created_at")
                .only(
                    "id",
                    "organization_id",
                    "name",
                    "endpoint",
                    "enabled",
                    "target_type",
                    "runner_type",
                    "agent_probe_id",
                )
            )
        suggestions = []
        for target in cache[org_id]:
            if str(target.pk) in linked_ids:
                continue
            if only_paused_linked and not target.enabled:
                continue
            if matches(target, "ssl", instance):
                suggestions.append(
                    {
                        "id": str(target.pk),
                        "name": target.name,
                        "endpoint": target.endpoint,
                        "enabled": bool(target.enabled),
                    }
                )
        return suggestions

    def get_alert_summary(self, instance):
        from alerts.models import AlertRule
        from notifications.models import NotificationChannel

        org_id = instance.organization_id
        rules_cache = self.context.setdefault("_ssl_org_rules", {})
        if org_id not in rules_cache:
            rules_cache[org_id] = list(
                AlertRule.objects.filter(
                    organization_id=org_id,
                    target_type=AlertRule.TargetType.SSL,
                    enabled=True,
                ).only("id", "name", "condition", "threshold", "severity", "target_id", "snoozed_until")
            )
        channels_cache = self.context.setdefault("_ssl_org_channels", {})
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
        if not instance.last_scanned_at or instance.error_message:
            data["security_grade"] = ""
        return data

    class Meta:
        list_serializer_class = AvailabilityListSerializer
        model = SSLCertificate
        fields = (
            "scan_availability",
            "id",
            "organization",
            "domain",
            "port",
            "issuer",
            "subject",
            "issued_at",
            "expiration_date",
            "security_grade",
            "algorithm",
            "key_info",
            "fingerprint",
            "days_remaining",
            "is_valid",
            "last_scanned_at",
            "last_successful_at",
            "last_error_code",
            "error_message",
            "san_domains",
            "issuance_history",
            "tls_version",
            "linked_targets",
            "suggested_targets",
            "alert_summary",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization",
            "issuer",
            "subject",
            "issued_at",
            "expiration_date",
            "security_grade",
            "algorithm",
            "key_info",
            "fingerprint",
            "days_remaining",
            "is_valid",
            "last_scanned_at",
            "last_successful_at",
            "last_error_code",
            "error_message",
            "san_domains",
            "issuance_history",
            "tls_version",
            "linked_targets",
            "suggested_targets",
            "alert_summary",
            "created_at",
            "updated_at",
        )


class SSLCertificateCreateSerializer(serializers.Serializer):
    """Serializer for certificate creation."""

    domain = serializers.CharField(max_length=500)
    port = serializers.IntegerField(default=443, required=False)

    def validate(self, attrs):
        domain = attrs.get("domain")
        port = attrs.get("port", 443)
        if domain:
            from common.security import validate_safe_public_url

            validate_safe_public_url(f"https://{domain}:{port}")
        return attrs
