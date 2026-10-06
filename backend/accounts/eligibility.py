"""Identity gate shared by password, 2FA, refresh, JWT and API-token authentication."""
from django.conf import settings


def require_identity(user):
    if not user or not user.is_active:
        raise ValueError("Tu cuenta no está activa. Contacta al administrador.")
    if not user.email_verified_at and (
        user.verification_required or getattr(settings, "ENFORCE_LEGACY_EMAIL_VERIFICATION", False)
    ):
        raise ValueError("Confirma tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.")
    org = user.organization
    if not org:
        raise ValueError("Tu cuenta aún no tiene una organización activada.")
    if org.status != "active" or (org.beta_managed and org.beta_status != "active"):
        raise ValueError("El acceso a tu organización está suspendido. Contacta al administrador.")
