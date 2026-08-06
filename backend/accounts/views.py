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


class MeView(APIView):
    """Endpoint for current user info.

    GET /api/v1/auth/me/
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        user = request.user
        return success_response(
            {
                "id": str(user.id),
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "is_staff": user.is_staff,
                "is_active": user.is_active,
            }
        )