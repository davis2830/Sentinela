"""Administrative organization DTOs with distinct identity, access and subscription."""

from rest_framework import serializers
from .models import Organization
from accounts.platform_serializers import PageMetaOutput


class OrganizationOutput(serializers.ModelSerializer):
    sla_target_percentage = serializers.FloatField()
    access_status = serializers.ChoiceField(choices=["active", "suspended", "cancelled"])
    access_protected = serializers.BooleanField()
    beta_status = serializers.CharField(allow_null=True)
    is_in_trial = serializers.BooleanField()
    trial_days_remaining = serializers.IntegerField()
    users_count = serializers.IntegerField()
    max_users = serializers.IntegerField()
    targets_count = serializers.IntegerField()
    max_targets = serializers.IntegerField()
    probes_count = serializers.IntegerField()
    max_probes = serializers.IntegerField()

    class Meta:
        model = Organization
        fields = (
            "id",
            "name",
            "slug",
            "access_status",
            "access_protected",
            "beta_managed",
            "beta_status",
            "is_test",
            "plan_tier",
            "subscription_status",
            "is_in_trial",
            "trial_days_remaining",
            "trial_ends_at",
            "billing_email",
            "tax_id",
            "contact_phone",
            "website",
            "sla_target_percentage",
            "created_at",
            "users_count",
            "max_users",
            "targets_count",
            "max_targets",
            "probes_count",
            "max_probes",
        )


class UsageOutput(serializers.Serializer):
    module = serializers.CharField()
    label = serializers.CharField()
    limit_key = serializers.CharField()
    limit = serializers.IntegerField()
    total = serializers.IntegerField()
    measured = serializers.IntegerField()


class DetailUserOutput(serializers.Serializer):
    id = serializers.UUIDField()
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    is_staff = serializers.BooleanField()
    is_active = serializers.BooleanField()
    last_login = serializers.DateTimeField(allow_null=True)
    created_at = serializers.DateTimeField()


class HistoryOutput(serializers.Serializer):
    id = serializers.UUIDField()
    user_email = serializers.CharField()
    action = serializers.CharField()
    resource_type = serializers.CharField()
    resource_name = serializers.CharField()
    description = serializers.CharField()
    created_at = serializers.DateTimeField()


class OrganizationDetailOutput(OrganizationOutput):
    counts = serializers.DictField(child=serializers.IntegerField())
    page = serializers.IntegerField()
    has_next = serializers.BooleanField()
    resource_usage = UsageOutput(many=True)
    users = DetailUserOutput(many=True)
    limits = serializers.DictField()
    targets = serializers.ListField(child=serializers.DictField())
    probes = serializers.ListField(child=serializers.DictField())
    recent_audits = HistoryOutput(many=True)

    class Meta(OrganizationOutput.Meta):
        fields = OrganizationOutput.Meta.fields + (
            "counts",
            "page",
            "has_next",
            "resource_usage",
            "users",
            "limits",
            "targets",
            "probes",
            "recent_audits",
        )


class AccessOutput(serializers.Serializer):
    message = serializers.CharField()
    access_status = serializers.CharField()
    beta_status = serializers.CharField(allow_null=True)
    subscription_status = serializers.CharField()
    monitoring_allowed = serializers.BooleanField()


class DirectoryMetaOutput(PageMetaOutput):
    pass
