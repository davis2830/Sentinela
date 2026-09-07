from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from common.responses import error_response, success_response

from .serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    LogoutSerializer,
    RefreshTokenSerializer,
    RegisterSerializer,
)
from .services import AuthService


class LoginView(APIView):
    """Endpoint for user login.

    POST /api/v1/auth/login/
    """

    permission_classes = (AllowAny,)

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = AuthService.login(
                email=serializer.validated_data["email"],
                password=serializer.validated_data["password"],
            )
            return success_response(result)
        except ValueError as exc:
            return error_response(
                str(exc), status_code=status.HTTP_401_UNAUTHORIZED
            )


class RegisterView(APIView):
    """Endpoint for user registration.

    POST /api/v1/auth/register/
    """

    permission_classes = (AllowAny,)

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = AuthService.register(
                email=serializer.validated_data["email"],
                password=serializer.validated_data["password"],
                first_name=serializer.validated_data.get("first_name", ""),
                last_name=serializer.validated_data.get("last_name", ""),
            )
            return success_response(
                result,
                status_code=status.HTTP_201_CREATED,
            )
        except ValueError as exc:
            return error_response(
                str(exc), status_code=status.HTTP_400_BAD_REQUEST
            )


class LogoutView(APIView):
    """Endpoint for user logout.

    POST /api/v1/auth/logout/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            AuthService.logout(
                refresh_token=serializer.validated_data["refresh_token"],
            )
            return success_response({"detail": "Logout successful."})
        except ValueError as exc:
            return error_response(
                str(exc), status_code=status.HTTP_400_BAD_REQUEST
            )


class RefreshTokenView(APIView):
    """Endpoint for token refresh.

    POST /api/v1/auth/refresh/
    """

    permission_classes = (AllowAny,)

    def post(self, request):
        serializer = RefreshTokenSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = AuthService.refresh_token(
                refresh_token=serializer.validated_data["refresh_token"],
            )
            return success_response(result)
        except ValueError as exc:
            return error_response(
                str(exc), status_code=status.HTTP_401_UNAUTHORIZED
            )


class ChangePasswordView(APIView):
    """Endpoint for password change.

    POST /api/v1/auth/password/change/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            AuthService.change_password(
                user=request.user,
                old_password=serializer.validated_data["old_password"],
                new_password=serializer.validated_data["new_password"],
            )
            return success_response({"detail": "Password changed successfully."})
        except ValueError as exc:
            return error_response(
                str(exc), status_code=status.HTTP_400_BAD_REQUEST
            )


import secrets
from .models import APIToken, User
from .serializers import (
    APITokenCreateSerializer,
    APITokenSerializer,
    ChangePasswordSerializer,
    LoginSerializer,
    LogoutSerializer,
    RefreshTokenSerializer,
    RegisterSerializer,
    UserUpdateSerializer,
)


