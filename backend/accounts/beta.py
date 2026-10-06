"""Transactional admission, verification and bounded identity delivery."""
import hashlib
import hmac
import json
import math
import secrets
from datetime import timedelta
from urllib.parse import urlsplit

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core import signing
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify
from rest_framework.exceptions import Throttled

from common.crypto import encrypt_string
from .models import AbuseBucket, BetaControl, BetaInvitation, EmailChallenge, IdentityMail, User


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def normalize_email(value):
    local, separator, domain = str(value).strip().rpartition("@")
    if not separator:
        raise ValueError("Ingresa un correo válido.")
    try:
        domain = domain.rstrip(".").encode("idna").decode().lower()
        email = f"{local}@{domain}"
        validate_email(email)
    except (UnicodeError, ValidationError):
        raise ValueError("Ingresa un correo válido.") from None
    # Preserve local part, dots and '+' aliases; never merge distinct mailboxes.
    return email


def check_email(email):
    from pathlib import Path
    policy = json.loads(Path(__file__).with_name("disposable_domains.json").read_text(encoding="utf-8"))
    from .models import DisposableDomainPolicy
    current = DisposableDomainPolicy.objects.filter(pk=1).first()
    if current:
        policy = {"domains": current.domains}
    domain = email.rsplit("@", 1)[1]
    allowed = set(getattr(settings, "BETA_EMAIL_DOMAIN_ALLOWLIST", []))
    if domain not in allowed and any(domain == blocked or domain.endswith("." + blocked)
                                      for blocked in policy["domains"]):
        raise ValueError("Usa un correo permanente para confirmar y proteger tu cuenta.")


def consume_budget(kind, identity, limit, seconds):
    now = timezone.now()
    key = hmac.new(settings.SECRET_KEY.encode(), f"{kind}:{identity}".encode(), hashlib.sha256).hexdigest()
    with transaction.atomic():
        AbuseBucket.objects.get_or_create(key=key, defaults={"expires_at": now + timedelta(seconds=seconds)})
        bucket = AbuseBucket.objects.select_for_update().get(pk=key)
        if bucket.expires_at <= now:
            bucket.count = 0
            bucket.expires_at = now + timedelta(seconds=seconds)
        if bucket.count >= limit:
            raise Throttled(wait=max(1, int((bucket.expires_at - now).total_seconds())))
        bucket.count += 1
        bucket.save()


def validate_captcha(token, action, ip):
    if settings.DEBUG and not settings.TURNSTILE_SECRET_KEY:
        return  # Explicit local-development mode, never production.
    secret = settings.TURNSTILE_SECRET_KEY
    if not token or not secret or (not settings.DEBUG and secret.startswith(("1x", "2x", "3x"))):
        raise ValueError("No pudimos validar la protección del formulario. Intenta nuevamente.")
    from common.safe_http import post
    try:
        response = post("https://challenges.cloudflare.com/turnstile/v0/siteverify",
                        data={"secret": secret, "response": token, "remoteip": ip}, timeout=(3, 5))
        response.raise_for_status()
        result = response.json()
        valid = (result.get("success") is True and result.get("action") == action
                 and result.get("hostname") in settings.TURNSTILE_HOSTNAMES)
    except Exception:
        valid = False
    if not valid:
        raise ValueError("La verificación de seguridad venció o falló. Intenta nuevamente.")
    consume_budget("captcha", digest(token), 1, 300)


def public_link(path, token):
    base = settings.PUBLIC_APP_URL.rstrip("/")
    parts = urlsplit(base)
    if (not parts.hostname or parts.username or parts.password or parts.query or parts.fragment
            or (parts.scheme != "https" and not settings.DEBUG)):
        raise ValueError("El envío de correo aún no está configurado. Contacta al administrador.")
    # Fragment keeps secrets out of HTTP access logs and Referer headers.
    return f"{base}/{path}#token={token}"


def queue_mail(email, subject, body, expires_at, **relations):
    mail = IdentityMail.objects.create(recipient=email, subject=subject,
        encrypted_body=encrypt_string(body), expires_at=expires_at, **relations)
    # Periodic outbox recovery handles broker failures without pretending delivery.
    def dispatch():
        from .tasks import deliver_identity_mail
        try:
            deliver_identity_mail.delay(str(mail.id))
        except Exception:
            pass  # Durable queued row remains visible, retried by dispatch_identity_mail.
    transaction.on_commit(dispatch)
    return mail


