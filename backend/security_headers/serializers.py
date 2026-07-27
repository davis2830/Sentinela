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
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization",
            "last_checked_at",
            "last_score",
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
            "headers_found",
            "headers_missing",
            "raw_headers",
            "error_message",
            "checked_at",
            "created_at",
        )
        read_only_fields = ("id", "target", "created_at")