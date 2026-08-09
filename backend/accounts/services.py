from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User


class AuthService:
    """Service for authentication and identity management.

    Handles login, logout, token refresh, password change, and registration.
    All business logic lives here, not in views.
    """

    @staticmethod
    def login(email, password):
        """Authenticate a user and return JWT tokens.

        Args:
            email: The user's email address.
            password: The user's plain text password.

        Returns:
            dict with access_token, refresh_token, and user data.

        Raises:
            ValueError if credentials are invalid.
        """
        user = authenticate(email=email, password=password)
        if user is None:
            from .models import User
            existing_user = User.objects.filter(email=email).first()
            if existing_user:
                if existing_user.check_password(password):
                    if not existing_user.is_active:
                        raise ValueError("Tu cuenta ha sido desactivada por un administrador.")
                    if not existing_user.organization:
                        raise ValueError("Tu cuenta ya no pertenece a ninguna organización.")
            raise ValueError("Correo electrónico o contraseña incorrectos.")

        if not user.is_active:
            raise ValueError("Tu cuenta ha sido desactivada por un administrador.")

        # Update last_login timestamp
        from django.utils import timezone
        user.last_login = timezone.now()

        # Ensure user has an organization assigned (multi-tenancy safety)
        if user.organization is None:
            from organizations.models import Organization
            org = Organization.objects.first()
            if not org:
                from django.utils.text import slugify
                import uuid
                org = Organization.objects.create(name="Default Org", slug=f"default-{str(uuid.uuid4())[:8]}")
            user.organization = org
            user.save(update_fields=["organization", "last_login"])
        else:
            user.save(update_fields=["last_login"])

        from audit.services import AuditService
        AuditService.log(
            action="login",
            module="accounts",
            organization_id=user.organization_id,
            user_id=user.id,
            user_email=user.email,
            description=f"El usuario {user.email} inició sesión exitosamente.",
        )

        refresh = RefreshToken.for_user(user)
        return {
            "access_token": str(refresh.access_token),
            "refresh_token": str(refresh),
            "user": {
                "id": str(user.id),
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "is_staff": user.is_staff,
            },
        }

    @staticmethod
    def logout(refresh_token):
        """Blacklist a refresh token to invalidate the session.

        Args:
            refresh_token: The refresh token string to blacklist.

        Raises:
            ValueError if the token is invalid or already blacklisted.
        """
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            raise ValueError("Invalid or expired refresh token.")

    @staticmethod
    def refresh_token(refresh_token):
        """Generate new tokens from a refresh token.

        Args:
            refresh_token: The refresh token string.

        Returns:
            dict with new access_token and refresh_token.

        Raises:
            ValueError if the token is invalid.
        """
        try:
            token = RefreshToken(refresh_token)
            return {
                "access_token": str(token.access_token),
                "refresh_token": str(token),
            }
        except Exception:
            raise ValueError("Invalid or expired refresh token.")

    @staticmethod
    def change_password(user, old_password, new_password):
        """Change the password for an authenticated user.

        Args:
            user: The authenticated User instance.
            old_password: The current password for verification.
            new_password: The new password to set.

        Raises:
            ValueError if the old password is incorrect.
        """
        if not user.check_password(old_password):
            raise ValueError("Current password is incorrect.")
        user.set_password(new_password)
        user.save()

    @staticmethod
    def register(email, password, first_name="", last_name=""):
        """Register a new user.

        Creates a new user account and returns JWT tokens
        so the user is immediately authenticated after registration.

        Args:
            email: The user's email address.
            password: The user's plain text password.
            first_name: Optional first name.
            last_name: Optional last name.

        Returns:
            dict with access_token, refresh_token, and user data.

        Raises:
            ValueError if the email is already registered.
        """
        if User.objects.filter(email=email).exists():
            raise ValueError("A user with this email already exists.")

        from organizations.models import Organization
        from django.utils.text import slugify
        import uuid

        org_name = f"{first_name or email.split('@')[0]}'s Organization"
        slug = f"{slugify(org_name) or 'org'}-{str(uuid.uuid4())[:8]}"
        org = Organization.objects.create(name=org_name, slug=slug)

        user = User.objects.create_user(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            organization=org,
        )

        refresh = RefreshToken.for_user(user)
        return {
            "access_token": str(refresh.access_token),
            "refresh_token": str(refresh),
            "user": {
                "id": str(user.id),
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "is_staff": user.is_staff,
            },
        }