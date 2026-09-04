from rest_framework import serializers
from .models import StatusPageConfig, ScheduledMaintenance, MaintenanceUpdate, StatusPageSubscriber


class MaintenanceUpdateSerializer(serializers.ModelSerializer):
    """Serializer for progress updates during maintenance."""

    class Meta:
        model = MaintenanceUpdate
        fields = ("id", "message", "status", "posted_at")
        read_only_fields = ("id", "posted_at")


class ScheduledMaintenanceSerializer(serializers.ModelSerializer):
    """Serializer for ScheduledMaintenance model with nested updates."""

    updates = MaintenanceUpdateSerializer(many=True, read_only=True)
    status_page_id = serializers.UUIDField(source="status_page.id", read_only=True, allow_null=True)
    status_page_name = serializers.CharField(source="status_page.company_name", read_only=True, allow_null=True)

    class Meta:
        model = ScheduledMaintenance
        fields = (
            "id",
            "organization",
            "status_page_id",
            "status_page_name",
            "title",
            "description",
            "status",
            "start_time",
            "end_time",
            "updates",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization", "created_at", "updated_at")


class ScheduledMaintenanceCreateSerializer(serializers.Serializer):
    """Serializer for creating/updating a maintenance window."""

    status_page_id = serializers.UUIDField(required=False, allow_null=True)
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    status = serializers.ChoiceField(
        choices=["scheduled", "in_progress", "completed", "cancelled"], default="scheduled"
    )
    start_time = serializers.DateTimeField()
    end_time = serializers.DateTimeField()
    initial_update = serializers.CharField(required=False, allow_blank=True, default="")


class MaintenanceUpdateCreateSerializer(serializers.Serializer):
    """Serializer for adding a live progress update to a maintenance."""

    message = serializers.CharField()
    status = serializers.ChoiceField(
        choices=["scheduled", "in_progress", "completed", "cancelled"], required=False
    )


class MaintenanceBulkActionSerializer(serializers.Serializer):
    """Serializer for bulk actions on scheduled maintenances."""

    action = serializers.ChoiceField(
        choices=["completed", "in_progress", "scheduled", "cancelled", "delete"]
    )
    maintenance_ids = serializers.ListField(
        child=serializers.UUIDField(), allow_empty=False
    )


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
            "website_url",
            "is_public",
            "is_default",
            "support_email",
            "custom_announcement",
            "announcement_type",
            "announcement_active",
            "show_uptime_pct",
            "show_latency_24h",
            "monitored_targets",
            "component_settings",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization", "created_at", "updated_at")


class StatusPageSummarySerializer(serializers.Serializer):
    """Compact summary serializer for Status Page Switcher and Directory."""

    id = serializers.UUIDField()
    company_name = serializers.CharField()
    slug = serializers.CharField()
    description = serializers.CharField(allow_blank=True)
    logo_url = serializers.CharField(allow_blank=True)
    website_url = serializers.CharField(allow_blank=True)
    support_email = serializers.CharField(allow_blank=True)
    is_public = serializers.BooleanField()
    is_default = serializers.BooleanField()
    published_components_count = serializers.IntegerField()
    subscribers_count = serializers.IntegerField()
    active_maintenances_count = serializers.IntegerField()
    announcement_active = serializers.BooleanField()
    created_at = serializers.DateTimeField()


class StatusPageCreateSerializer(serializers.Serializer):
    """Serializer for creating a new enterprise Status Page."""

    company_name = serializers.CharField(max_length=255)
    slug = serializers.SlugField(max_length=100)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    logo_url = serializers.CharField(required=False, allow_blank=True, default="")
    website_url = serializers.URLField(required=False, allow_blank=True, default="")
    support_email = serializers.EmailField(required=False, allow_blank=True, default="")
    is_public = serializers.BooleanField(default=True)
    is_default = serializers.BooleanField(default=False)
    clone_from_page_id = serializers.UUIDField(required=False, allow_null=True)


class StatusPageConfigUpdateSerializer(serializers.Serializer):
    """Serializer for updating Status Page settings."""

    company_name = serializers.CharField(max_length=255, required=False)
    slug = serializers.SlugField(max_length=100, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    logo_url = serializers.CharField(required=False, allow_blank=True)
    website_url = serializers.URLField(required=False, allow_blank=True)
    is_public = serializers.BooleanField(required=False)
    is_default = serializers.BooleanField(required=False)
    support_email = serializers.EmailField(required=False, allow_blank=True)
    custom_announcement = serializers.CharField(required=False, allow_blank=True)
    announcement_type = serializers.ChoiceField(
        choices=["info", "warning", "critical"], required=False
    )
    announcement_active = serializers.BooleanField(required=False)
    show_uptime_pct = serializers.BooleanField(required=False)
    show_latency_24h = serializers.BooleanField(required=False)
    monitored_targets = serializers.ListField(child=serializers.CharField(), required=False)
    component_settings = serializers.ListField(child=serializers.DictField(), required=False)


class StatusPageSubscriberSerializer(serializers.ModelSerializer):
    """Serializer for subscribers list in admin dashboard."""

    class Meta:
        model = StatusPageSubscriber
        fields = ("id", "email", "is_active", "created_at")
        read_only_fields = ("id", "created_at")


class PublicSubscribeSerializer(serializers.Serializer):
    """Serializer for email subscription from public status page."""

    email = serializers.EmailField()
