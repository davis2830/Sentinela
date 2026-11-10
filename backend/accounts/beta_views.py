from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from common.client_ip import get_client_ip
from common.responses import success_response, error_response
from . import beta
from .models import BetaInvitation, IdentityMail
from .platform_auth import PlatformAPIView
from .platform_beta import BetaQuery
from .platform_serializers import BetaDirectoryOutput, BetaOverviewOutput


class TokenInput(serializers.Serializer):
    token = serializers.CharField(max_length=1024, trim_whitespace=True)
    turnstile_token = serializers.CharField(
        max_length=2048, required=False, default="", allow_blank=True, write_only=True
    )


class BetaPublicView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()

    def get(self, request, operation):
        beta.consume_budget("beta-status-ip", get_client_ip(request), 120, 3600)
        if operation == "config":
            from django.conf import settings
            from .models import BetaControl

            control = BetaControl.objects.get(pk=1)
            return success_response(
                {"admissions_open": control.admissions_open, "turnstile_site_key": settings.TURNSTILE_SITE_KEY}
            )
        return error_response("Esta acción requiere confirmación.", status_code=405)

    def post(self, request, operation):
        serializer = TokenInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data["token"]
        ip = get_client_ip(request)
        beta.consume_budget(f"beta-{operation}-ip", ip, 60, 3600)
        try:
            if operation == "status":
                result = beta.verification_status(token)
            elif operation == "invitation":
                result = beta.invitation_preview(token)
            elif operation == "resend":
                beta.validate_captcha(serializer.validated_data["turnstile_token"], "resend", ip)
                result = beta.resend(token)
            elif operation == "verify":
                result = beta.verify(token)
            else:
                return error_response("Acción no disponible.", status_code=404)
            return success_response(result)
        except ValueError as exc:
            return error_response(str(exc), status_code=400)


