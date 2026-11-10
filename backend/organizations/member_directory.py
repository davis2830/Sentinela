"""Paged union: choose identities in SQL before loading related objects."""

from django.db.models import Exists, OuterRef, Q, Value, IntegerField
from django.utils import timezone
from rest_framework import serializers

from accounts.models import User
from common.pagination import paginate, directory_response
from organizations.models import InvitationToken


class MemberFilters(serializers.Serializer):
    search = serializers.CharField(required=False, allow_blank=True, max_length=255)
    role = serializers.ChoiceField(choices=["all", "admin", "member", "viewer"], required=False)
    status = serializers.ChoiceField(choices=["all", "active", "pending", "revoked"], required=False)
    team = serializers.UUIDField(required=False)


def members(request):
    form = MemberFilters(data=request.query_params)
    form.is_valid(raise_exception=True)
    filters = form.validated_data
    org_id = request.user.organization_id
    users = User.objects.filter(organization_id=org_id)
    invites = InvitationToken.objects.filter(organization_id=org_id, is_used=False, expires_at__gt=timezone.now())
    registered = User.objects.filter(email__iexact=OuterRef("email"))
    newer = invites.filter(email__iexact=OuterRef("email")).filter(
        Q(created_at__gt=OuterRef("created_at")) | Q(created_at=OuterRef("created_at"), id__gt=OuterRef("id"))
    )
    invites = invites.annotate(registered=Exists(registered), superseded=Exists(newer)).filter(
        registered=False, superseded=False
    )
    search = filters.get("search", "").strip()
    if search:
        identity = Q(email__icontains=search) | Q(first_name__icontains=search) | Q(last_name__icontains=search)
        users = users.filter(identity | Q(teams__name__icontains=search)).distinct()
        invites = invites.filter(identity)
    role = filters.get("role", "all")
    if role != "all":
        users = users.filter(is_staff=role == "admin")
        invites = invites.filter(role__in=["member", "viewer"] if role in ("member", "viewer") else ["admin"])
    state = filters.get("status", "all")
    if state == "pending":
        users = users.none()
    elif state in ("active", "revoked"):
        users = users.filter(is_active=state == "active")
        invites = invites.none()
    if filters.get("team"):
        users = users.filter(teams__id=filters["team"]).distinct()
        invites = invites.none()
    stats = {
        "active": users.filter(is_active=True).count(),
        "revoked": users.filter(is_active=False).count(),
        "pending": invites.count(),
    }
    identities = (
        users.order_by()
        .annotate(kind=Value(0, output_field=IntegerField()))
        .values("id", "created_at", "kind")
        .union(
            invites.order_by().annotate(kind=Value(1, output_field=IntegerField())).values("id", "created_at", "kind")
        )
        .order_by("-created_at", "kind", "id")
    )
    if "page" in request.query_params:
        identities, meta = paginate(identities, request)
        meta["counts"] = stats
    else:
        meta = None
    identities = list(identities)
    loaded_users = {
        u.pk: u for u in users.filter(pk__in=[i["id"] for i in identities if i["kind"] == 0]).prefetch_related("teams")
    }
    loaded_invites = {i.pk: i for i in invites.filter(pk__in=[i["id"] for i in identities if i["kind"] == 1])}
    result = []
    for item in identities:
        invitation = item["kind"] == 1
        person = loaded_invites[item["id"]] if invitation else loaded_users[item["id"]]
        state = "pending" if invitation else "active" if person.is_active else "revoked"
        result.append(
            {
                "id": str(person.pk),
                "email": person.email,
                "first_name": person.first_name,
                "last_name": person.last_name,
                "role": person.role if invitation else "admin" if person.is_staff else "member",
                "is_active": not invitation and person.is_active,
                "status_code": state,
                "status_label": {"pending": "Invitación Pendiente", "active": "Activo", "revoked": "Desactivado"}[
                    state
                ],
                "date_joined": person.created_at.isoformat(),
                "last_login": None if invitation or not person.last_login else person.last_login.isoformat(),
                "is_invitation": invitation,
                "authorization_mode": "legacy" if invitation else person.authorization_mode,
                "teams": []
                if invitation
                else [{"id": str(t.pk), "name": t.name, "color": t.color} for t in person.teams.all()],
            }
        )
    return directory_response(result, meta)
