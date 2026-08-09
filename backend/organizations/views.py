from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from common.responses import error_response, success_response

from .serializers import (
    OrganizationCreateSerializer,
    OrganizationSerializer,
    OrganizationUpdateSerializer,
)
from .services import OrganizationService


class OrganizationListView(APIView):
    """Endpoint for listing and creating organizations.

    GET /api/v1/organizations/
    POST /api/v1/organizations/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        organizations = OrganizationService.list_organizations()
        serializer = OrganizationSerializer(organizations, many=True)
        return success_response(serializer.data)

    def post(self, request):
        serializer = OrganizationCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            organization = OrganizationService.create_organization(
                name=serializer.validated_data["name"],
                slug=serializer.validated_data["slug"],
                timezone=serializer.validated_data.get("timezone", "UTC"),
                locale=serializer.validated_data.get("locale", "en-US"),
            )
            response_serializer = OrganizationSerializer(organization)
            return success_response(
                response_serializer.data,
                status_code=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            return error_response(
                str(exc), status_code=status.HTTP_400_BAD_REQUEST
            )


class OrganizationDetailView(APIView):
    """Endpoint for retrieving, updating, and deleting an organization.

    GET /api/v1/organizations/{id}/
    PATCH /api/v1/organizations/{id}/
    DELETE /api/v1/organizations/{id}/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request, organization_id):
        try:
            organization = OrganizationService.get_organization(organization_id)
            serializer = OrganizationSerializer(organization)
            return success_response(serializer.data)
        except Organization.DoesNotExist:
            return error_response(
                "Organization not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

    def patch(self, request, organization_id):
        serializer = OrganizationUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            organization = OrganizationService.update_organization(
                organization_id, **serializer.validated_data
            )
            response_serializer = OrganizationSerializer(organization)
            return success_response(response_serializer.data)
        except Organization.DoesNotExist:
            return error_response(
                "Organization not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

    def delete(self, request, organization_id):
        try:
            OrganizationService.delete_organization(organization_id)
            return success_response({"detail": "Organization deleted."})
        except Organization.DoesNotExist:
            return error_response(
                "Organization not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )


from rest_framework.permissions import AllowAny, IsAuthenticated

class OrganizationMembersView(APIView):
    """Endpoint for listing and inviting team members within the organization.

    GET /api/v1/organizations/members/
    POST /api/v1/organizations/members/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        from accounts.models import User
        from .models import InvitationToken

        users = User.objects.filter(organization_id=org_id).order_by("-created_at")
        registered_emails = set()

        data = []
        for u in users:
            registered_emails.add(u.email)
            data.append({
                "id": str(u.id),
                "email": u.email,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "role": "admin" if u.is_staff else "member",
                "is_active": u.is_active,
                "status_code": "active" if u.is_active else "revoked",
                "status_label": "Activo" if u.is_active else "Revocado",
                "date_joined": u.created_at.isoformat() if u.created_at else None,
                "last_login": u.last_login.isoformat() if u.last_login else None,
                "is_invitation": False,
            })

        # Add active pending invitations
        pending_invites = InvitationToken.objects.filter(
            organization_id=org_id, is_used=False
        ).order_by("-created_at")

        for inv in pending_invites:
            if inv.email not in registered_emails and inv.is_valid():
                data.append({
                    "id": str(inv.id),
                    "email": inv.email,
                    "first_name": inv.first_name,
                    "last_name": inv.last_name,
                    "role": inv.role,
                    "is_active": False,
                    "status_code": "pending",
                    "status_label": "Invitación Pendiente",
                    "date_joined": inv.created_at.isoformat() if inv.created_at else None,
                    "last_login": None,
                    "is_invitation": True,
                })

        return success_response(data)

    def post(self, request):
        org_id = request.user.organization_id
        email = request.data.get("email", "").strip().lower()
        role = request.data.get("role", "member")
        first_name = request.data.get("first_name", "")
        last_name = request.data.get("last_name", "")

        if not email:
            return error_response("El correo electrónico es requerido.", status_code=status.HTTP_400_BAD_REQUEST)

        from accounts.models import User
        if User.objects.filter(email=email).exists():
            return error_response("Un usuario con este correo ya está registrado.", status_code=status.HTTP_400_BAD_REQUEST)

        # 1. Check if organization has an active email/SMTP channel
        from notifications.models import NotificationChannel
        email_channel = NotificationChannel.objects.filter(
            organization_id=org_id,
            channel_type="email",
            enabled=True,
        ).first()

        if not email_channel:
            return error_response(
                "No se puede enviar la invitación porque tu organización no tiene configurado un canal de correo (SMTP). Por favor ve al módulo de Notificaciones y agrega primero un canal de tipo Email.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # 2. Create InvitationToken for secure magic link invitation
        from .models import InvitationToken, Organization
        org = Organization.objects.get(id=org_id)

        # Remove previous unused pending invitations for this email
        InvitationToken.objects.filter(organization=org, email=email, is_used=False).delete()

        inv_token = InvitationToken.create_invitation(
            organization=org,
            email=email,
            role=role,
            first_name=first_name,
            last_name=last_name,
        )

        invite_link = f"http://localhost:3000/accept-invitation?token={inv_token.token}"

        # 3. Send email with magic link
        try:
            from notifications.models import Notification
            from notifications.services import EmailDeliveryHandler

            org_name = org.name or "Sentinela"

            notif = Notification(
                title=f"Invitación de acceso a {org_name}",
                message=(
                    f"Hola {first_name or email},\n\n"
                    f"Has sido invitado a unirte a la organización '{org_name}' en la plataforma Sentinela con el rol de {role.upper()}.\n\n"
                    f"Para activar tu cuenta y definir tu contraseña personal de forma segura, ingresa al siguiente enlace:\n\n"
                    f"{invite_link}\n\n"
                    f"Nota: Este enlace seguro es de un solo uso y expira en 48 horas.\n\n"
                    f"Saludos,\nEl equipo de Sentinela"
                ),
            )

            channel_copy = NotificationChannel(
                name=email_channel.name,
                channel_type=email_channel.channel_type,
                config={
                    **email_channel.config,
                    "recipients": [email],
                },
            )
            EmailDeliveryHandler.send(channel_copy, notif)
        except Exception as exc:
            inv_token.delete()
            return error_response(
                f"Error al enviar el correo mediante el servidor SMTP: {str(exc)}. Verifica la configuración en el módulo de Notificaciones.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        return success_response({
            "id": str(inv_token.id),
            "email": inv_token.email,
            "first_name": inv_token.first_name,
            "last_name": inv_token.last_name,
            "role": inv_token.role,
            "is_active": False,
            "status_code": "pending",
            "status_label": "Invitación Pendiente",
            "date_joined": inv_token.created_at.isoformat(),
            "message": "Enlace seguro de invitación enviado por correo electrónico con éxito.",
        }, status_code=status.HTTP_201_CREATED)


class OrganizationMemberDetailView(APIView):
    """Endpoint for revoking or deleting an invited team member.

    DELETE /api/v1/organizations/members/{id}/
    """

    permission_classes = (IsAuthenticated,)

    def delete(self, request, user_id):
        if str(request.user.id) == str(user_id):
            return error_response("No puedes revocar tu propio usuario.", status_code=status.HTTP_400_BAD_REQUEST)

        org_id = request.user.organization_id
        from accounts.models import User
        from .models import InvitationToken

        # Try revoking registered user
        try:
            target_user = User.objects.get(id=user_id, organization_id=org_id)
            target_user.delete()
            return success_response({"detail": "Usuario eliminado exitosamente."})
        except User.DoesNotExist:
            pass

        # Try revoking pending invitation token
        try:
            inv = InvitationToken.objects.get(id=user_id, organization_id=org_id)
            inv.delete()
            return success_response({"detail": "Invitación revocada exitosamente."})
        except InvitationToken.DoesNotExist:
            return error_response("Miembro o invitación no encontrada.", status_code=status.HTTP_404_NOT_FOUND)


class ValidateInvitationView(APIView):
    """Endpoint to validate an invitation magic link token.

    GET /api/v1/organizations/invitations/validate/?token=XYZ
    """

    permission_classes = (AllowAny,)

    def get(self, request):
        token_str = request.query_params.get("token")
        if not token_str:
            return error_response("El token de invitación es requerido.", status_code=status.HTTP_400_BAD_REQUEST)

        from .models import InvitationToken
        try:
            inv = InvitationToken.objects.get(token=token_str)
            if not inv.is_valid():
                return error_response("El enlace de invitación ha expirado o ya fue utilizado.", status_code=status.HTTP_400_BAD_REQUEST)

            return success_response({
                "valid": True,
                "email": inv.email,
                "first_name": inv.first_name,
                "last_name": inv.last_name,
                "role": inv.role,
                "organization_name": inv.organization.name,
            })
        except InvitationToken.DoesNotExist:
            return error_response("El token de invitación no es válido.", status_code=status.HTTP_404_NOT_FOUND)


class AcceptInvitationView(APIView):
    """Endpoint to accept an invitation and define password.

    POST /api/v1/organizations/invitations/accept/
    """

    permission_classes = (AllowAny,)

    def post(self, request):
        token_str = request.data.get("token")
        password = request.data.get("password")

        if not token_str or not password:
            return error_response("El token y la contraseña son requeridos.", status_code=status.HTTP_400_BAD_REQUEST)

        if len(password) < 8:
            return error_response("La contraseña debe tener al menos 8 caracteres.", status_code=status.HTTP_400_BAD_REQUEST)

        from .models import InvitationToken
        try:
            inv = InvitationToken.objects.get(token=token_str)
            if not inv.is_valid():
                return error_response("El enlace de invitación ha expirado o ya fue utilizado.", status_code=status.HTTP_400_BAD_REQUEST)

            from accounts.models import User
            from django.utils import timezone

            is_staff = (inv.role == "admin")
            existing_user = User.objects.filter(email=inv.email).first()

            if existing_user:
                if existing_user.organization_id and existing_user.organization_id != inv.organization_id:
                    return error_response("Un usuario con este correo ya pertenece a otra organización.", status_code=status.HTTP_400_BAD_REQUEST)

                user = existing_user
                user.set_password(password)
                user.organization = inv.organization
                user.is_staff = is_staff
                user.is_active = True
                if inv.first_name:
                    user.first_name = inv.first_name
                if inv.last_name:
                    user.last_name = inv.last_name
                user.last_login = timezone.now()
                user.save()
            else:
                user = User.objects.create_user(
                    email=inv.email,
                    password=password,
                    first_name=inv.first_name,
                    last_name=inv.last_name,
                    organization=inv.organization,
                    is_staff=is_staff,
                    is_active=True,
                )
                user.last_login = timezone.now()
                user.save(update_fields=["last_login"])

            # Mark token as used
            inv.is_used = True
            inv.save(update_fields=["is_used"])

            from rest_framework_simplejwt.tokens import RefreshToken
            refresh = RefreshToken.for_user(user)

            return success_response({
                "access_token": str(refresh.access_token),
                "refresh_token": str(refresh),
                "user": {
                    "id": str(user.id),
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "is_staff": user.is_staff,
                },
                "message": "Cuenta activada exitosamente."
            })
        except InvitationToken.DoesNotExist:
            return error_response("El token de invitación no es válido.", status_code=status.HTTP_404_NOT_FOUND)