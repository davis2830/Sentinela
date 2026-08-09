from rest_framework import serializers
from .models import StatusPageConfig, ScheduledMaintenance


class StatusPageConfigSerializer(serializers.ModelSerializer):
    """Serializer for StatusPageConfig model."""

    class Meta:
        model = StatusPageConfig
        fields = (
            "id",
            "organization",
            "company_name",
            "slug",
            "description",
            "logo_url",
            "is_public",
            "support_email",
            "monitored_targets",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization", "created_at", "updated_at")


class StatusPageConfigUpdateSerializer(serializers.Serializer):
    """Serializer for updating Status Page settings."""

    company_name = serializers.CharField(max_length=255, required=False)
    slug = serializers.CharField(max_length=100, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    logo_url = serializers.CharField(required=False, allow_blank=True)
    is_public = serializers.BooleanField(required=False)
    support_email = serializers.EmailField(required=False, allow_blank=True)
    monitored_targets = serializers.ListField(child=serializers.CharField(), required=False)


class ScheduledMaintenanceSerializer(serializers.ModelSerializer):
    """Serializer for ScheduledMaintenance model."""

    class Meta:
        model = ScheduledMaintenance
        fields = (
            "id",
            "organization",
            "title",
            "description",
            "status",
            "start_time",
            "end_time",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization", "created_at", "updated_at")


class ScheduledMaintenanceCreateSerializer(serializers.Serializer):
    """Serializer for creating/updating a maintenance window."""

    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    status = serializers.ChoiceField(
        choices=["scheduled", "in_progress", "completed", "cancelled"], default="scheduled"
    )
    start_time = serializers.DateTimeField()
    end_time = serializers.DateTimeField()