class EmailChangeView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        class Input(serializers.Serializer):
            email = serializers.EmailField()
            password = serializers.CharField(max_length=256, write_only=True)

        serializer = Input(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            return success_response(beta.change_email(request.user, **serializer.validated_data), status_code=202)
        except ValueError as exc:
            return error_response(str(exc), status_code=400)


class BetaAdminInput(serializers.Serializer):
    action = serializers.ChoiceField(
        choices=[
            "configure",
            "invite",
            "revoke",
            "reject",
            "suspend",
            "resume",
            "resend",
            "resend_verification",
            "configure_feedback",
        ]
    )
    reason = serializers.CharField(max_length=500, min_length=3)
    email = serializers.EmailField(required=False)
    invitation_id = serializers.UUIDField(required=False)
    capacity = serializers.IntegerField(min_value=1, max_value=100, required=False)
    admissions_open = serializers.BooleanField(required=False)
    feedback_submission_url = serializers.URLField(max_length=2048, required=False, allow_blank=True)
    feedback_management_url = serializers.URLField(max_length=2048, required=False, allow_blank=True)


class BetaAdminView(PlatformAPIView):
    query_serializer = BetaQuery
    output_serializer = {"get": BetaDirectoryOutput}

    def get(self, request):
        from .models import BetaControl
        from .platform_beta import directory

        control = BetaControl.objects.get(pk=1)
        invitations, meta = directory(request.query_params)
        reserved = beta.reserved_slots()
        return success_response(
            {
                "admissions_open": control.admissions_open,
                "capacity": control.capacity,
                "reserved": reserved,
                "available": max(0, control.capacity - reserved),
                "has_next": meta["has_next"],
                "invitations": invitations,
                "total": meta["total"],
                "page_size": 25,
                "page": meta["page"],
                "feedback_submission_url": control.feedback_submission_url,
                "feedback_management_url": control.feedback_management_url,
            }
        )

    def post(self, request):
        serializer = BetaAdminInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        action, reason = data["action"], data["reason"]
        try:
            if action == "invite":
                if not data.get("email"):
                    raise ValueError("Indica el correo de la invitación.")
                inv = beta.issue_invitation(request.user, data["email"], reason)
                return success_response(
                    {"id": str(inv.id), "status": inv.status, "delivery_status": "queued"}, status_code=202
                )
            if action in ("suspend", "resume"):
                # Access transitions lock organization -> invitations. Do not acquire
                # a capacity/invitation lock first: the directory uses the same service.
                with transaction.atomic():
                    inv = (
                        BetaInvitation.objects.select_related("user__organization")
                        .filter(pk=data.get("invitation_id"))
                        .first()
                    )
                    if (
                        not inv
                        or not inv.user_id
                        or not inv.user.organization_id
                        or inv.status not in ("active", "suspended")
                    ):
                        raise ValueError("Solo puedes suspender o reactivar una organización beta activa.")
                    from organizations.platform_access import change_access

                    change_access(
                        organization_id=inv.user.organization_id,
                        actor=request.user,
                        action="suspend" if action == "suspend" else "reactivate",
                        reason=reason,
                    )
                    inv.refresh_from_db()
                    inv.reason = reason
                    inv.operator = request.user
                    inv.save(update_fields=["reason", "operator"])
                    beta.audit(request.user, f"Acción beta {action}. Motivo: {reason}", inv, inv.user.organization)
                return success_response({"message": "Cambio registrado."})
            with transaction.atomic():
                control = beta.control_lock()
                if action == "configure_feedback":
                    from urllib.parse import urlsplit

                    for key in ("feedback_submission_url", "feedback_management_url"):
                        value = data.get(key, getattr(control, key))
                        parsed = urlsplit(value)
                        if value and (parsed.scheme != "https" or parsed.username or parsed.password):
                            raise ValueError("Utiliza un enlace HTTPS sin credenciales.")
                        setattr(control, key, value)
                    if control.feedback_management_url and not control.feedback_submission_url:
                        raise ValueError("Configura primero el formulario de comentarios.")
                    control.save(update_fields=["feedback_submission_url", "feedback_management_url"])
                    beta.audit(request.user, "Canal externo de comentarios actualizado. Motivo: " + reason)
                elif action == "configure":
                    from django.conf import settings

                    if data.get("admissions_open") and not settings.DEBUG:
                        errors = beta.delivery_configuration_errors()
                        if errors:
                            raise ValueError(" ".join(errors))
                    if data.get("capacity", control.capacity) < beta.reserved_slots():
                        raise ValueError("Los cupos no pueden ser menores que las reservas vigentes.")
                    control.capacity = data.get("capacity", control.capacity)
                    control.admissions_open = data.get("admissions_open", control.admissions_open)
                    control.save()
                    beta.audit(
                        request.user,
                        f"Configuración beta: cupos {control.capacity}, abierta {control.admissions_open}. Motivo: {reason}",
                    )
                else:
                    inv = BetaInvitation.objects.select_for_update().filter(pk=data.get("invitation_id")).first()
                    if not inv:
                        raise ValueError("La invitación no existe.")
                    if action in ("revoke", "reject"):
                        if inv.status not in ("invited", "pending_verification"):
                            raise ValueError("Para una organización activa utiliza Suspender.")
                        inv.status = "revoked" if action == "revoke" else "rejected"
                        if inv.user_id:
                            inv.user.emailchallenge_set.filter(used_at=None).update(revoked_at=timezone.now())
                    elif action == "resend_verification":
                        if (
                            not control.admissions_open
                            or inv.status != "pending_verification"
                            or inv.expires_at <= timezone.now()
                        ):
                            raise ValueError(
                                "Se requiere un registro pendiente con invitación vigente y admisiones abiertas."
                            )
                        from .models import User

                        user = User.objects.select_for_update().get(pk=inv.user_id)
                        if (
                            not user.is_active
                            or not user.verification_required
                            or user.email_verified_at
                            or user.organization_id
                        ):
                            raise ValueError("Esta cuenta no requiere verificación de registro.")
                        beta.resend(beta.session_for(user))
                    elif action == "resend":
                        if inv.status != "invited" or not control.admissions_open:
                            raise ValueError("Solo puedes reenviar invitaciones pendientes con admisiones abiertas.")
                        if inv.expires_at <= timezone.now() and beta.reserved_slots() >= control.capacity:
                            raise ValueError("No quedan cupos para renovar la invitación.")
                        beta.consume_budget("invite-resend", str(inv.pk), 5, 86400)
                        import secrets
                        from datetime import timedelta

                        token = secrets.token_urlsafe(32)
                        inv.token_hash = beta.digest(token)
                        inv.expires_at = timezone.now() + timedelta(days=7)
                        IdentityMail.objects.filter(invitation=inv, status__in=["queued", "failed"]).update(
                            status="expired", encrypted_body=""
                        )
                        beta.queue_mail(
                            inv.email,
                            "Nueva invitación a Sentinel",
                            beta.public_link("register", token),
                            inv.expires_at,
                            invitation=inv,
                        )
                    inv.reason = reason
                    inv.operator = request.user
                    inv.save()
                    beta.audit(
                        request.user,
                        f"Acción beta {action}. Motivo: {reason}",
                        inv,
                        inv.user.organization if inv.user_id else None,
                    )
            return success_response({"message": "Cambio registrado."})
        except ValueError as exc:
            return error_response(str(exc), status_code=400)


class BetaOverviewView(PlatformAPIView):
    output_serializer = BetaOverviewOutput

    def get(self, request):
        from .platform_beta import overview

        return success_response(overview())
