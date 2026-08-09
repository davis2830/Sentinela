from rest_framework import serializers

from .models import Incident, IncidentAlert, IncidentTimelineEvent


class IncidentSerializer(serializers.ModelSerializer):
    """Serializer for Incident model."""

    alerts_count = serializers.SerializerMethodField()

    class Meta:
        model = Incident
        fields = (
            "id",
            "organization",
            "title",
            "description",
            "status",
            "priority",
            "opened_at",
            "closed_at",
            "alerts_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization",
            "opened_at",
            "closed_at",
            "alerts_count",
            "created_at",
            "updated_at",
        )

    def get_alerts_count(self, obj):
        return obj.incident_alerts.count()


class IncidentCreateSerializer(serializers.Serializer):
    """Serializer for incident creation."""

    title = serializers.CharField(max_length=500)
    description = serializers.CharField(required=False, default="")
    priority = serializers.ChoiceField(
        choices=["critical", "high", "medium", "low"], default="medium"
    )


class IncidentUpdateSerializer(serializers.Serializer):
    """Serializer for incident updates."""

    status = serializers.ChoiceField(
        choices=["open", "investigating", "identified", "mitigated", "resolved", "closed"], required=False
    )
    priority = serializers.ChoiceField(
        choices=["critical", "high", "medium", "low"], required=False
    )
    description = serializers.CharField(required=False)


class IncidentAlertSerializer(serializers.ModelSerializer):
    """Serializer for IncidentAlert model."""

    alert_title = serializers.SerializerMethodField()
    alert_severity = serializers.SerializerMethodField()
    alert_status = serializers.SerializerMethodField()
    alert_triggered_at = serializers.SerializerMethodField()

    class Meta:
        model = IncidentAlert
        fields = (
            "id",
            "incident",
            "alert_id",
            "alert_title",
            "alert_severity",
            "alert_status",
            "alert_triggered_at",
            "added_at",
        )
        read_only_fields = ("id", "incident", "added_at")

    def get_alert_title(self, obj):
        from alerts.models import Alert
        alert = Alert.objects.filter(id=obj.alert_id).first()
        return alert.title if alert else f"Alerta {str(obj.alert_id)[:8]}"

    def get_alert_severity(self, obj):
        from alerts.models import Alert
        alert = Alert.objects.filter(id=obj.alert_id).first()
        return alert.severity if alert else "warning"

    def get_alert_status(self, obj):
        from alerts.models import Alert
        alert = Alert.objects.filter(id=obj.alert_id).first()
        return alert.status if alert else "active"

    def get_alert_triggered_at(self, obj):
        from alerts.models import Alert
        alert = Alert.objects.filter(id=obj.alert_id).first()
        return alert.triggered_at.isoformat() if alert and alert.triggered_at else obj.added_at.isoformat()


class AddAlertSerializer(serializers.Serializer):
    """Serializer for linking an alert to an incident."""

    alert_id = serializers.UUIDField()


class AddNoteSerializer(serializers.Serializer):
    """Serializer for adding a note to the timeline."""

    note = serializers.CharField()


class IncidentTimelineEventSerializer(serializers.ModelSerializer):
    """Serializer for IncidentTimelineEvent model."""

    class Meta:
        model = IncidentTimelineEvent
        fields = (
            "id",
            "incident",
            "event_type",
            "description",
            "old_value",
            "new_value",
            "occurred_at",
        )
        read_only_fields = ("id", "incident", "occurred_at")