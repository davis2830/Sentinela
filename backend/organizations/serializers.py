from rest_framework import serializers

from .models import Organization


class OrganizationSerializer(serializers.ModelSerializer):
    """Serializer for Organization model."""

    class Meta:
        model = Organization
        fields = (
            "id",
            "name",
            "slug",
            "status",
            "timezone",
            "locale",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class OrganizationCreateSerializer(serializers.Serializer):
    """Serializer for organization creation."""

    name = serializers.CharField(max_length=255)
    slug = serializers.SlugField(max_length=255)
    timezone = serializers.CharField(max_length=50, required=False, default="UTC")
    locale = serializers.CharField(max_length=10, required=False, default="en-US")


class OrganizationUpdateSerializer(serializers.Serializer):
    """Serializer for organization updates."""

    name = serializers.CharField(max_length=255, required=False)
    slug = serializers.SlugField(max_length=255, required=False)
    status = serializers.ChoiceField(
        choices=["active", "suspended", "cancelled"], required=False
    )
    timezone = serializers.CharField(max_length=50, required=False)
    locale = serializers.CharField(max_length=10, required=False)