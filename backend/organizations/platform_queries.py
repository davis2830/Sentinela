from django.db.models import Count, Q, OuterRef, Subquery, IntegerField
from django.db.models.functions import Coalesce
from django.utils import timezone
from datetime import timedelta
from rest_framework import serializers
from .models import Organization


class DirectoryQuery(serializers.Serializer):
    search = serializers.CharField(max_length=255, required=False, allow_blank=True)
    plan_tier = serializers.ChoiceField(choices=["all", "free", "pro", "business", "enterprise"], required=False)
    status = serializers.ChoiceField(
        choices=["all", "active", "trialing", "past_due", "suspended", "canceled"], required=False
    )
    access_status = serializers.ChoiceField(choices=["all", "active", "suspended", "cancelled"], default="all")
    beta = serializers.BooleanField(required=False, default=None, allow_null=True)
    ordering = serializers.ChoiceField(choices=["-created_at", "created_at", "name", "-name"], default="-created_at")
    classification = serializers.ChoiceField(choices=["all", "customers", "tests"], default="all")
    trial_expiring = serializers.BooleanField(default=False)
    page = serializers.IntegerField(min_value=1, max_value=100000, default=1)


def directory(request):
    query = DirectoryQuery(data=request.query_params)
    query.is_valid(raise_exception=True)
    data = query.validated_data
    qs = Organization.objects.order_by(data["ordering"], "id")
    if data["access_status"] != "all":
        qs = qs.filter(status=data["access_status"])
    if data["beta"] is not None:
        qs = qs.filter(beta_managed=data["beta"])
    if data.get("search"):
        term = data["search"]
        qs = qs.filter(Q(name__icontains=term) | Q(slug__icontains=term) | Q(billing_email__icontains=term))
    for param, field in [("plan_tier", "plan_tier"), ("status", "subscription_status")]:
        if data.get(param) and data[param] != "all":
            qs = qs.filter(**{field: data[param]})
    if data["classification"] != "all":
        qs = qs.filter(is_test=data["classification"] == "tests")
    if data["trial_expiring"]:
        qs = qs.filter(
            subscription_status="trialing",
            trial_ends_at__gte=timezone.now(),
            trial_ends_at__lte=timezone.now() + timedelta(days=7),
        )
    return qs, data


def counted(qs):
    from accounts.models import User
    from monitoring.models import MonitoringTarget, AgentProbe

    def count(model):
        return Coalesce(
            Subquery(
                model.objects.filter(organization_id=OuterRef("pk"))
                .order_by()
                .values("organization_id")
                .annotate(n=Count("pk"))
                .values("n"),
                output_field=IntegerField(),
            ),
            0,
        )

    return qs.annotate(
        directory_users=count(User), directory_targets=count(MonitoringTarget), directory_probes=count(AgentProbe)
    )
