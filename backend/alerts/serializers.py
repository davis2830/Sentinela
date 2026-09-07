from rest_framework import serializers

from .models import Alert, AlertRule

ALL_CONDITIONS = [
    "ssl_expiring",
    "ssl_grade_below",
    "ssl_invalid",
    "uptime_below",
    "status_down",
    "response_time_above",
    "dns_changed",
    "dns_latency_above",
    "domain_expiring",
    "domain_unlocked",
    "security_score_below",
    "security_leak_detected",
    "api_check_failed",
    "api_latency_above",
]

TARGET_TYPES = ["ssl", "monitoring", "dns", "domain", "api_check", "security_headers"]


class AlertRuleSerializer(serializers.ModelSerializer):
    """Serializer for AlertRule model."""

    class Meta:
        model = AlertRule
        fields = (
            "id",
            "organization",
            "name",
            "target_type",
            "condition",
            "threshold",
            "severity",
            "enabled",
            "target_id",
            "snoozed_until",
            "cooldown_minutes",
            "auto_resolve",
            "last_triggered_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization",
            "last_triggered_at",
            "created_at",
            "updated_at",
        )


class AlertRuleCreateSerializer(serializers.Serializer):
    """Serializer for alert rule creation."""

    name = serializers.CharField(max_length=255)
    target_type = serializers.ChoiceField(choices=TARGET_TYPES)
    condition = serializers.ChoiceField(choices=ALL_CONDITIONS)
    threshold = serializers.FloatField(default=0)
    severity = serializers.ChoiceField(
        choices=["critical", "warning", "info"], default="warning"
    )
    enabled = serializers.BooleanField(default=True)
    target_id = serializers.UUIDField(required=False, allow_null=True)
    snoozed_until = serializers.DateTimeField(required=False, allow_null=True)
    cooldown_minutes = serializers.IntegerField(default=15, required=False)
    auto_resolve = serializers.BooleanField(default=True, required=False)


class AlertRuleUpdateSerializer(serializers.Serializer):
    """Serializer for alert rule updates."""

    name = serializers.CharField(max_length=255, required=False)
    target_type = serializers.ChoiceField(choices=TARGET_TYPES, required=False)
    condition = serializers.ChoiceField(choices=ALL_CONDITIONS, required=False)
    threshold = serializers.FloatField(required=False)
    severity = serializers.ChoiceField(
        choices=["critical", "warning", "info"], required=False
    )
    enabled = serializers.BooleanField(required=False)
    target_id = serializers.UUIDField(required=False, allow_null=True)
    snoozed_until = serializers.DateTimeField(required=False, allow_null=True)
    cooldown_minutes = serializers.IntegerField(required=False)
    auto_resolve = serializers.BooleanField(required=False)


class AlertRuleSimulateSerializer(serializers.Serializer):
    """Serializer for simulating an alert rule."""

    target_type = serializers.ChoiceField(choices=TARGET_TYPES)
    condition = serializers.ChoiceField(choices=ALL_CONDITIONS)
    threshold = serializers.FloatField(default=0)
    target_id = serializers.UUIDField(required=False, allow_null=True)


class AlertSerializer(serializers.ModelSerializer):
    """Serializer for Alert model with smart telemetry and incident info."""

    incident_id = serializers.SerializerMethodField()
    incident_title = serializers.SerializerMethodField()

    class Meta:
        model = Alert
        fields = (
            "id",
            "organization",
            "rule",
            "title",
            "message",
            "severity",
            "status",
            "target_type",
            "target_id",
            "occurrence_count",
            "last_seen_at",
            "is_flapping",
            "flapping_count",
            "snoozed_until",
            "auto_resolved",
            "metadata",
            "incident_id",
            "incident_title",
            "triggered_at",
            "resolved_at",
            "created_at",
        )
        read_only_fields = (
            "id",
            "organization",
            "rule",
            "title",
            "message",
            "severity",
            "target_type",
            "target_id",
            "occurrence_count",
            "last_seen_at",
            "is_flapping",
            "flapping_count",
            "snoozed_until",
            "auto_resolved",
            "metadata",
            "triggered_at",
            "created_at",
        )

    def get_incident_id(self, obj):
        from incidents.models import IncidentAlert
        link = IncidentAlert.objects.filter(alert_id=obj.id).first()
        return str(link.incident_id) if link else None

    def get_incident_title(self, obj):
        from incidents.models import IncidentAlert
        link = IncidentAlert.objects.filter(alert_id=obj.id).select_related("incident").first()
        return link.incident.title if link and link.incident else None


class AlertUpdateSerializer(serializers.Serializer):
    """Serializer for alert status updates."""

    status = serializers.ChoiceField(
        choices=["active", "acknowledged", "resolved"]
    )