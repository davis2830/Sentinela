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
        choices=["open", "investigating", "resolved", "closed"], required=False
    )
    priority = serializers.ChoiceField(
        choices=["critical", "high", "medium", "low"], required=False
    )
    description = serializers.CharField(required=False)


class IncidentAlertSerializer(serializers.ModelSerializer):
    """Serializer for IncidentAlert model."""

    class Meta:
        model = IncidentAlert
        fields = ("id", "incident", "alert_id", "added_at")
        read_only_fields = ("id", "incident", "added_at")


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