class MeView(APIView):
    """Endpoint for current user info and profile updates.

    GET /api/v1/auth/me/
    PATCH /api/v1/auth/me/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        user = request.user
        org_data = None
        if user.organization:
            org_data = {
                "id": str(user.organization.id),
                "name": user.organization.name,
                "timezone": user.organization.timezone,
                "locale": user.organization.locale,
            }

        # Teams the user belongs to
        user_teams = [
            {
                "id": str(t.id),
                "name": t.name,
                "color": t.color,
                "is_lead": t.lead_id == user.id,
            }
            for t in user.teams.all()
        ]

        return success_response(
            {
                "id": str(user.id),
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "phone_number": user.phone_number or "",
                "timezone": user.timezone or (user.organization.timezone if user.organization else "UTC"),
                "notification_preferences": user.notification_preferences or {},
                "role": "admin" if user.is_staff else "operator",
                "is_staff": user.is_staff,
                "is_active": user.is_active,
                "last_login": user.last_login.isoformat() if user.last_login else None,
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "teams": user_teams,
                "organization": org_data,
            }
        )

    def patch(self, request):
        user = request.user
        serializer = UserUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if "first_name" in serializer.validated_data:
            user.first_name = serializer.validated_data["first_name"]
        if "last_name" in serializer.validated_data:
            user.last_name = serializer.validated_data["last_name"]
        if "phone_number" in serializer.validated_data:
            user.phone_number = serializer.validated_data["phone_number"]
        if "timezone" in serializer.validated_data:
            user.timezone = serializer.validated_data["timezone"]
        if "notification_preferences" in serializer.validated_data:
            user.notification_preferences = serializer.validated_data["notification_preferences"]
        if "email" in serializer.validated_data:
            email = serializer.validated_data["email"]
            if User.objects.filter(email=email).exclude(id=user.id).exists():
                return error_response(
                    "A user with this email already exists.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            user.email = email

        user.save()

        org_data = None
        if user.organization:
            org_data = {
                "id": str(user.organization.id),
                "name": user.organization.name,
                "timezone": user.organization.timezone,
                "locale": user.organization.locale,
            }

        user_teams = [
            {
                "id": str(t.id),
                "name": t.name,
                "color": t.color,
                "is_lead": t.lead_id == user.id,
            }
            for t in user.teams.all()
        ]

        from audit.services import AuditService
        AuditService.log(
            action="update",
            module="accounts",
            organization_id=user.organization_id,
            user_id=user.id,
            user_email=user.email,
            description=f"El usuario {user.email} actualizó sus datos de perfil.",
        )

        return success_response(
            {
                "id": str(user.id),
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "phone_number": user.phone_number or "",
                "timezone": user.timezone or (user.organization.timezone if user.organization else "UTC"),
                "notification_preferences": user.notification_preferences or {},
                "role": "admin" if user.is_staff else "operator",
                "is_staff": user.is_staff,
                "is_active": user.is_active,
                "last_login": user.last_login.isoformat() if user.last_login else None,
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "teams": user_teams,
                "organization": org_data,
            }
        )


class RevokeSessionsView(APIView):
    """Endpoint for revoking remote sessions / refresh tokens of the current user.

    POST /api/v1/auth/revoke-sessions/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        user = request.user
        from audit.services import AuditService
        AuditService.log(
            action="logout",
            module="accounts",
            organization_id=user.organization_id,
            user_id=user.id,
            user_email=user.email,
            description=f"El usuario {user.email} revocó todas sus sesiones activas.",
        )

        return success_response({"detail": "Todas las demás sesiones remotas han sido revocadas exitosamente."})


class APITokenListView(APIView):
    """Endpoint for listing and creating user API tokens.

    GET /api/v1/auth/api-tokens/
    POST /api/v1/auth/api-tokens/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        tokens = APIToken.objects.filter(user=request.user)
        serializer = APITokenSerializer(tokens, many=True)
        return success_response(serializer.data)

    def post(self, request):
        serializer = APITokenCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        expires_in_days = serializer.validated_data.get("expires_in_days")
        expires_at = None
        if expires_in_days:
            from datetime import timedelta
            from django.utils import timezone
            expires_at = timezone.now() + timedelta(days=expires_in_days)

        raw_token = f"snt_{secrets.token_hex(24)}"
        api_token = APIToken.objects.create(
            user=request.user,
            name=serializer.validated_data["name"],
            scope=serializer.validated_data.get("scope", "full"),
            expires_at=expires_at,
            token=raw_token,
        )

        from audit.services import AuditService
        AuditService.log(
            action="create",
            module="accounts",
            organization_id=request.user.organization_id,
            user_id=request.user.id,
            user_email=request.user.email,
            description=f"El usuario {request.user.email} generó el API token '{api_token.name}'.",
        )

        response_serializer = APITokenSerializer(api_token)
        return success_response(
            response_serializer.data,
            status_code=status.HTTP_201_CREATED,
        )


class APITokenDetailView(APIView):
    """Endpoint for deleting an API token.

    DELETE /api/v1/auth/api-tokens/{id}/
    """

    permission_classes = (IsAuthenticated,)

    def delete(self, request, token_id):
        try:
            token = APIToken.objects.get(id=token_id, user=request.user)
            token_name = token.name
            token.delete()

            from audit.services import AuditService
            AuditService.log(
                action="delete",
                module="accounts",
                organization_id=request.user.organization_id,
                user_id=request.user.id,
                user_email=request.user.email,
                description=f"El usuario {request.user.email} revocó el API token '{token_name}'.",
            )

            return success_response({"detail": "API token revoked."})
        except APIToken.DoesNotExist:
            return error_response(
                "API token not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )