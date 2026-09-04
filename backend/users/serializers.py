from rest_framework import serializers

from accounts.models import User

from .models import Permission, Role, Team, UserRole


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
    teams = serializers.SerializerMethodField()

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
            "teams",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "last_login", "created_at", "updated_at")

    def get_roles(self, obj):
        """Return role names for the user."""
        user_roles = UserRole.objects.filter(user=obj).select_related("role")
        return [{"id": str(ur.role.id), "name": ur.role.name} for ur in user_roles]

    def get_teams(self, obj):
        """Return teams assigned to the user."""
        return [
            {"id": str(t.id), "name": t.name, "color": t.color}
            for t in obj.teams.all()
        ]


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


class TeamMemberMiniSerializer(serializers.ModelSerializer):
    """Minimal member representation for team payloads."""

    class Meta:
        model = User
        fields = ("id", "email", "first_name", "last_name", "is_active")


class TeamSerializer(serializers.ModelSerializer):
    """Serializer for Team model."""

    members = TeamMemberMiniSerializer(many=True, read_only=True)
    member_count = serializers.SerializerMethodField()
    lead = TeamMemberMiniSerializer(read_only=True)
    assigned_incidents_count = serializers.SerializerMethodField()
    assigned_targets_count = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = (
            "id",
            "name",
            "description",
            "organization",
            "color",
            "lead",
            "contact_email",
            "members",
            "member_count",
            "assigned_incidents_count",
            "assigned_targets_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization", "created_at", "updated_at")

    def get_member_count(self, obj):
        return obj.members.count()

    def get_assigned_incidents_count(self, obj):
        return obj.assigned_incidents.exclude(status="closed").count()

    def get_assigned_targets_count(self, obj):
        return obj.monitoring_targets.count()


class TeamCreateUpdateSerializer(serializers.Serializer):
    """Serializer for creating or editing a team."""

    name = serializers.CharField(max_length=100)
    description = serializers.CharField(required=False, default="", allow_blank=True)
    color = serializers.CharField(max_length=30, required=False, default="#10B981")
    lead_id = serializers.UUIDField(required=False, allow_null=True)
    contact_email = serializers.EmailField(required=False, allow_blank=True, default="")
    member_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list
    )


class TeamMembersUpdateSerializer(serializers.Serializer):
    """Serializer for updating team members."""

    action = serializers.ChoiceField(choices=["add", "remove", "set"])
    member_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1)