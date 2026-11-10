"""Small HTTP boundaries for platform customer workflows."""

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from accounts.platform_auth import PlatformAPIView
from accounts.models import BetaControl
from accounts.platform_serializers import ResourcePageOutput, PlanPreviewOutput, FeedbackOutput, TrialPreviewOutput
from audit.services import AuditService
from common.permissions import IsOrganizationMember
from common.responses import success_response
from .models import Organization, OrganizationPlanTier, OrganizationSubscriptionStatus
from .plans import plan_limits, RESOURCE_LABELS
from .platform_resources import RESOURCES, usage, resource_page


class ResourceQuery(serializers.Serializer):
    module = serializers.ChoiceField(choices=list(RESOURCES))
    page = serializers.IntegerField(min_value=1, max_value=100000, default=1)


class ContactInput(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    billing_email = serializers.EmailField(required=False, allow_blank=True)
    contact_phone = serializers.CharField(max_length=50, required=False, allow_blank=True)
    tax_id = serializers.CharField(max_length=50, required=False, allow_blank=True)
    website = serializers.URLField(max_length=255, required=False, allow_blank=True)
    reason = serializers.CharField(min_length=3, max_length=500)


class ContactView(PlatformAPIView):
    input_serializer = ContactInput

    @transaction.atomic
    def patch(self, request, org_id):
        payload = ContactInput(data=request.data)
        payload.is_valid(raise_exception=True)
        data = dict(payload.validated_data)
        reason = data.pop("reason")
        org = Organization.objects.select_for_update().get(pk=org_id)
        before = {key: getattr(org, key) for key in data}
        for key, value in data.items():
            setattr(org, key, value)
        org.save(update_fields=[*data, "updated_at"])
        AuditService.log(
            action="update",
            module="organization",
            organization_id=org.pk,
            user_id=request.user.pk,
            user_email=request.user.email,
            description="Contacto actualizado. Motivo: " + reason,
            metadata={"reason": reason, "before": before, "after": data},
        )
        return success_response({"message": "Contacto actualizado.", **data})


class ResourcesView(PlatformAPIView):
    output_serializer = ResourcePageOutput
    query_serializer = ResourceQuery

    def get(self, request, org_id):
        query = ResourceQuery(data=request.query_params)
        query.is_valid(raise_exception=True)
        org = Organization.objects.get(pk=org_id)
        return success_response(resource_page(org, **query.validated_data))


class PlanPreviewInput(serializers.Serializer):
    plan_tier = serializers.ChoiceField(choices=OrganizationPlanTier.values)
    subscription_status = serializers.ChoiceField(choices=OrganizationSubscriptionStatus.values, required=False)


class PlanPreviewView(PlatformAPIView):
    output_serializer = PlanPreviewOutput
    input_serializer = PlanPreviewInput

    def post(self, request, org_id):
        payload = PlanPreviewInput(data=request.data)
        payload.is_valid(raise_exception=True)
        org = Organization.objects.get(pk=org_id)
        proposed = plan_limits(payload.validated_data["plan_tier"], beta=org.beta_managed)
        current = org.get_plan_limits()
        from accounts.models import User
        from notifications.models import NotificationChannel
        from status_page.models import StatusPageConfig

        rows = usage(org)
        extra = [
            ("max_team_members", User.objects.filter(organization=org).count()),
            ("max_notification_channels", NotificationChannel.objects.filter(organization=org).count()),
            ("max_status_pages", StatusPageConfig.objects.filter(organization=org).count()),
        ]
        consumption = [{"label": row["label"], "key": row["limit_key"], "used": row["total"]} for row in rows]
        consumption += [{"label": RESOURCE_LABELS[key], "key": key, "used": used} for key, used in extra]
        for row in consumption:
            row.update(
                current_limit=current[row["key"]],
                proposed_limit=proposed[row["key"]],
                exceeds=row["used"] > proposed[row["key"]],
            )
        return success_response(
            {
                "current_plan": org.plan_tier,
                "proposed_plan": proposed["tier"],
                "current_subscription": org.subscription_status,
                "proposed_subscription": payload.validated_data.get("subscription_status", org.subscription_status),
                "current_limits": current,
                "proposed_limits": proposed,
                "consumption": consumption,
                "warnings": [
                    "Hay recursos por encima del nuevo límite. Se conservan; las nuevas altas quedan sujetas a cuota."
                ]
                if any(row["exceeds"] for row in consumption)
                else [],
                "queried_at": timezone.now(),
            }
        )


class BetaFeedbackView(APIView):
    output_serializer = FeedbackOutput
    permission_classes = (IsAuthenticated, IsOrganizationMember)

    def get(self, request):
        org = request.user.organization
        control = BetaControl.objects.get(pk=1)
        enabled = bool(
            org.beta_managed
            and org.status == "active"
            and org.beta_status == "active"
            and control.feedback_submission_url
        )
        return success_response(
            {
                "enabled": enabled,
                "submission_url": control.feedback_submission_url if enabled else None,
                "beta_participant": org.beta_managed,
            }
        )


class TrialPreviewInput(serializers.Serializer):
    days = serializers.IntegerField(min_value=1, max_value=365)


class TrialPreviewView(PlatformAPIView):
    input_serializer = TrialPreviewInput
    output_serializer = TrialPreviewOutput

    def post(self, request, org_id):
        from datetime import timedelta

        payload = TrialPreviewInput(data=request.data)
        payload.is_valid(raise_exception=True)
        org = Organization.objects.get(pk=org_id)
        now = timezone.now()
        return success_response(
            {
                "current_subscription": org.subscription_status,
                "proposed_subscription": "trialing",
                "current_end": org.trial_ends_at,
                "proposed_end": max(now, org.trial_ends_at or now) + timedelta(days=payload.validated_data["days"]),
                "days": payload.validated_data["days"],
                "queried_at": now,
            }
        )
