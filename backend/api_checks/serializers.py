from rest_framework import serializers

from .models import APICheckResult, APICheckTarget


class APICheckTargetSerializer(serializers.ModelSerializer):
    """Serializer for APICheckTarget model."""

    class Meta:
        model = APICheckTarget
        fields = (
            "id",
            "organization",
            "name",
            "url",
            "method",
            "expected_status",
            "expected_response_time_ms",
            "expected_headers",
            "expected_schema",
            "request_headers",
            "request_body",
            "check_interval",
            "enabled",
            "last_checked_at",
            "last_status",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization",
            "last_checked_at",
            "last_status",
            "created_at",
            "updated_at",
        )


class APICheckTargetCreateSerializer(serializers.Serializer):
    """Serializer for API check target creation."""

    name = serializers.CharField(max_length=255)
    url = serializers.CharField(max_length=500)
    method = serializers.ChoiceField(
        choices=["GET", "POST", "PUT", "PATCH"], default="GET"
    )
    expected_status = serializers.IntegerField(default=200)
    expected_response_time_ms = serializers.IntegerField(default=2000)
    expected_headers = serializers.DictField(required=False, default=dict)
    expected_schema = serializers.DictField(required=False, default=dict)
    request_headers = serializers.DictField(required=False, default=dict)
    request_body = serializers.DictField(required=False, default=dict)
    check_interval = serializers.IntegerField(required=False, default=60)
    enabled = serializers.BooleanField(default=True)


class APICheckTargetUpdateSerializer(serializers.Serializer):
    """Serializer for API check target updates."""

    name = serializers.CharField(max_length=255, required=False)
    url = serializers.CharField(max_length=500, required=False)
    method = serializers.ChoiceField(
        choices=["GET", "POST", "PUT", "PATCH"], required=False
    )
    expected_status = serializers.IntegerField(required=False)
    expected_response_time_ms = serializers.IntegerField(required=False)
    expected_headers = serializers.DictField(required=False)
    expected_schema = serializers.DictField(required=False)
    request_headers = serializers.DictField(required=False)
    request_body = serializers.DictField(required=False)
    check_interval = serializers.IntegerField(required=False)
    enabled = serializers.BooleanField(required=False)


class APICheckResultSerializer(serializers.ModelSerializer):
    """Serializer for APICheckResult model."""

    class Meta:
        model = APICheckResult
        fields = (
            "id",
            "target",
            "status",
            "http_status",
            "response_time_ms",
            "json_valid",
            "schema_valid",
            "headers_valid",
            "response_headers",
            "error_message",
            "checked_at",
            "created_at",
        )
        read_only_fields = ("id", "target", "created_at")