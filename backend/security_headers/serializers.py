from rest_framework import serializers

from .models import SecurityHeaderResult, SecurityHeaderTarget


class SecurityHeaderTargetSerializer(serializers.ModelSerializer):
    """Serializer for SecurityHeaderTarget model."""

    class Meta:
        model = SecurityHeaderTarget
        fields = (
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