from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from common.client_ip import get_client_ip
from common.responses import success_response, error_response
from . import beta
from .models import BetaInvitation, IdentityMail


class TokenInput(serializers.Serializer):
    token = serializers.CharField(max_length=1024, trim_whitespace=True)
    turnstile_token = serializers.CharField(max_length=2048, required=False, default="", allow_blank=True, write_only=True)


class BetaPublicView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()

    def get(self, request, operation):
        beta.consume_budget("beta-status-ip", get_client_ip(request), 120, 3600)
        if operation == "config":
            from django.conf import settings
            from .models import BetaControl
            control = BetaControl.objects.get(pk=1)
            return success_response({"admissions_open": control.admissions_open,
                                     "turnstile_site_key": settings.TURNSTILE_SITE_KEY})
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


class BetaAdminView(APIView):
    permission_classes = (IsAuthenticated,)

    def check_permissions(self, request):
        super().check_permissions(request)
        if not request.user.is_superuser:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Solo la administración de plataforma puede gestionar la beta.")

    def get(self, request):
        from .models import BetaControl
        control = BetaControl.objects.get(pk=1)
        invitations = list(BetaInvitation.objects.order_by("-created_at").values(
            "id", "email", "status", "expires_at", "created_at", "reason", "user__organization_id")[:100])
        # Metadata only, including real SMTP acceptance rather than a delivery promise.
        mails = IdentityMail.objects.filter(invitation_id__in=[item["id"] for item in invitations]).order_by("-created_at")
        delivery = {}
        for mail in mails.values("invitation_id", "status", "attempts"):
            delivery.setdefault(mail["invitation_id"], {"status": mail["status"], "attempts": mail["attempts"]})
        for item in invitations:
            item["delivery"] = delivery.get(item["id"])
        return success_response({"admissions_open": control.admissions_open, "capacity": control.capacity,
                                 "invitations": invitations})

    def post(self, request):
        class Input(serializers.Serializer):
            action = serializers.ChoiceField(choices=["configure", "invite", "revoke", "reject", "suspend", "resume", "resend"])
            reason = serializers.CharField(max_length=500, min_length=3)
            email = serializers.EmailField(required=False)
            invitation_id = serializers.UUIDField(required=False)
            capacity = serializers.IntegerField(min_value=1, max_value=100, required=False)
            admissions_open = serializers.BooleanField(required=False)
        serializer = Input(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        action, reason = data["action"], data["reason"]
        try:
            if action == "invite":
                if not data.get("email"):
                    raise ValueError("Indica el correo de la invitación.")
                inv = beta.issue_invitation(request.user, data["email"], reason)
                return success_response({"id": str(inv.id), "status": inv.status, "delivery_status": "queued"}, status_code=202)
            with transaction.atomic():
                control = beta.control_lock()
                if action == "configure":
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
                    beta.audit(request.user, f"Configuración beta: cupos {control.capacity}, abierta {control.admissions_open}. Motivo: {reason}")
                else:
                    inv = BetaInvitation.objects.select_for_update().filter(pk=data.get("invitation_id")).first()
                    if not inv:
                        raise ValueError("La invitación no existe.")
                    if action in ("suspend", "resume"):
                        if not inv.user_id or not inv.user.organization_id or inv.status not in ("active", "suspended"):
                            raise ValueError("Solo puedes suspender o reactivar una organización beta activa.")
                        inv.status = "suspended" if action == "suspend" else "active"
                        org = inv.user.organization
                        org.beta_status = inv.status
                        org.save(update_fields=["beta_status"])
                    elif action in ("revoke", "reject"):
                        if inv.status not in ("invited", "pending_verification"):
                            raise ValueError("Para una organización activa utiliza Suspender.")
                        inv.status = "revoked" if action == "revoke" else "rejected"
                        if inv.user_id:
                            inv.user.emailchallenge_set.filter(used_at=None).update(revoked_at=timezone.now())
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
                            status="expired", encrypted_body="")
                        beta.queue_mail(inv.email, "Nueva invitación a Sentinel", beta.public_link("register", token),
                                        inv.expires_at, invitation=inv)
                    inv.reason = reason
                    inv.operator = request.user
                    inv.save()
                    beta.audit(request.user, f"Acción beta {action}. Motivo: {reason}", inv,
                               inv.user.organization if inv.user_id else None)
            return success_response({"message": "Cambio registrado."})
        except ValueError as exc:
            return error_response(str(exc), status_code=400)
