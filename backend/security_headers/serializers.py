from rest_framework import serializers
from common.scan_serializers import ScanAvailabilitySerializer, AvailabilityListSerializer

from .models import SecurityHeaderResult, SecurityHeaderTarget


class SecurityHeaderTargetSerializer(ScanAvailabilitySerializer):
    """Serializer for SecurityHeaderTarget model."""

    class Meta:
        list_serializer_class = AvailabilityListSerializer
        model = SecurityHeaderTarget
        fields = (
            "scan_availability",
            "id",
            "organization",
            "name",
            "url",
            "enabled",
            "last_checked_at",
            "last_score",
            "last_grade",
            "last_response_time_ms",
            "has_hsts",
            "has_csp",
            "has_xfo",
            "info_leak_detected",
            "server_header",
            "powered_by_header",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization",
            "last_checked_at",
            "last_score",
            "last_grade",
            "last_response_time_ms",
            "has_hsts",
            "has_csp",
            "has_xfo",
            "info_leak_detected",
            "server_header",
            "powered_by_header",
            "created_at",
            "updated_at",
        )


class SecurityHeaderTargetCreateSerializer(serializers.Serializer):
    """Serializer for target creation."""

    name = serializers.CharField(max_length=255)
    url = serializers.CharField(max_length=500)
    enabled = serializers.BooleanField(default=True)

    def validate(self, attrs):
        url = attrs.get("url")
        if url:
            from common.security import validate_safe_public_url
            validate_safe_public_url(url)
        return attrs


class SecurityHeaderResultSerializer(serializers.ModelSerializer):
    """Serializer for SecurityHeaderResult model."""

    class Meta:
        model = SecurityHeaderResult
        fields = (
            "id",
            "target",
            "score",
            "grade",
            "response_time_ms",
            "headers_found",
            "headers_missing",
            "directives_analysis",
            "info_leaks",
            "raw_headers",
            "error_message",
            "checked_at",
            "created_at",
        )
        read_only_fields = ("id", "target", "created_at")
