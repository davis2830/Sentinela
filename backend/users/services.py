from django.db import transaction
from django.db.models import Prefetch

from accounts.models import User

from .models import Permission, Role, UserRole, Team


class UserService:
    """Service for user management within an organization.

    Handles CRUD operations for users, role assignment, and
    permission checking. All business logic lives here.
    """

    @staticmethod
    def list_users(organization_id):
        """Return all users belonging to an organization."""
        return User.objects.filter(organization_id=organization_id).prefetch_related(Prefetch("teams", queryset=Team.objects.filter(organization_id=organization_id)), Prefetch("user_roles", queryset=UserRole.objects.filter(role__organization_id=organization_id).select_related("role"))).order_by("-created_at", "id")

    @staticmethod
    def get_user(user_id, organization_id):
        """Return a single user by ID within an organization.

        Raises:
            User.DoesNotExist if not found.
        """
        return UserService.list_users(organization_id).get(id=user_id)

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
        from accounts.beta import check_email, normalize_email, new_challenge, control_lock
        from organizations.models import Organization
        from common.subscriptions import require_monitoring
        control_lock()
        org = Organization.objects.select_for_update().get(pk=organization_id)
        require_monitoring(org)
        from common.membership import check_member_capacity
        check_member_capacity(org)
        email = normalize_email(email)
        check_email(email)
        if User.objects.filter(email__iexact=email).exists():
            raise ValueError("Ya existe una cuenta con ese correo.")
        from django.contrib.auth.password_validation import validate_password
        validate_password(password, User(email=email, first_name=first_name, last_name=last_name))
        is_staff = (role == "admin")
        user = User.objects.create_user(
            email=email,
            password=password,
            organization_id=organization_id,
            first_name=first_name,
            last_name=last_name,
            is_staff=is_staff,
            is_active=is_active,
            verification_required=True,
        )
        new_challenge(user, email, "member")
        return user

    @staticmethod
    @transaction.atomic
    def update_user(user_id, organization_id, **fields):
        """Update an existing user."""
        from organizations.models import Organization
        Organization.objects.select_for_update().get(pk=organization_id)
        user = User.objects.get(id=user_id, organization_id=organization_id)
        from common.membership import guard_platform_accounts
        guard_platform_accounts(organization_id, [user_id])
        if fields.get('is_active') is False or ('role' in fields and fields['role'] != 'admin' and not user.is_superuser):
            from common.membership import guard_admin_removal
            guard_admin_removal(organization_id, [user_id])
        if "email" in fields and fields["email"] != user.email:
            raise ValueError("El integrante debe confirmar el cambio desde su perfil.")
        
        if "role" in fields and fields["role"] is not None:
            user.is_staff = (fields.pop("role") == "admin")
            user.authorization_mode = "legacy"
            user.session_version += 1
            
        for field, value in fields.items():
            if value is not None:
                setattr(user, field, value)
        user.save()
        return user

    @staticmethod
    @transaction.atomic
    def delete_user(user_id, organization_id):
        """Delete a user from an organization."""
        from organizations.models import Organization
        Organization.objects.select_for_update().get(pk=organization_id)
        user = User.objects.get(id=user_id, organization_id=organization_id)
        from common.membership import guard_admin_removal
        guard_admin_removal(organization_id, [user_id])
        user.delete()

    @staticmethod
    def get_user_permissions(user):
        """Return all permission codes for a user.

        Aggregates permissions from all roles assigned to the user.
        """
        from common.authorization import effective_permissions
        return effective_permissions(user)

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
        return Role.objects.filter(organization_id=organization_id).prefetch_related("permissions").order_by(
            "-created_at"
        )

    @staticmethod
    def get_role(role_id, organization_id):
        """Return a single role by ID within an organization."""
        return Role.objects.get(id=role_id, organization_id=organization_id)

    @staticmethod
    @transaction.atomic
    def create_role(name, organization_id, permission_codes=None, *, actor=None, reason=""):
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
            from .authorization import validate_codes
            permissions = validate_codes(permission_codes)
            role.permissions.set(permissions)
        if actor is not None:
            from audit.services import AuditService
            AuditService.log(action="create", module="users", organization_id=organization_id, user_id=actor.pk,
                             user_email=actor.email, description=f"Creación del rol {role.name}",
                             metadata={"role_id": str(role.pk), "permission_codes": permission_codes or [], "reason": reason})
        return role


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
