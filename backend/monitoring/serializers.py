from rest_framework import serializers

from .models import MaintenanceWindow, MonitoringCheck, MonitoringTarget


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
            "tags",
            "recent_checks",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization",
            "last_checked_at",
            "last_status",
            "last_latency",
            "recent_checks",
            "created_at",
            "updated_at",
        )

    recent_checks = serializers.SerializerMethodField()

    def get_recent_checks(self, obj):
        checks = obj.checks.order_by("-checked_at")[:20]
        return [
            {
                "status": c.status,
                "latency": c.latency,
                "checked_at": c.checked_at.isoformat(),
            }
            for c in reversed(checks)
        ]


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
    tags = serializers.ListField(child=serializers.CharField(), required=False, default=list)


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
    tags = serializers.ListField(child=serializers.CharField(), required=False)


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


class MaintenanceWindowSerializer(serializers.ModelSerializer):
    """Serializer for MaintenanceWindow model."""

    class Meta:
        model = MaintenanceWindow
        fields = (
            "id",
            "target",
            "name",
            "start_time",
            "end_time",
            "active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")