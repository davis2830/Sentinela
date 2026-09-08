from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "phone_number",
            "timezone",
            "notification_preferences",
            "is_active",
            "is_staff",
            "last_login",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "last_login", "created_at", "updated_at")


class LoginSerializer(serializers.Serializer):
    """Serializer for login request."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class RefreshTokenSerializer(serializers.Serializer):
    """Serializer for token refresh request."""

    refresh_token = serializers.CharField(write_only=True)


class LogoutSerializer(serializers.Serializer):
    """Serializer for logout request."""

    refresh_token = serializers.CharField(write_only=True)


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for password change request."""

    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)


class RegisterSerializer(serializers.Serializer):
    """Serializer for user registration request."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=150, required=False, default="")
    last_name = serializers.CharField(max_length=150, required=False, default="")
    organization_name = serializers.CharField(max_length=255, required=False, default="")


class UserUpdateSerializer(serializers.Serializer):
    """Serializer for updating user profile."""

    first_name = serializers.CharField(max_length=150, required=False)
    last_name = serializers.CharField(max_length=150, required=False)
    email = serializers.EmailField(required=False)
    phone_number = serializers.CharField(max_length=50, required=False, allow_blank=True)
    timezone = serializers.CharField(max_length=50, required=False, allow_blank=True)
    notification_preferences = serializers.DictField(required=False)


from .models import APIToken


class APITokenSerializer(serializers.ModelSerializer):
    """Serializer for APIToken model."""

    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = APIToken
        fields = ("id", "name", "token", "scope", "expires_at", "is_expired", "created_at", "last_used_at")
        read_only_fields = ("id", "token", "is_expired", "created_at", "last_used_at")


class APITokenCreateSerializer(serializers.Serializer):
    """Serializer for APIToken creation."""

    name = serializers.CharField(max_length=255)
    scope = serializers.ChoiceField(choices=["read", "full"], default="full", required=False)
    expires_in_days = serializers.IntegerField(required=False, allow_null=True)