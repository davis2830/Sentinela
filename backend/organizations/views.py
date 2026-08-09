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


class OrganizationMembersView(APIView):
    """Endpoint for listing and inviting team members within the organization.

    GET /api/v1/organizations/members/
    POST /api/v1/organizations/members/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        org_id = request.user.organization_id
        from accounts.models import User
        users = User.objects.filter(organization_id=org_id).order_by("-created_at")
        data = [
            {
                "id": str(u.id),
                "email": u.email,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "role": "admin" if u.is_staff else "member",
                "is_active": u.is_active,
                "status_code": "active" if u.is_active and u.last_login else ("pending" if u.is_active else "revoked"),
                "status_label": "Activo" if u.is_active and u.last_login else ("Invitación Pendiente" if u.is_active else "Revocado"),
                "date_joined": u.created_at.isoformat() if u.created_at else None,
                "last_login": u.last_login.isoformat() if u.last_login else None,
            }
            for u in users
        ]
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

        # 2. Create the user
        is_staff = (role == "admin")
        temp_password = "Password123!"
        user = User.objects.create_user(
            email=email,
            password=temp_password,
            first_name=first_name,
            last_name=last_name,
            organization_id=org_id,
            is_staff=is_staff,
        )

        # 3. Send email using configured SMTP channel
        try:
            from notifications.models import Notification
            from notifications.services import EmailDeliveryHandler

            org = request.user.organization
            org_name = org.name if org else "Sentinela"

            notif = Notification(
                title=f"Invitación a la plataforma {org_name}",
                message=(
                    f"Hola {first_name or email},\n\n"
                    f"Has sido invitado a unirte a la organización '{org_name}' en Sentinela con el rol de {role.upper()}.\n\n"
                    f"Tus credenciales de acceso iniciales son:\n"
                    f"- Usuario: {email}\n"
                    f"- Contraseña temporal: {temp_password}\n\n"
                    f"Puedes iniciar sesión en: http://localhost:3000/login\n\n"
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
            user.delete()
            return error_response(
                f"Error al enviar el correo mediante el servidor SMTP: {str(exc)}. Verifica la configuración en el módulo de Notificaciones.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        return success_response({
            "id": str(user.id),
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": "admin" if user.is_staff else "member",
            "is_active": user.is_active,
            "status_code": "pending",
            "status_label": "Invitación Pendiente",
            "date_joined": user.created_at.isoformat(),
            "message": "Invitación enviada por correo electrónico con éxito.",
        }, status_code=status.HTTP_201_CREATED)


class OrganizationMemberDetailView(APIView):
    """Endpoint for revoking or deleting an invited team member.

    DELETE /api/v1/organizations/members/{user_id}/
    """

    permission_classes = (IsAuthenticated,)

    def delete(self, request, user_id):
        if str(request.user.id) == str(user_id):
            return error_response("No puedes revocar tu propio usuario.", status_code=status.HTTP_400_BAD_REQUEST)

        org_id = request.user.organization_id
        from accounts.models import User
        try:
            target_user = User.objects.get(id=user_id, organization_id=org_id)
            target_user.delete()
            return success_response({"detail": "Invitación revocada y usuario eliminado exitosamente."})
        except User.DoesNotExist:
            return error_response("Usuario no encontrado en tu organización.", status_code=status.HTTP_404_NOT_FOUND)