def audit(operator, description, invitation=None, organization=None):
    from audit.services import AuditService
    AuditService.log(action="config_change", module="beta", user_id=operator.id if operator else None,
        user_email=operator.email if operator else "", organization_id=organization.id if organization else None,
        description=description, metadata={"invitation_id": str(invitation.id)} if invitation else {})


def control_lock():
    return BetaControl.objects.select_for_update().get(pk=1)


def delivery_configuration_errors():
    errors = []
    parts = urlsplit(settings.PUBLIC_APP_URL)
    if parts.scheme != "https" or not parts.hostname or parts.query or parts.fragment or parts.username:
        errors.append("PUBLIC_APP_URL debe ser un origen HTTPS confiable.")
    if not settings.TURNSTILE_SITE_KEY or not settings.TURNSTILE_SECRET_KEY or settings.TURNSTILE_SECRET_KEY.startswith(("1x", "2x", "3x")):
        errors.append("Configura claves reales de Turnstile.")
    if parts.hostname not in settings.TURNSTILE_HOSTNAMES:
        errors.append("El dominio público debe estar en TURNSTILE_HOSTNAMES.")
    if not settings.EMAIL_HOST or not settings.EMAIL_USE_TLS:
        errors.append("Configura el servidor SMTP con TLS.")
    if settings.EMAIL_BACKEND != "django.core.mail.backends.smtp.EmailBackend":
        errors.append("El backend de correo debe ser SMTP real.")
    if "example." in settings.DEFAULT_FROM_EMAIL or "sentinel.local" in settings.DEFAULT_FROM_EMAIL:
        errors.append("Configura un remitente real y valida SPF/DKIM/DMARC con el proveedor.")
    return errors


def issue_invitation(operator, email, reason):
    email = normalize_email(email)
    check_email(email)
    with transaction.atomic():
        control = control_lock()
        if not control.admissions_open:
            raise ValueError("Las admisiones de la beta están cerradas.")
        now = timezone.now()
        reservations = BetaInvitation.objects.filter(status__in=["active", "suspended"]).count()
        reservations += BetaInvitation.objects.filter(status__in=["invited", "pending_verification"],
                                                       expires_at__gt=now).count()
        if reservations >= control.capacity:
            raise ValueError("No quedan cupos en la beta. No se envió ninguna invitación.")
        if User.objects.filter(email__iexact=email).exists() or BetaInvitation.objects.filter(
            email__iexact=email, status__in=["invited", "pending_verification", "active", "suspended"],
            expires_at__gt=now).exists():
            raise ValueError("Revisa la cuenta o invitación existente antes de invitar nuevamente.")
        token = secrets.token_urlsafe(32)
        inv = BetaInvitation.objects.create(email=email, token_hash=digest(token),
                    expires_at=now + timedelta(days=7), operator=operator, reason=reason)
        queue_mail(email, "Tu invitación a Sentinel", "Te invitamos a la beta privada de Sentinel. "
                   "Tu plan inicial será Free: 3 monitores, cada 5 minutos.\n\n"
                   + public_link("register", token) + "\n\nEsta invitación vence en 7 días.",
                   inv.expires_at, invitation=inv)
        audit(operator, f"Invitación beta creada. Motivo: {reason}", inv)
        return inv


def reserved_slots():
    from django.db.models import Q
    return BetaInvitation.objects.filter(Q(status__in=["active", "suspended"]) |
        Q(status__in=["invited", "pending_verification"], expires_at__gt=timezone.now())).count()


def new_challenge(user, email, purpose="registration"):
    consume_budget("email-day", email, settings.EMAIL_RESEND_DAILY_LIMIT, 86400)
    now = timezone.now()
    token = secrets.token_urlsafe(32)
    challenge = EmailChallenge.objects.create(user=user, email=email, purpose=purpose,
        token_hash=digest(token), expires_at=now + timedelta(minutes=30))
    mail = queue_mail(email, "Confirma tu correo en Sentinel",
        "Confirma tu correo con el siguiente enlace. La cuenta no se activará hasta que confirmes.\n\n"
        + public_link("verify-email", token) + "\n\nEl enlace vence en 30 minutos. "
        "Si no solicitaste esto, ignora este mensaje.", challenge.expires_at, challenge=challenge)
    EmailChallenge.objects.filter(user=user, purpose=purpose, used_at=None, revoked_at=None).exclude(
        pk=challenge.pk).update(revoked_at=now)
    return mail


