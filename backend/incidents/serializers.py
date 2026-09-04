from rest_framework import serializers

from .models import Incident, IncidentAlert, IncidentTimelineEvent


class IncidentSerializer(serializers.ModelSerializer):
    """Serializer for Incident model with enterprise tracking fields."""

    alerts_count = serializers.SerializerMethodField()
    duration_minutes = serializers.SerializerMethodField()

    class Meta:
        model = Incident
        fields = (
            "id",
            "organization",
            "title",
            "description",
            "status",
            "priority",
            "assigned_to",
            "assigned_to_name",
            "impacted_service",
            "target_type",
            "target_id",
            "root_cause",
            "resolution_summary",
            "preventive_actions",
            "opened_at",
            "acknowledged_at",
            "mitigated_at",
            "resolved_at",
            "closed_at",
            "alerts_count",
            "duration_minutes",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization",
            "opened_at",
            "acknowledged_at",
            "mitigated_at",
            "resolved_at",
            "closed_at",
            "alerts_count",
            "duration_minutes",
            "created_at",
            "updated_at",
        )

    def get_alerts_count(self, obj):
        return obj.incident_alerts.count()

    def get_duration_minutes(self, obj):
        from django.utils import timezone
        end = obj.resolved_at or obj.closed_at or timezone.now()
        if obj.opened_at:
            diff = (end - obj.opened_at).total_seconds() / 60.0
            return max(1, round(diff))
        return 0


class IncidentCreateSerializer(serializers.Serializer):
    """Serializer for incident creation."""

    title = serializers.CharField(max_length=500)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    priority = serializers.ChoiceField(
        choices=["critical", "high", "medium", "low"], default="medium"
    )
    impacted_service = serializers.CharField(required=False, allow_blank=True, default="")
    target_type = serializers.CharField(required=False, allow_blank=True, default="")
    target_id = serializers.UUIDField(required=False, allow_null=True)
    assigned_to = serializers.UUIDField(required=False, allow_null=True)


class IncidentUpdateSerializer(serializers.Serializer):
    """Serializer for incident updates."""

    status = serializers.ChoiceField(
        choices=["open", "investigating", "identified", "mitigated", "resolved", "closed"],
        required=False,
    )
    priority = serializers.ChoiceField(
        choices=["critical", "high", "medium", "low"], required=False
    )
    description = serializers.CharField(required=False, allow_blank=True)
    impacted_service = serializers.CharField(required=False, allow_blank=True)
    assigned_to = serializers.UUIDField(required=False, allow_null=True)
    root_cause = serializers.CharField(required=False, allow_blank=True)
    resolution_summary = serializers.CharField(required=False, allow_blank=True)
    preventive_actions = serializers.CharField(required=False, allow_blank=True)


class IncidentRCASerializer(serializers.Serializer):
    """Serializer for updating Root Cause Analysis (RCA) and post-mortem."""

    root_cause = serializers.CharField(required=True)
    resolution_summary = serializers.CharField(required=False, allow_blank=True, default="")
    preventive_actions = serializers.CharField(required=False, allow_blank=True, default="")


class IncidentAssignSerializer(serializers.Serializer):
    """Serializer for assigning an incident to a user."""

    user_id = serializers.UUIDField(required=False, allow_null=True)


class IncidentBulkActionSerializer(serializers.Serializer):
    """Serializer for bulk actions on incidents."""

    action = serializers.ChoiceField(choices=["status", "priority", "assign", "delete"])
    incident_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1)
    status = serializers.ChoiceField(
        choices=["open", "investigating", "identified", "mitigated", "resolved", "closed"],
        required=False,
    )
    priority = serializers.ChoiceField(
        choices=["critical", "high", "medium", "low"], required=False
    )
    user_id = serializers.UUIDField(required=False, allow_null=True)


class IncidentAlertSerializer(serializers.ModelSerializer):
    """Serializer for IncidentAlert model."""

    alert_title = serializers.SerializerMethodField()
    alert_severity = serializers.SerializerMethodField()
    alert_status = serializers.SerializerMethodField()
    alert_target_type = serializers.SerializerMethodField()
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
            "alert_target_type",
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

    def get_alert_target_type(self, obj):
        from alerts.models import Alert
        alert = Alert.objects.filter(id=obj.alert_id).first()
        return alert.target_type if alert else ""

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
            "actor_name",
            "occurred_at",
        )
        read_only_fields = ("id", "incident", "occurred_at")