from rest_framework import serializers

from accounts.models import User

from .models import Permission, Role, UserRole


class PermissionSerializer(serializers.ModelSerializer):
    """Serializer for Permission model."""

    class Meta:
        model = Permission
        fields = ("id", "code", "name", "module", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")


class RoleSerializer(serializers.ModelSerializer):
    """Serializer for Role model."""

    permissions = PermissionSerializer(many=True, read_only=True)
    permission_codes = serializers.ListField(
        child=serializers.CharField(max_length=100),
        required=False,
        write_only=True,
    )

    class Meta:
        model = Role
        fields = (
            "id",
            "name",
            "organization",
            "permissions",
            "permission_codes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization", "created_at", "updated_at")


class UserListSerializer(serializers.ModelSerializer):
    """Serializer for listing users."""

    roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "is_active",
            "is_staff",
            "last_login",
            "roles",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "last_login", "created_at", "updated_at")

    def get_roles(self, obj):
        """Return role names for the user."""
        user_roles = UserRole.objects.filter(user=obj).select_related("role")
        return [{"id": str(ur.role.id), "name": ur.role.name} for ur in user_roles]


class UserCreateSerializer(serializers.Serializer):
    """Serializer for user creation."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=150, required=False, default="")
    last_name = serializers.CharField(max_length=150, required=False, default="")
    role = serializers.CharField(max_length=20, required=False, default="member")
    is_active = serializers.BooleanField(required=False, default=True)


class UserUpdateSerializer(serializers.Serializer):
    """Serializer for user updates."""

    email = serializers.EmailField(required=False)
    first_name = serializers.CharField(max_length=150, required=False)
    last_name = serializers.CharField(max_length=150, required=False)
    role = serializers.CharField(max_length=20, required=False)
    is_active = serializers.BooleanField(required=False)


class AssignRoleSerializer(serializers.Serializer):
    """Serializer for assigning a role to a user."""

    role_id = serializers.UUIDField()