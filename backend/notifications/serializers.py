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
            "channel_type",
            "config",
            "enabled",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization", "created_at", "updated_at")


class NotificationChannelCreateSerializer(serializers.Serializer):
    """Serializer for channel creation."""

    name = serializers.CharField(max_length=255)
    channel_type = serializers.ChoiceField(
        choices=["email", "slack", "teams", "discord", "telegram", "webhook"]
    )
    config = serializers.DictField(required=False, default=dict)
    enabled = serializers.BooleanField(default=True)


class NotificationChannelUpdateSerializer(serializers.Serializer):
    """Serializer for channel updates."""

    name = serializers.CharField(max_length=255, required=False)
    channel_type = serializers.ChoiceField(
        choices=["email", "slack", "teams", "discord", "telegram", "webhook"], required=False
    )
    config = serializers.DictField(required=False)
    enabled = serializers.BooleanField(required=False)


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for Notification model."""

    channel_name = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = (
            "id",
            "organization",
            "channel",
            "channel_name",
            "alert_id",
            "title",
            "message",
            "status",
            "sent_at",
            "response",
            "error_message",
            "created_at",
        )
        read_only_fields = (
            "id",
            "organization",
            "channel",
            "alert_id",
            "title",
            "message",
            "status",
            "sent_at",
            "response",
            "error_message",
            "created_at",
        )

    def get_channel_name(self, obj):
        if obj.channel:
            return obj.channel.name
        return None


class NotificationCreateSerializer(serializers.Serializer):
    """Serializer for manual notification creation."""

    channel_id = serializers.UUIDField()
    title = serializers.CharField(max_length=500)
    message = serializers.CharField()