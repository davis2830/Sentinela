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

        # Check if 2FA is required for this user
        if user.is_2fa_enabled:
            from django.core import signing
            pre_auth_token = signing.dumps(
                {"user_id": str(user.id), "action": "2fa_login"},
                salt="sentinel_2fa_preauth",
            )
            return {
                "requires_2fa": True,
                "pre_auth_token": pre_auth_token,
                "email": user.email,
            }

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
                "is_2fa_enabled": user.is_2fa_enabled,
            },
        }

    @staticmethod
    def verify_2fa_login(pre_auth_token, code):
        """Verify 2FA TOTP code or backup code and issue JWT tokens."""
        from django.core import signing
        import pyotp

        try:
            payload = signing.loads(
                pre_auth_token,
                salt="sentinel_2fa_preauth",
                max_age=300,  # 5 minutes validity
            )
        except Exception:
            raise ValueError("La sesión de autenticación 2FA ha expirado o es inválida.")

        user_id = payload.get("user_id")
        user = User.objects.filter(id=user_id).first()
        if not user or not user.is_active:
            raise ValueError("Usuario no válido o inactivo.")

        clean_code = str(code).strip().replace(" ", "").replace("-", "")
        is_valid = False

        # 1. Try TOTP code
        if user.totp_secret:
            totp = pyotp.TOTP(user.totp_secret)
            if totp.verify(clean_code, valid_window=1):
                is_valid = True

        # 2. Try single-use backup code
        if not is_valid and user.backup_codes:
            upper_code = clean_code.upper()
            if upper_code in user.backup_codes:
                is_valid = True
                user.backup_codes.remove(upper_code)
                user.save(update_fields=["backup_codes"])

        if not is_valid:
            raise ValueError("Código 2FA o de recuperación incorrecto.")

        from django.utils import timezone
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])

        from audit.services import AuditService
        AuditService.log(
            action="login",
            module="accounts",
            organization_id=user.organization_id,
            user_id=user.id,
            user_email=user.email,
            description=f"El usuario {user.email} completó la autenticación 2FA exitosamente.",
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
                "is_2fa_enabled": user.is_2fa_enabled,
            },
        }

    @staticmethod
    def setup_2fa(user):
        """Generate a new TOTP secret and QR code Data URL for user."""
        import base64
        import io
        import pyotp
        import qrcode

        secret = pyotp.random_base32()
        user.totp_secret = secret
        user.save(update_fields=["totp_secret"])

        totp = pyotp.TOTP(secret)
        provisioning_uri = totp.provisioning_uri(
            name=user.email,
            issuer_name="Sentinel",
        )
        # Append image parameter for authenticators that support custom icons (2FAS, Aegis, 1Password)
        provisioning_uri_with_icon = f"{provisioning_uri}&image=http://localhost:3000/logo.png"

        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=2,
        )
        qr.add_data(provisioning_uri_with_icon)
        qr.make(fit=True)
        img = qr.make_image(fill_color="#090D11", back_color="#FFFFFF").convert("RGBA")

        # Embed Sentinel logo in the center of the QR code if available
        import os
        from PIL import Image
        logo_path = "/app/logo.png"
        if os.path.exists(logo_path):
            try:
                logo = Image.open(logo_path).convert("RGBA")
                qr_w, qr_h = img.size
                logo_max_size = int(qr_w * 0.24)
                logo.thumbnail((logo_max_size, logo_max_size), Image.Resampling.LANCZOS)

                # Clean white contrast box behind the logo
                pad = 6
                box_w = logo.size[0] + pad * 2
                box_h = logo.size[1] + pad * 2
                bg_box = Image.new("RGBA", (box_w, box_h), (255, 255, 255, 255))

                pos_x = (qr_w - box_w) // 2
                pos_y = (qr_h - box_h) // 2
                img.paste(bg_box, (pos_x, pos_y))

                logo_pos_x = (qr_w - logo.size[0]) // 2
                logo_pos_y = (qr_h - logo.size[1]) // 2
                img.paste(logo, (logo_pos_x, logo_pos_y), mask=logo)
            except Exception:
                pass

        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        qr_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
        qr_data_url = f"data:image/png;base64,{qr_base64}"

        return {
            "secret": secret,
            "qr_code": qr_data_url,
            "provisioning_uri": provisioning_uri_with_icon,
        }

    @staticmethod
    def verify_and_enable_2fa(user, code):
        """Verify code against provisional secret, enable 2FA and generate 10 backup codes."""
        import secrets
        import pyotp

        if not user.totp_secret:
            raise ValueError("No se ha iniciado el proceso de configuración 2FA.")

        clean_code = str(code).strip().replace(" ", "").replace("-", "")
        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(clean_code, valid_window=1):
            raise ValueError("Código de verificación incorrecto. Revisa que la hora de tu dispositivo esté sincronizada.")

        # 10 single-use 8-character backup codes
        backup_codes = [secrets.token_hex(4).upper() for _ in range(10)]
        user.is_2fa_enabled = True
        user.backup_codes = backup_codes
        user.save(update_fields=["is_2fa_enabled", "backup_codes"])

        from audit.services import AuditService
        AuditService.log(
            action="update",
            module="accounts",
            organization_id=user.organization_id,
            user_id=user.id,
            user_email=user.email,
            description=f"El usuario {user.email} activó exitosamente la autenticación en dos pasos (2FA).",
        )

        return {
            "is_2fa_enabled": True,
            "backup_codes": backup_codes,
            "detail": "Autenticación en dos pasos activada exitosamente.",
        }

    @staticmethod
    def disable_2fa(user, password):
        """Disable 2FA after verifying the user's password."""
        if not user.check_password(password):
            raise ValueError("Contraseña incorrecta.")

        user.is_2fa_enabled = False
        user.totp_secret = ""
        user.backup_codes = []
        user.save(update_fields=["is_2fa_enabled", "totp_secret", "backup_codes"])

        from audit.services import AuditService
        AuditService.log(
            action="update",
            module="accounts",
            organization_id=user.organization_id,
            user_id=user.id,
            user_email=user.email,
            description=f"El usuario {user.email} desactivó la autenticación en dos pasos (2FA).",
        )

        return {"detail": "Autenticación en dos pasos desactivada exitosamente."}

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
    def register(email, password, first_name="", last_name="", organization_name=""):
        """Register a new user.

        Creates a new user account, an associated Organization with Pro 14-day trial,
        auto-provisions default alert rules, and returns JWT tokens so the user is immediately
        authenticated after registration.
        """
        if User.objects.filter(email=email).exists():
            raise ValueError("Ya existe una cuenta con este correo electrónico.")

        from organizations.models import Organization, OrganizationPlanTier, OrganizationSubscriptionStatus
        from alerts.services import AlertRuleService
        from audit.models import AuditLog
        from django.utils.text import slugify
        from django.utils import timezone
        from datetime import timedelta
        import uuid

        clean_org_name = organization_name.strip() if organization_name else ""
        if not clean_org_name:
            clean_org_name = f"Organización de {first_name or email.split('@')[0]}"

        slug = f"{slugify(clean_org_name) or 'org'}-{str(uuid.uuid4())[:8]}"
        org = Organization.objects.create(
            name=clean_org_name,
            slug=slug,
            billing_email=email,
            plan_tier=OrganizationPlanTier.PRO,
            subscription_status=OrganizationSubscriptionStatus.TRIALING,
            trial_ends_at=timezone.now() + timedelta(days=14),
        )

        user = User.objects.create_user(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            organization=org,
        )

        # Ensure 6 default NOC alert rules are provisioned
        try:
            AlertRuleService.ensure_default_rules(org.id)
        except Exception:
            pass

        # Audit log registration
        try:
            AuditLog.objects.create(
                organization=org,
                user=user,
                action="create",
                resource_type="organization",
                resource_id=str(org.id),
                resource_name=org.name,
                description=f"Nueva cuenta registrada: {user.email} con plan Pro (14d trial).",
            )
        except Exception:
            pass

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
                "organization": {
                    "id": str(org.id),
                    "name": org.name,
                    "slug": org.slug,
                    "plan_tier": org.plan_tier,
                    "subscription_status": org.subscription_status,
                    "trial_days_remaining": org.trial_days_remaining,
                },
            },
        }