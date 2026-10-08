from rest_framework import serializers
from common.scan_serializers import ScanAvailabilitySerializer, AvailabilityListSerializer

from .models import APICheckResult, APICheckTarget


class APICheckTargetSerializer(ScanAvailabilitySerializer):
    """Serializer for APICheckTarget model."""

    def to_representation(self, instance):
        data = super().to_representation(instance)
        user = getattr(self.context.get('request'), 'user', None)
        if not user or not (user.is_staff or user.is_superuser) or getattr(getattr(self.context.get('request'), 'auth', None), 'scope', None) == 'read':
            data['request_headers'] = {}
            data['request_body'] = {}
        return data

    class Meta:
        list_serializer_class = AvailabilityListSerializer
        model = APICheckTarget
        fields = (
            "scan_availability",
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
            "last_response_time_ms",
            "last_http_status",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization",
            "last_checked_at",
            "last_status",
            "last_response_time_ms",
            "last_http_status",
            "created_at",
            "updated_at",
        )


class APICheckTargetCreateSerializer(serializers.Serializer):
    """Serializer for API check target creation."""

    name = serializers.CharField(max_length=255)
    url = serializers.CharField(max_length=500)
    method = serializers.ChoiceField(
        choices=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"], default="GET"
    )
    expected_status = serializers.IntegerField(default=200)
    expected_response_time_ms = serializers.IntegerField(default=2000)
    expected_headers = serializers.DictField(required=False, default=dict)
    expected_schema = serializers.DictField(required=False, default=dict)
    request_headers = serializers.DictField(required=False, default=dict)
    request_body = serializers.DictField(required=False, default=dict)
    check_interval = serializers.IntegerField(required=False, min_value=10)
    enabled = serializers.BooleanField(default=True)

    def validate(self, attrs):
        if "check_interval" not in attrs:
            request = self.context.get("request")
            organization = getattr(getattr(request, "user", None), "organization", None)
            attrs["check_interval"] = organization.get_plan_limits()["min_check_interval_seconds"] if organization else 300
        url = attrs.get("url")
        if url:
            from common.security import validate_safe_public_url
            validate_safe_public_url(url)
        return attrs


class APICheckTargetUpdateSerializer(serializers.Serializer):
    """Serializer for API check target updates."""

    name = serializers.CharField(max_length=255, required=False)
    url = serializers.CharField(max_length=500, required=False)
    method = serializers.ChoiceField(
        choices=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"], required=False
    )
    expected_status = serializers.IntegerField(required=False)
    expected_response_time_ms = serializers.IntegerField(required=False)
    expected_headers = serializers.DictField(required=False)
    expected_schema = serializers.DictField(required=False)
    request_headers = serializers.DictField(required=False)
    request_body = serializers.DictField(required=False)
    check_interval = serializers.IntegerField(required=False)
    enabled = serializers.BooleanField(required=False)

    def validate(self, attrs):
        url = attrs.get("url")
        if url:
            from common.security import validate_safe_public_url
            validate_safe_public_url(url)
        return attrs


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