def session_for(user):
    return signing.dumps({"user": str(user.id) if user else None, "nonce": secrets.token_hex(16)},
                         salt="beta-registration", compress=False)


def session_user(token):
    try:
        payload = signing.loads(token, salt="beta-registration", max_age=7 * 86400)
        return User.objects.filter(pk=payload.get("user"), verification_required=True).first()
    except (signing.BadSignature, ValueError, TypeError):
        return None


def register(email, password, invitation_token="", first_name="", last_name="", organization_name=""):
    email = normalize_email(email)
    check_email(email)
    try:
        validate_password(password, User(email=email, first_name=first_name, last_name=last_name))
    except ValidationError as exc:
        raise ValueError(" ".join(exc.messages)) from None
    consume_budget("register-email", email, 5, 86400)
    with transaction.atomic():
        control = control_lock()
        if not control.admissions_open:
            raise ValueError("La beta está cerrada a nuevos registros. Solicita una invitación al administrador.")
        inv = BetaInvitation.objects.select_for_update().filter(token_hash=digest(invitation_token),
                                    status="invited", expires_at__gt=timezone.now()).first()
        # Same public response for existing account, unbound/invalid/expired invitation.
        user = None
        if inv and inv.email == email and not User.objects.filter(email__iexact=email).exists():
            user = User.objects.create_user(email=email, password=password, first_name=first_name,
                                           last_name=last_name, verification_required=True)
            inv.user = user
            inv.organization_name = organization_name.strip()
            inv.status = "pending_verification"
            inv.save()
            new_challenge(user, email)
            audit(None, "Registro beta pendiente de confirmar correo.", inv)
        return {"status": "pending_verification", "registration_session": session_for(user),
                "message": "Si tu invitación es válida, recibirás un correo para confirmar tu cuenta.",
                "retry_after_seconds": 60}


def verification_status(token):
    user = session_user(token)
    status, delivery = "pending_verification", "unknown"
    retry_after, challenge_expires_at = 0, None
    if user:
        if user.email_verified_at:
            status = "active"
        inv = BetaInvitation.objects.filter(user=user).first()
        if inv:
            status = inv.status
            if status in ("invited", "pending_verification") and inv.expires_at <= timezone.now():
                status = "expired"
        mail = IdentityMail.objects.filter(challenge__user=user).order_by("-created_at").first()
        if mail:
            delivery = mail.status
            challenge_expires_at = mail.challenge.expires_at.isoformat()
            retry_after = max(0, math.ceil(settings.EMAIL_RESEND_COOLDOWN_SECONDS
                - (timezone.now() - mail.challenge.created_at).total_seconds()))
            if mail.challenge.expires_at <= timezone.now() or mail.challenge.revoked_at:
                delivery = "expired"
    return {"status": status, "delivery_status": delivery,
            "retry_after_seconds": retry_after, "challenge_expires_at": challenge_expires_at}


def invitation_preview(token):
    inv = BetaInvitation.objects.filter(token_hash=digest(token)).first()
    if not inv:
        return {"status": "unavailable", "masked_email": ""}
    status = inv.status
    if status in ("invited", "pending_verification") and inv.expires_at <= timezone.now():
        status = "expired"
    local, domain = inv.email.rsplit("@", 1)
    return {"status": status, "masked_email": f"{local[:2]}***@{domain}"}


def resend(token):
    user = session_user(token)
    if user:
        latest = EmailChallenge.objects.filter(user=user, purpose="registration").order_by("-created_at").first()
        if latest:
            remaining = settings.EMAIL_RESEND_COOLDOWN_SECONDS - (timezone.now() - latest.created_at).total_seconds()
            if remaining > 0:
                raise Throttled(wait=max(1, int(remaining)))
        consume_budget("resend-cooldown", str(user.pk), 1, settings.EMAIL_RESEND_COOLDOWN_SECONDS)
        with transaction.atomic():
            control_lock()
            user = User.objects.select_for_update().get(pk=user.pk)
            inv = BetaInvitation.objects.filter(user=user, status="pending_verification",
                                                expires_at__gt=timezone.now()).first()
            if inv and not user.email_verified_at:
                new_challenge(user, user.email)
            elif not inv and user.organization_id and not user.email_verified_at:
                from common.subscriptions import require_monitoring
                require_monitoring(user.organization)
                new_challenge(user, user.email, "member")
    return {"message": "Si la cuenta puede verificarse, enviaremos un nuevo enlace.", "retry_after_seconds": 60}


