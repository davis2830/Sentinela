"""Explicit response DTOs for the beta console; no configuration secrets."""

from rest_framework import serializers


class PageMetaOutput(serializers.Serializer):
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total = serializers.IntegerField()
    has_next = serializers.BooleanField()


class DeliveryOutput(serializers.Serializer):
    status = serializers.CharField()
    attempts = serializers.IntegerField()
    last_attempt_at = serializers.DateTimeField(allow_null=True)


class ParticipantOutput(serializers.Serializer):
    id = serializers.UUIDField()
    email = serializers.EmailField()
    status = serializers.CharField()
    expires_at = serializers.DateTimeField()
    created_at = serializers.DateTimeField()
    reason = serializers.CharField()
    user__organization_id = serializers.UUIDField(allow_null=True)
    organization_name = serializers.CharField()
    user_id = serializers.UUIDField(allow_null=True)
    account_active = serializers.BooleanField(allow_null=True)
    email_verified = serializers.BooleanField()
    access_status = serializers.CharField(allow_null=True)
    beta_status = serializers.CharField(allow_null=True)
    has_resources = serializers.BooleanField()
    has_measurements = serializers.BooleanField()
    delivery = DeliveryOutput(allow_null=True)
    invitation_delivery = DeliveryOutput(allow_null=True)
    verification_delivery = DeliveryOutput(allow_null=True)


class BetaDirectoryOutput(PageMetaOutput):
    admissions_open = serializers.BooleanField()
    capacity = serializers.IntegerField()
    reserved = serializers.IntegerField()
    available = serializers.IntegerField()
    invitations = ParticipantOutput(many=True)
    feedback_submission_url = serializers.URLField(allow_blank=True)
    feedback_management_url = serializers.URLField(allow_blank=True)


class BetaOverviewOutput(serializers.Serializer):
    scope = serializers.CharField()
    capacity = serializers.IntegerField()
    reserved = serializers.IntegerField()
    available = serializers.IntegerField()
    admissions_open = serializers.BooleanField()
    invited = serializers.IntegerField()
    verification = serializers.IntegerField()
    registered = serializers.IntegerField()
    attention = serializers.DictField(child=serializers.IntegerField())
    queried_at = serializers.DateTimeField()
    feedback_configured = serializers.BooleanField()


class RoleOutput(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()


class UserDetailOutput(serializers.Serializer):
    id = serializers.UUIDField()
    email = serializers.EmailField()
    name = serializers.CharField(allow_blank=True)
    organization_id = serializers.UUIDField(allow_null=True)
    organization_name = serializers.CharField(allow_null=True)
    role = serializers.ChoiceField(choices=["platform", "admin", "viewer"])
    authorization_mode = serializers.ChoiceField(choices=["legacy", "custom"])
    effective_permissions = serializers.ListField(child=serializers.CharField())
    roles = RoleOutput(many=True)
    is_active = serializers.BooleanField()
    email_verified = serializers.BooleanField()
    mfa_enabled = serializers.BooleanField()
    last_login = serializers.DateTimeField(allow_null=True)
    created_at = serializers.DateTimeField()


class ResourceOutput(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    destination = serializers.CharField(allow_null=True)
    state = serializers.CharField(allow_null=True)
    measured_at = serializers.DateTimeField(allow_null=True)


class ResourcePageOutput(PageMetaOutput):
    module = serializers.CharField()
    label = serializers.CharField()
    items = ResourceOutput(many=True)


class ConsumptionOutput(serializers.Serializer):
    label = serializers.CharField()
    key = serializers.CharField()
    used = serializers.IntegerField()
    current_limit = serializers.IntegerField()
    proposed_limit = serializers.IntegerField()
    exceeds = serializers.BooleanField()


class PlanPreviewOutput(serializers.Serializer):
    current_plan = serializers.CharField()
    proposed_plan = serializers.CharField()
    current_subscription = serializers.CharField()
    proposed_subscription = serializers.CharField()
    current_limits = serializers.DictField()
    proposed_limits = serializers.DictField()
    consumption = ConsumptionOutput(many=True)
    warnings = serializers.ListField(child=serializers.CharField())
    queried_at = serializers.DateTimeField()


class TrialPreviewOutput(serializers.Serializer):
    current_subscription = serializers.CharField()
    proposed_subscription = serializers.CharField()
    current_end = serializers.DateTimeField(allow_null=True)
    proposed_end = serializers.DateTimeField()
    days = serializers.IntegerField()
    queried_at = serializers.DateTimeField()


class FeedbackOutput(serializers.Serializer):
    enabled = serializers.BooleanField()
    submission_url = serializers.URLField(allow_null=True)
    beta_participant = serializers.BooleanField()
