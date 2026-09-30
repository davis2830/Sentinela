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

        org_requires_2fa = bool(user.organization and getattr(user.organization, "require_2fa", False))
        admin_requires_2fa = bool(user.is_staff or user.is_superuser)
        must_setup_2fa = (org_requires_2fa or admin_requires_2fa) and not user.is_2fa_enabled

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
                "is_superuser": user.is_superuser,
                "is_2fa_enabled": user.is_2fa_enabled,
                "requires_2fa_setup": must_setup_2fa,
            },
        }

    @staticmethod
    def verify_2fa_login(pre_auth_token, code):
        """Verify 2FA TOTP code or backup code and issue JWT tokens."""
        from django.core import signing
        import pyotp
        from common.crypto import decrypt_string

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

        # 1. Try TOTP code (transparent Fernet decryption)
        if user.totp_secret:
            raw_secret = decrypt_string(user.totp_secret)
            totp = pyotp.TOTP(raw_secret)
            if totp.verify(clean_code, valid_window=1):
                is_valid = True

        # 2. Try single-use backup code
        if not is_valid and user.backup_codes:
            upper_code = clean_code.upper()
            found_code = None
            for stored_code in (user.backup_codes or []):
                if decrypt_string(stored_code) == upper_code:
                    is_valid = True
                    found_code = stored_code
                    break
            if found_code:
                user.backup_codes.remove(found_code)
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
                "is_superuser": user.is_superuser,
                "is_2fa_enabled": user.is_2fa_enabled,
                "requires_2fa_setup": False,
            },
        }

    @staticmethod
    def setup_2fa(user, reset=False):
        """Generate or retrieve a TOTP secret and QR code Data URL for user.

        Stores secret encrypted with Fernet AES-128-CBC at rest.
        Reuses provisional secret if user is currently configuring 2FA to prevent
        invalidating already scanned QR codes on component re-render or modal reopen.
        """
        import base64
        import io
        import os
        import pyotp
        import qrcode
        from PIL import Image
        from common.crypto import encrypt_string, decrypt_string

        # Reuse provisional secret if user is currently configuring 2FA, unless reset requested
        if user.totp_secret and not user.is_2fa_enabled and not reset:
            secret = decrypt_string(user.totp_secret)
        else:
            secret = pyotp.random_base32()
            user.totp_secret = encrypt_string(secret)
            user.save(update_fields=["totp_secret"])

        totp = pyotp.TOTP(secret)
        provisioning_uri = totp.provisioning_uri(
            name=user.email,
            issuer_name="Sentinel",
        )

        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=2,
        )
        qr.add_data(provisioning_uri)
        qr.make(fit=True)
        img = qr.make_image(fill_color="#090D11", back_color="#FFFFFF").convert("RGBA")

        # Embed Sentinel shield icon cleanly within a high-tech circular emblem
        logo_path = "/app/logo.png"
        if os.path.exists(logo_path):
            try:
                from PIL import ImageDraw
                logo = Image.open(logo_path).convert("RGBA")
                qr_w, qr_h = img.size
                badge_radius = int(qr_w * 0.125)
                cx, cy = qr_w // 2, qr_h // 2

                badge = Image.new("RGBA", (badge_radius * 2 + 8, badge_radius * 2 + 8), (0, 0, 0, 0))
                draw = ImageDraw.Draw(badge)
                bcx, bcy = badge.width // 2, badge.height // 2

                # Outer subtle emerald glow
                draw.ellipse(
                    [bcx - badge_radius - 2, bcy - badge_radius - 2, bcx + badge_radius + 2, bcy + badge_radius + 2],
                    fill=(16, 185, 129, 60),
                )
                # Inner dark surface (#111720 Sentinel NOC card) with emerald ring (#10B981)
                draw.ellipse(
                    [bcx - badge_radius, bcy - badge_radius, bcx + badge_radius, bcy + badge_radius],
                    fill=(17, 23, 32, 255),
                    outline=(16, 185, 129, 255),
                    width=2,
                )

                # Fit logo inside badge with breathing room
                logo_target = int(badge_radius * 1.30)
                logo.thumbnail((logo_target, logo_target), Image.Resampling.LANCZOS)
                lx = bcx - logo.width // 2
                ly = bcy - logo.height // 2
                badge.paste(logo, (lx, ly), mask=logo)

                img.paste(badge, (cx - bcx, cy - bcy), mask=badge)
            except Exception:
                pass

        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        qr_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
        qr_data_url = f"data:image/png;base64,{qr_base64}"

        return {
            "secret": secret,
            "qr_code": qr_data_url,
            "provisioning_uri": provisioning_uri,
        }

    @staticmethod
    def verify_and_enable_2fa(user, code):
        """Verify code against provisional secret, enable 2FA and generate 10 encrypted backup codes."""
        import secrets
        import pyotp
        from common.crypto import decrypt_string, encrypt_string

        if not user.totp_secret:
            raise ValueError("No se ha iniciado el proceso de configuración 2FA.")

        clean_code = str(code).strip().replace(" ", "").replace("-", "")
        raw_secret = decrypt_string(user.totp_secret)
        totp = pyotp.TOTP(raw_secret)
        # valid_window=3 accommodates device clock drift (+/- 90s)
        if not totp.verify(clean_code, valid_window=3):
            raise ValueError("Código de verificación incorrecto. Asegúrate de escanear el código QR actual y que la hora de tu dispositivo esté sincronizada.")

        # 10 single-use 8-character backup codes stored encrypted in PostgreSQL
        plain_backup_codes = [secrets.token_hex(4).upper() for _ in range(10)]
        encrypted_backup_codes = [encrypt_string(c) for c in plain_backup_codes]
        user.is_2fa_enabled = True
        user.backup_codes = encrypted_backup_codes
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
            "backup_codes": plain_backup_codes,
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
            data = {
                "access_token": str(token.access_token),
            }
            # Rotate and blacklist old refresh token to prevent token reuse attacks
            try:
                from rest_framework_simplejwt.settings import api_settings
                if api_settings.ROTATE_REFRESH_TOKENS:
                    if api_settings.BLACKLIST_AFTER_ROTATION:
                        try:
                            token.blacklist()
                        except AttributeError:
                            pass
                    token.set_jti()
                    token.set_exp()
                    token.set_iat()
            except Exception:
                pass

            data["refresh_token"] = str(token)
            return data
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
            is_staff=True,
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
                "is_superuser": user.is_superuser,
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