def verify(token):
    now = timezone.now()
    with transaction.atomic():
        control = control_lock()
        challenge = EmailChallenge.objects.select_for_update().filter(token_hash=digest(token),
                         expires_at__gt=now, used_at=None, revoked_at=None).first()
        if not challenge or not IdentityMail.objects.filter(challenge=challenge, status="sent").exists():
            raise ValueError("El enlace venció, ya fue utilizado o no es válido. Solicita uno nuevo.")
        user = User.objects.select_for_update().get(pk=challenge.user_id)
        if not user.is_active:
            raise ValueError("La cuenta está desactivada. Contacta al administrador.")
        if challenge.purpose == "email_change":
            if User.objects.filter(email__iexact=challenge.email).exclude(pk=user.pk).exists():
                raise ValueError("No se pudo confirmar el cambio de correo. Contacta al administrador.")
            from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
            for outstanding in OutstandingToken.objects.filter(user=user, expires_at__gt=now):
                BlacklistedToken.objects.get_or_create(token=outstanding)
            user.api_tokens.all().delete()
            user.session_version += 1
            user.email = challenge.email
        elif challenge.purpose == "member":
            from common.subscriptions import require_monitoring
            require_monitoring(user.organization)
            if challenge.email != user.email:
                raise ValueError("El correo de la cuenta cambió. Solicita otro enlace.")
            audit(user, "Correo de integrante confirmado.", organization=user.organization)
        else:
            inv = BetaInvitation.objects.select_for_update().filter(user=user,
                status="pending_verification", expires_at__gt=now).first()
            if not inv:
                raise ValueError("Tu invitación ya no está vigente. Contacta al administrador.")
            if not control.admissions_open:
                raise ValueError("Las activaciones de la beta están temporalmente cerradas.")
            if BetaInvitation.objects.filter(status__in=["active", "suspended"]).count() >= control.capacity:
                raise ValueError("Los cupos de la beta están completos. Contacta al administrador.")
            if user.organization_id:
                raise ValueError("La cuenta ya pertenece a una organización.")
            from organizations.models import Organization
            name = inv.organization_name or f"Organización de {user.first_name or 'Sentinel'}"
            org = Organization.objects.create(name=name, slug=f"{slugify(name)[:200] or 'org'}-{secrets.token_hex(6)}",
                beta_managed=True, beta_status="active", billing_email=user.email,
                default_scan_interval_seconds=300, metrics_retention_days=3)
            user.organization = org
            user.is_staff = True
            inv.status = "active"
            inv.save(update_fields=["status"])
            from alerts.services import AlertRuleService
            AlertRuleService.ensure_default_rules(org.id)
            audit(user, "Correo confirmado; organización beta Free activada.", inv, org)
        user.email_verified_at = now
        user.save()
        challenge.used_at = now
        challenge.save(update_fields=["used_at"])
        return {"status": "verified", "message": "Correo confirmado. Ahora puedes iniciar sesión."}


def change_email(user, email, password):
    if not user.check_password(password):
        raise ValueError("Confirma tu contraseña actual para cambiar el correo.")
    email = normalize_email(email)
    check_email(email)
    consume_budget("email-change", str(user.pk), 5, 86400)
    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=user.pk)
        if email == user.email or User.objects.filter(email__iexact=email).exists():
            raise ValueError("No podemos utilizar ese correo para el cambio.")
        new_challenge(user, email, "email_change")
        queue_mail(user.email, "Solicitud de cambio de correo en Sentinel",
            "Se solicitó cambiar el correo de tu cuenta. El correo actual seguirá vigente hasta confirmar "
            "el nuevo. Si no fuiste tú, cambia tu contraseña y contacta al administrador.",
            timezone.now() + timedelta(hours=24))
        audit(user, "Solicitud de cambio de correo; pendiente de confirmación.", organization=user.organization)
    return {"message": "Confirma el nuevo correo. Después deberás iniciar sesión nuevamente."}
