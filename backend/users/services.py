from django.db import transaction

from accounts.models import User

from .models import Permission, Role, UserRole


class UserService:
    """Service for user management within an organization.

    Handles CRUD operations for users, role assignment, and
    permission checking. All business logic lives here.
    """

    @staticmethod
    def list_users(organization_id):
        """Return all users belonging to an organization."""
        return User.objects.filter(organization_id=organization_id).order_by(
            "-created_at"
        )

    @staticmethod
    def get_user(user_id, organization_id):
        """Return a single user by ID within an organization.

        Raises:
            User.DoesNotExist if not found.
        """
        return User.objects.get(id=user_id, organization_id=organization_id)

    @staticmethod
    @transaction.atomic
    def create_user(
        email,
        password,
        organization_id,
        first_name="",
        last_name="",
        role="member",
        is_active=True,
    ):
        """Create a new user within an organization."""
        is_staff = (role == "admin")
        return User.objects.create_user(
            email=email,
            password=password,
            organization_id=organization_id,
            first_name=first_name,
            last_name=last_name,
            is_staff=is_staff,
            is_active=is_active,
        )

    @staticmethod
    @transaction.atomic
    def update_user(user_id, organization_id, **fields):
        """Update an existing user."""
        user = User.objects.get(id=user_id, organization_id=organization_id)
        
        if "role" in fields and fields["role"] is not None:
            user.is_staff = (fields.pop("role") == "admin")
            
        for field, value in fields.items():
            if value is not None:
                setattr(user, field, value)
        user.save()
        return user

    @staticmethod
    @transaction.atomic
    def delete_user(user_id, organization_id):
        """Delete a user from an organization."""
        user = User.objects.get(id=user_id, organization_id=organization_id)
        user.delete()

    @staticmethod
    @transaction.atomic
    def assign_role(user_id, role_id):
        """Assign a role to a user.

        Args:
            user_id: UUID of the user.
            role_id: UUID of the role.

        Returns:
            The created UserRole instance.
        """
        user = User.objects.get(id=user_id)
        role = Role.objects.get(id=role_id)
        user_role, created = UserRole.objects.get_or_create(
            user=user, role=role
        )
        return user_role

    @staticmethod
    @transaction.atomic
    def remove_role(user_id, role_id):
        """Remove a role from a user."""
        UserRole.objects.filter(user_id=user_id, role_id=role_id).delete()

    @staticmethod
    def get_user_permissions(user):
        """Return all permission codes for a user.

        Aggregates permissions from all roles assigned to the user.
        """
        role_ids = UserRole.objects.filter(user=user).values_list(
            "role_id", flat=True
        )
        return Permission.objects.filter(roles__id__in=role_ids).values_list(
            "code", flat=True
        ).distinct()

    @staticmethod
    def user_has_permission(user, permission_code):
        """Check if a user has a specific permission.

        Args:
            user: User instance.
            permission_code: Permission code string (e.g. "monitoring.create").

        Returns:
            bool: True if the user has the permission.
        """
        return permission_code in UserService.get_user_permissions(user)


class RoleService:
    """Service for role management within an organization."""

    @staticmethod
    def list_roles(organization_id):
        """Return all roles for an organization."""
        return Role.objects.filter(organization_id=organization_id).order_by(
            "-created_at"
        )

    @staticmethod
    def get_role(role_id, organization_id):
        """Return a single role by ID within an organization."""
        return Role.objects.get(id=role_id, organization_id=organization_id)

    @staticmethod
    @transaction.atomic
    def create_role(name, organization_id, permission_codes=None):
        """Create a new role within an organization.

        Args:
            name: Role name (e.g. "Administrator").
            organization_id: UUID of the organization.
            permission_codes: List of permission codes to assign.

        Returns:
            The created Role instance.
        """
        role = Role.objects.create(
            name=name,
            organization_id=organization_id,
        )
        if permission_codes:
            permissions = Permission.objects.filter(
                code__in=permission_codes
            )
            role.permissions.set(permissions)
        return role

    @staticmethod
    @transaction.atomic
    def update_role(role_id, organization_id, **fields):
        """Update an existing role."""
        role = Role.objects.get(id=role_id, organization_id=organization_id)
        if "name" in fields and fields["name"] is not None:
            role.name = fields["name"]
        if "permission_codes" in fields and fields["permission_codes"] is not None:
            permissions = Permission.objects.filter(
                code__in=fields["permission_codes"]
            )
            role.permissions.set(permissions)
        role.save()
        return role

    @staticmethod
    @transaction.atomic
    def delete_role(role_id, organization_id):
        """Delete a role from an organization."""
        role = Role.objects.get(id=role_id, organization_id=organization_id)
        role.delete()


class PermissionService:
    """Service for permission management."""

    @staticmethod
    def list_permissions():
        """Return all available permissions."""
        return Permission.objects.all().order_by("module", "code")

    @staticmethod
    @transaction.atomic
    def create_permission(code, name, module):
        """Create a new permission.

        Args:
            code: Permission code (e.g. "monitoring.create").
            name: Human-readable name.
            module: Module name (e.g. "monitoring").

        Returns:
            The created Permission instance.
        """
        return Permission.objects.create(
            code=code,
            name=name,
            module=module,
        )