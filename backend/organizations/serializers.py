from decimal import Decimal
from rest_framework import serializers

from .models import (
    Organization,
    OrganizationPlanTier,
    OrganizationSubscriptionStatus,
)


class OrganizationSerializer(serializers.ModelSerializer):
    """Serializer for Organization model."""

    is_in_trial = serializers.BooleanField(read_only=True)
    trial_days_remaining = serializers.IntegerField(read_only=True)

    class Meta:
        model = Organization
        fields = (
            "id",
            "name",
            "slug",
            "status",
            "timezone",
            "locale",
            # SaaS Subscription & Billing
            "plan_tier",
            "subscription_status",
            "trial_ends_at",
            "is_in_trial",
            "trial_days_remaining",
            "billing_email",
            "tax_id",
            "contact_phone",
            "website",
            "logo_url",
            # SLA & Observability Defaults
            "sla_target_percentage",
            "alert_flapping_threshold",
            "default_scan_interval_seconds",
            # Retention & Compliance
            "metrics_retention_days",
            "audit_logs_retention_days",
            "resolved_incidents_retention_days",
            # Security & Access Control
            "session_timeout_minutes",
            "require_2fa",
            "allowed_ip_ranges",
            # Timestamps
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "slug",
            "status",
            "plan_tier",
            "subscription_status",
            "trial_ends_at",
            "is_in_trial",
            "trial_days_remaining",
            "created_at",
            "updated_at",
        )


class OrganizationCreateSerializer(serializers.Serializer):
    """Serializer for organization creation."""

    name = serializers.CharField(max_length=255)
    slug = serializers.SlugField(max_length=255)
    timezone = serializers.CharField(max_length=50, required=False, default="UTC")
    locale = serializers.CharField(max_length=10, required=False, default="en-US")
    billing_email = serializers.EmailField(required=False, default="")


class OrganizationUpdateSerializer(serializers.Serializer):
    """Serializer for organization updates."""

    name = serializers.CharField(max_length=255, required=False)
    timezone = serializers.CharField(max_length=50, required=False)
    locale = serializers.CharField(max_length=10, required=False)
    billing_email = serializers.EmailField(required=False, allow_blank=True)
    tax_id = serializers.CharField(max_length=50, required=False, allow_blank=True)
    contact_phone = serializers.CharField(max_length=50, required=False, allow_blank=True)
    website = serializers.CharField(max_length=255, required=False, allow_blank=True)
    logo_url = serializers.CharField(max_length=500, required=False, allow_blank=True)

    # SLA & Observability
    sla_target_percentage = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        min_value=Decimal("90.00"),
        max_value=Decimal("99.99"),
        required=False,
    )
    alert_flapping_threshold = serializers.IntegerField(
        min_value=1, max_value=20, required=False
    )
    default_scan_interval_seconds = serializers.IntegerField(
        min_value=10, max_value=3600, required=False
    )

    # Retention & Compliance
    metrics_retention_days = serializers.IntegerField(
        min_value=7, max_value=3650, required=False
    )
    audit_logs_retention_days = serializers.IntegerField(
        min_value=30, max_value=3650, required=False
    )
    resolved_incidents_retention_days = serializers.IntegerField(
        min_value=30, max_value=3650, required=False
    )

    # Security
    session_timeout_minutes = serializers.IntegerField(
        min_value=15, max_value=1440, required=False
    )
    require_2fa = serializers.BooleanField(required=False)
    allowed_ip_ranges = serializers.CharField(required=False, allow_blank=True)


class OrganizationChangePlanSerializer(serializers.Serializer):
    """Serializer for upgrading or changing subscription plan."""

    plan_tier = serializers.ChoiceField(choices=OrganizationPlanTier.choices)