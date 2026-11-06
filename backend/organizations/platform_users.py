from django.db import transaction
from django.db.models import Q
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
    status = serializers.ChoiceField(choices=("active", "inactive"), required=False)
    page = serializers.IntegerField(min_value=1, max_value=100000, default=1)


class PlatformUserAction(serializers.Serializer):
    action = serializers.ChoiceField(choices=("activate", "deactivate", "revoke_sessions", "make_admin", "make_viewer"))
    reason = serializers.CharField(min_length=3, max_length=500)


class PlatformUserListView(PlatformAPIView):
    def get(self, request):
        query = PlatformUserQuery(data=request.query_params)
        query.is_valid(raise_exception=True)
        filters = query.validated_data
        users = User.objects.select_related("organization").order_by("-created_at", "id")
        if search := filters.get("search"):
            users = users.filter(
                Q(email__icontains=search) | Q(first_name__icontains=search)
                | Q(last_name__icontains=search) | Q(organization__name__icontains=search)
            )
        if organization_id := filters.get("organization_id"):
            users = users.filter(organization_id=organization_id)
        if account_status := filters.get("status"):
            users = users.filter(is_active=account_status == "active")
        page_size = 25
        start = (filters["page"] - 1) * page_size
        return success_response({
            "total": users.count(),
            "page_size": page_size,
            "users": [{
                "id": user.id,
                "email": user.email,
                "name": f"{user.first_name} {user.last_name}".strip(),
                "organization_id": user.organization_id,
                "organization_name": user.organization.name if user.organization else None,
                "role": "platform" if user.is_superuser else "admin" if user.is_staff else "viewer",
                "is_active": user.is_active,
                "email_verified": bool(user.email_verified_at),
                "mfa_enabled": user.is_2fa_enabled,
                "last_login": user.last_login,
            } for user in users[start:start + page_size]],
        })


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
        if action != "activate":
            user.session_version += 1
        user.save(update_fields=["is_active", "is_staff", "session_version", "updated_at"])
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
