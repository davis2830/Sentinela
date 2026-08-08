from rest_framework import serializers

from .models import MonitoringCheck, MonitoringTarget


class MonitoringTargetSerializer(serializers.ModelSerializer):
    """Serializer for MonitoringTarget model."""

    class Meta:
        model = MonitoringTarget
        fields = (
            "id",
            "organization",
            "name",
            "target_type",
            "endpoint",
            "interval",
            "enabled",
            "http_method",
            "expected_status",
            "custom_headers",
            "request_body",
            "max_latency_ms",
            "last_checked_at",
            "last_status",
            "last_latency",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization",
            "last_checked_at",
            "last_status",
            "last_latency",
            "created_at",
            "updated_at",
        )


class MonitoringTargetCreateSerializer(serializers.Serializer):
    """Serializer for target creation."""

    name = serializers.CharField(max_length=255)
    target_type = serializers.ChoiceField(
        choices=["http", "https", "tcp", "dns", "api", "ssl"]
    )
    endpoint = serializers.CharField(max_length=500)
    interval = serializers.IntegerField(min_value=10, default=60)
    enabled = serializers.BooleanField(default=True)
    http_method = serializers.CharField(max_length=10, required=False, default="GET")
    expected_status = serializers.IntegerField(required=False, default=200)
    custom_headers = serializers.JSONField(required=False, default=dict)
    request_body = serializers.CharField(required=False, default="", allow_blank=True)
    max_latency_ms = serializers.IntegerField(required=False, default=2000)


class MonitoringTargetUpdateSerializer(serializers.Serializer):
    """Serializer for target updates."""

    name = serializers.CharField(max_length=255, required=False)
    target_type = serializers.ChoiceField(
        choices=["http", "https", "tcp", "dns", "api", "ssl"], required=False
    )
    endpoint = serializers.CharField(max_length=500, required=False)
    interval = serializers.IntegerField(min_value=10, required=False)
    enabled = serializers.BooleanField(required=False)
    http_method = serializers.CharField(max_length=10, required=False)
    expected_status = serializers.IntegerField(required=False)
    custom_headers = serializers.JSONField(required=False)
    request_body = serializers.CharField(required=False, allow_blank=True)
    max_latency_ms = serializers.IntegerField(required=False)


class MonitoringCheckSerializer(serializers.ModelSerializer):
    """Serializer for MonitoringCheck model."""

    class Meta:
        model = MonitoringCheck
        fields = (
            "id",
            "target",
            "status",
            "latency",
            "checked_at",
            "details",
            "created_at",
        )
        read_only_fields = ("id", "target", "created_at")