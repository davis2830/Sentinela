from django.db import transaction
from django.db.models import Q, F
from rest_framework import serializers
from accounts.platform_auth import PlatformAPIView
from accounts.models import User
from audit.services import AuditService
from common.membership import LastAdminRequired, guard_admin_removal
from common.responses import error_response, success_response
from organizations.models import Organization


class PlatformUserQuery(serializers.Serializer):
    search = serializers.CharField(max_length=254, required=False, allow_blank=True)
    organization_id = serializers.UUIDField(required=False)
    organization = serializers.CharField(max_length=255, required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=("active", "inactive"), required=False)
    page = serializers.IntegerField(min_value=1, max_value=100000, default=1)
    authorization_mode = serializers.ChoiceField(choices=["legacy", "custom"], required=False)
    ordering = serializers.ChoiceField(
        choices=["-created_at", "created_at", "email", "-last_login"], default="-created_at"
    )
    role = serializers.ChoiceField(choices=["platform", "admin", "viewer"], required=False)
    verified = serializers.BooleanField(required=False, default=None, allow_null=True)
    mfa = serializers.BooleanField(required=False, default=None, allow_null=True)


class PlatformUserAction(serializers.Serializer):
    action = serializers.ChoiceField(choices=("activate", "deactivate", "revoke_sessions", "make_admin", "make_viewer"))
    reason = serializers.CharField(min_length=3, max_length=500)


class PlatformUserListView(PlatformAPIView):
    query_serializer = PlatformUserQuery

    def get(self, request):
        query = PlatformUserQuery(data=request.query_params)
        query.is_valid(raise_exception=True)
        filters = query.validated_data
        order = F("last_login").desc(nulls_last=True) if filters["ordering"] == "-last_login" else filters["ordering"]
        users = User.objects.select_related("organization").order_by(order, "id")
        if mode := filters.get("authorization_mode"):
            users = users.filter(authorization_mode=mode, is_staff=False, is_superuser=False)
        if search := filters.get("search"):
            users = users.filter(
                Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(organization__name__icontains=search)
            )
        if organization_id := filters.get("organization_id"):
            users = users.filter(organization_id=organization_id)
        if organization := filters.get("organization"):
            users = users.filter(
                Q(organization__name__icontains=organization) | Q(organization__slug__icontains=organization)
            )
        if filters.get("role") == "platform":
            users = users.filter(is_superuser=True)
        elif filters.get("role") in ("admin", "viewer"):
            users = users.filter(is_superuser=False, is_staff=filters["role"] == "admin")
        if filters.get("verified") is not None:
            users = users.filter(email_verified_at__isnull=not filters["verified"])
        if filters.get("mfa") is not None:
            users = users.filter(is_2fa_enabled=filters["mfa"])
        if account_status := filters.get("status"):
            users = users.filter(is_active=account_status == "active")
        page_size = 25
        start = (filters["page"] - 1) * page_size
        return success_response(
            {
                "total": users.count(),
                "page_size": page_size,
                "users": [
                    {
                        "id": user.id,
                        "email": user.email,
                        "name": f"{user.first_name} {user.last_name}".strip(),
                        "organization_id": user.organization_id,
                        "organization_name": user.organization.name if user.organization else None,
                        "role": "platform" if user.is_superuser else "admin" if user.is_staff else "viewer",
                        "authorization_mode": user.authorization_mode,
                        "is_active": user.is_active,
                        "email_verified": bool(user.email_verified_at),
                        "mfa_enabled": user.is_2fa_enabled,
                        "last_login": user.last_login,
                    }
                    for user in users[start : start + page_size]
                ],
            }
        )


class PlatformUserActionView(PlatformAPIView):
    @transaction.atomic
    def post(self, request, user_id):
        payload = PlatformUserAction(data=request.data)
        payload.is_valid(raise_exception=True)
        action = payload.validated_data["action"]
        candidate = User.objects.filter(pk=user_id).values("organization_id").first()
        if candidate is None:
            return error_response("Usuario no encontrado.", status_code=404)
        organization_id = candidate["organization_id"]
        if organization_id:
            Organization.objects.select_for_update().filter(pk=organization_id).first()
        user = User.objects.select_for_update().filter(pk=user_id, organization_id=organization_id).first()
        if user is None:
            return error_response("Usuario no encontrado.", status_code=404)
        if user.is_superuser:
            return error_response("Las cuentas de superadministración están protegidas.", status_code=403)

        if action in ("make_admin", "make_viewer") and not organization_id:
            return error_response("El usuario debe pertenecer a una organización para asignarle un rol.")
        if organization_id and action in ("deactivate", "make_viewer"):
            try:
                guard_admin_removal(organization_id, [user.id])
            except LastAdminRequired as exc:
                return error_response(exc)

        if action == "deactivate":
            user.is_active = False
        elif action == "activate":
            user.is_active = True
        elif action in ("make_admin", "make_viewer"):
            user.is_staff = action == "make_admin"
            user.authorization_mode = "legacy"
        if action != "activate":
            user.session_version += 1
        user.save(update_fields=["is_active", "is_staff", "authorization_mode", "session_version", "updated_at"])
        AuditService.log(
            action="update",
            module="platform_users",
            organization_id=organization_id,
            user_id=request.user.id,
            user_email=request.user.email,
            description=f"Acción de plataforma sobre {user.email}: {action}. {payload.validated_data['reason']}",
            metadata={"target_user_id": str(user.id), "operation": action},
        )
        return success_response({"is_active": user.is_active})


class PlatformUserDetailView(PlatformAPIView):
    from accounts.platform_serializers import UserDetailOutput

    output_serializer = UserDetailOutput

    def get(self, request, user_id):
        from common.authorization import effective_permissions
        from users.models import UserRole

        user = User.objects.select_related("organization").get(pk=user_id)
        roles = UserRole.objects.filter(user=user, role__organization_id=user.organization_id).select_related("role")
        return success_response(
            {
                "id": user.pk,
                "email": user.email,
                "name": user.get_full_name(),
                "organization_id": user.organization_id,
                "organization_name": user.organization.name if user.organization else None,
                "role": "platform" if user.is_superuser else "admin" if user.is_staff else "viewer",
                "authorization_mode": user.authorization_mode,
                "effective_permissions": effective_permissions(user),
                "roles": [{"id": assignment.role_id, "name": assignment.role.name} for assignment in roles],
                "is_active": user.is_active,
                "email_verified": bool(user.email_verified_at),
                "mfa_enabled": user.is_2fa_enabled,
                "last_login": user.last_login,
                "created_at": user.created_at,
            }
        )
