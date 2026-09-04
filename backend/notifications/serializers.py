from rest_framework import serializers

from .models import Notification, NotificationChannel


class NotificationChannelSerializer(serializers.ModelSerializer):
    """Serializer for NotificationChannel model."""

    class Meta:
        model = NotificationChannel
        fields = (
            "id",
            "organization",
            "name",
            "description",
            "channel_type",
            "config",
            "enabled",
            "min_severity",
            "subscribed_events",
            "rate_limit_per_hour",
            "quiet_hours_enabled",
            "quiet_hours_start",
            "quiet_hours_end",
            "quiet_hours_critical_override",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization", "created_at", "updated_at")


class NotificationChannelCreateSerializer(serializers.Serializer):
    """Serializer for channel creation."""

    name = serializers.CharField(max_length=255)
    description = serializers.CharField(max_length=255, required=False, default="")
    channel_type = serializers.ChoiceField(
        choices=["email", "slack", "teams", "discord", "telegram", "webhook"]
    )
    config = serializers.DictField(required=False, default=dict)
    enabled = serializers.BooleanField(default=True)
    min_severity = serializers.ChoiceField(
        choices=["info", "warning", "critical"], required=False, default="info"
    )
    subscribed_events = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    rate_limit_per_hour = serializers.IntegerField(required=False, default=0, min_value=0)
    quiet_hours_enabled = serializers.BooleanField(required=False, default=False)
    quiet_hours_start = serializers.CharField(max_length=5, required=False, default="22:00")
    quiet_hours_end = serializers.CharField(max_length=5, required=False, default="08:00")
    quiet_hours_critical_override = serializers.BooleanField(required=False, default=True)


class NotificationChannelUpdateSerializer(serializers.Serializer):
    """Serializer for channel updates."""

    name = serializers.CharField(max_length=255, required=False)
    description = serializers.CharField(max_length=255, required=False, allow_blank=True)
    channel_type = serializers.ChoiceField(
        choices=["email", "slack", "teams", "discord", "telegram", "webhook"], required=False
    )
    config = serializers.DictField(required=False)
    enabled = serializers.BooleanField(required=False)
    min_severity = serializers.ChoiceField(
        choices=["info", "warning", "critical"], required=False
    )
    subscribed_events = serializers.ListField(
        child=serializers.CharField(), required=False
    )
    rate_limit_per_hour = serializers.IntegerField(required=False, min_value=0)
    quiet_hours_enabled = serializers.BooleanField(required=False)
    quiet_hours_start = serializers.CharField(max_length=5, required=False)
    quiet_hours_end = serializers.CharField(max_length=5, required=False)
    quiet_hours_critical_override = serializers.BooleanField(required=False)


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for Notification model."""

    channel_name = serializers.SerializerMethodField()
    channel_type = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = (
            "id",
            "organization",
            "channel",
            "channel_name",
            "channel_type",
            "alert_id",
            "title",
            "message",
            "status",
            "severity",
            "event_type",
            "duration_ms",
            "http_status",
            "retry_count",
            "sent_at",
            "response",
            "error_message",
            "created_at",
        )
        read_only_fields = fields

    def get_channel_name(self, obj):
        if obj.channel:
            return obj.channel.name
        return None

    def get_channel_type(self, obj):
        if obj.channel:
            return obj.channel.channel_type
        return None


class NotificationCreateSerializer(serializers.Serializer):
    """Serializer for manual notification creation."""

    channel_id = serializers.UUIDField()
    title = serializers.CharField(max_length=500)
    message = serializers.CharField()
    severity = serializers.ChoiceField(choices=["info", "warning", "critical"], default="info", required=False)
    event_type = serializers.CharField(max_length=50, default="manual", required=False)


class TestChannelConfigSerializer(serializers.Serializer):
    """Serializer for pre-flight live connection testing."""

    channel_type = serializers.ChoiceField(
        choices=["email", "slack", "teams", "discord", "telegram", "webhook"]
    )
    config = serializers.DictField(required=True)
    custom_title = serializers.CharField(max_length=200, required=False, default="")
    custom_message = serializers.CharField(max_length=1000, required=False, default="")


class NotificationBulkActionSerializer(serializers.Serializer):
    """Serializer for bulk channel actions."""

    action = serializers.ChoiceField(choices=["enable", "disable", "test", "delete"])
    channel_ids = serializers.ListField(
        child=serializers.UUIDField(), allow_empty=False
    )