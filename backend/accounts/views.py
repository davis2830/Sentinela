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
        return success_response(
            {
                "id": str(user.id),
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "is_staff": user.is_staff,
                "is_active": user.is_active,
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

        return success_response(
            {
                "id": str(user.id),
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "is_staff": user.is_staff,
                "is_active": user.is_active,
                "organization": org_data,
            }
        )


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

        raw_token = f"snt_{secrets.token_hex(24)}"
        api_token = APIToken.objects.create(
            user=request.user,
            name=serializer.validated_data["name"],
            token=raw_token,
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
            token.delete()
            return success_response({"detail": "API token revoked."})
        except APIToken.DoesNotExist:
            return error_response(
                "API token not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )