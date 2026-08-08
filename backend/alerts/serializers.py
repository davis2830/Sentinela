from rest_framework import serializers

from .models import Alert, AlertRule


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
    target_type = serializers.ChoiceField(
        choices=["ssl", "monitoring", "dns", "domain", "api_check", "security_headers"]
    )
    condition = serializers.ChoiceField(
        choices=[
            "ssl_expiring",
            "uptime_below",
            "status_down",
            "response_time_above",
            "dns_changed",
            "domain_expiring",
            "security_score_below",
            "api_check_failed",
        ]
    )
    threshold = serializers.FloatField(default=0)
    severity = serializers.ChoiceField(
        choices=["critical", "warning", "info"], default="warning"
    )
    enabled = serializers.BooleanField(default=True)
    target_id = serializers.UUIDField(required=False, allow_null=True)


class AlertRuleUpdateSerializer(serializers.Serializer):
    """Serializer for alert rule updates."""

    name = serializers.CharField(max_length=255, required=False)
    target_type = serializers.ChoiceField(
        choices=["ssl", "monitoring", "dns", "domain", "api_check", "security_headers"],
        required=False,
    )
    condition = serializers.ChoiceField(
        choices=[
            "ssl_expiring",
            "uptime_below",
            "status_down",
            "response_time_above",
            "dns_changed",
            "domain_expiring",
            "security_score_below",
            "api_check_failed",
        ],
        required=False,
    )
    threshold = serializers.FloatField(required=False)
    severity = serializers.ChoiceField(
        choices=["critical", "warning", "info"], required=False
    )
    enabled = serializers.BooleanField(required=False)
    target_id = serializers.UUIDField(required=False, allow_null=True)


class AlertSerializer(serializers.ModelSerializer):
    """Serializer for Alert model with incident correlation info."""

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