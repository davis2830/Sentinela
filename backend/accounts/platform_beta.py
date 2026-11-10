"""Bounded beta directory and current-state adoption, without historical inference."""

from functools import reduce
from operator import or_
from django.db.models import Q, Exists, OuterRef, Subquery, Case, When, Value, BooleanField, Count
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import serializers
from .models import BetaInvitation, BetaControl, IdentityMail
from organizations.platform_resources import RESOURCES, model_for


class BetaQuery(serializers.Serializer):
    page = serializers.IntegerField(min_value=1, max_value=100000, default=1)
    search = serializers.CharField(max_length=254, required=False, allow_blank=True)
    status = serializers.ChoiceField(
        choices=["", "invited", "pending_verification", "active", "suspended", "revoked", "rejected", "expired"],
        default="",
    )
    delivery = serializers.ChoiceField(choices=["", "queued", "sent", "failed", "expired"], default="")
    attention = serializers.ChoiceField(
        choices=["", "failed_delivery", "expired", "verification", "blocked", "unconfigured", "unmeasured"], default=""
    )
    ordering = serializers.ChoiceField(choices=["-created_at", "created_at", "email"], default="-created_at")


def participants():
    qs = BetaInvitation.objects.select_related("user__organization").only(
        "id",
        "email",
        "status",
        "expires_at",
        "created_at",
        "reason",
        "organization_name",
        "user_id",
        "user__id",
        "user__organization_id",
        "user__is_active",
        "user__email_verified_at",
        "user__organization__id",
        "user__organization__name",
        "user__organization__status",
        "user__organization__beta_status",
    )
    mail = IdentityMail.objects.filter(invitation_id=OuterRef("pk")).order_by("-created_at", "-id")
    verification = IdentityMail.objects.filter(
        challenge__user_id=OuterRef("user_id"), challenge__purpose="registration"
    ).order_by("-created_at", "-id")
    qs = qs.annotate(
        invitation_delivery=Subquery(mail.values("status")[:1]),
        invitation_attempts=Subquery(mail.values("attempts")[:1]),
        invitation_sent_at=Subquery(mail.values("last_attempt_at")[:1]),
        verification_delivery=Subquery(verification.values("status")[:1]),
        verification_attempts=Subquery(verification.values("attempts")[:1]),
        verification_sent_at=Subquery(verification.values("last_attempt_at")[:1]),
    )
    qs = qs.annotate(latest_delivery=Coalesce("verification_delivery", "invitation_delivery"))
    configured, measured = [], []
    for key, spec in RESOURCES.items():
        if key == "agents":
            continue
        resource = model_for(spec).objects.filter(organization_id=OuterRef("user__organization_id"))
        qs = qs.annotate(
            **{
                "configured_" + key: Exists(resource),
                "measured_" + key: Exists(resource.filter(**{spec.measured + "__isnull": False})),
            }
        )
        configured.append(Q(**{"configured_" + key: True}))
        measured.append(Q(**{"measured_" + key: True}))
    return qs.annotate(
        has_resources=Case(
            When(reduce(or_, configured), then=Value(True)), default=Value(False), output_field=BooleanField()
        ),
        has_measurements=Case(
            When(reduce(or_, measured), then=Value(True)), default=Value(False), output_field=BooleanField()
        ),
    )


def attention_filters():
    now = timezone.now()
    registered = Q(user__organization_id__isnull=False)
    return {
        "failed_delivery": Q(latest_delivery="failed"),
        "expired": Q(status__in=["invited", "pending_verification"], expires_at__lte=now),
        "verification": Q(status="pending_verification", expires_at__gt=now),
        "blocked": Q(user__is_active=False)
        | (registered & (~Q(user__organization__status="active") | ~Q(user__organization__beta_status="active"))),
        "unconfigured": registered & Q(has_resources=False),
        "unmeasured": registered & Q(has_resources=True, has_measurements=False),
    }


def overview():
    control = BetaControl.objects.get(pk=1)
    qs = participants()
    filters = attention_filters()
    from .beta import reserved_slots

    reserved = reserved_slots()
    counts = qs.aggregate(
        invited=Count("pk", filter=Q(status="invited", expires_at__gt=timezone.now())),
        verification=Count("pk", filter=filters["verification"]),
        registered=Count("user__organization_id", distinct=True),
        **{"attention_" + key: Count("pk", filter=value) for key, value in filters.items()},
    )
    return {
        "scope": "Toda la beta privada; incluye participantes de organizaciones de prueba.",
        "capacity": control.capacity,
        "reserved": reserved,
        "available": max(0, control.capacity - reserved),
        "admissions_open": control.admissions_open,
        "invited": counts["invited"],
        "verification": counts["verification"],
        "registered": counts["registered"],
        "attention": {key: counts["attention_" + key] for key in filters},
        "queried_at": timezone.now(),
        "feedback_configured": bool(control.feedback_submission_url),
    }


def directory(params):
    query = BetaQuery(data=params)
    query.is_valid(raise_exception=True)
    data = query.validated_data
    qs = participants()
    if data.get("search"):
        term = data["search"]
        qs = qs.filter(
            Q(email__icontains=term)
            | Q(organization_name__icontains=term)
            | Q(user__organization__name__icontains=term)
        )
    if data["status"] == "expired":
        qs = qs.filter(attention_filters()["expired"])
    elif data["status"]:
        qs = qs.filter(status=data["status"])
    if data["delivery"]:
        qs = qs.filter(latest_delivery=data["delivery"])
    if data["attention"]:
        qs = qs.filter(attention_filters()[data["attention"]])
    total = qs.count()
    page = data["page"]
    rows = []
    for inv in qs.order_by(data["ordering"], "id")[(page - 1) * 25 : page * 25]:
        user = inv.user
        org = user.organization if user else None

        def delivery(kind):
            status = getattr(inv, kind + "_delivery")
            return (
                {
                    "status": status,
                    "attempts": getattr(inv, kind + "_attempts") or 0,
                    "last_attempt_at": getattr(inv, kind + "_sent_at"),
                }
                if status
                else None
            )

        rows.append(
            {
                "id": inv.pk,
                "email": inv.email,
                "status": inv.status,
                "expires_at": inv.expires_at,
                "created_at": inv.created_at,
                "reason": inv.reason,
                "user__organization_id": org.pk if org else None,
                "organization_name": org.name if org else inv.organization_name,
                "user_id": user.pk if user else None,
                "account_active": user.is_active if user else None,
                "email_verified": bool(user and user.email_verified_at),
                "access_status": org.status if org else None,
                "beta_status": org.beta_status if org else None,
                "has_resources": inv.has_resources,
                "has_measurements": inv.has_measurements,
                "delivery": delivery("verification") or delivery("invitation"),
                "invitation_delivery": delivery("invitation"),
                "verification_delivery": delivery("verification"),
            }
        )
    return rows, {"page": page, "page_size": 25, "total": total, "has_next": page * 25 < total}
