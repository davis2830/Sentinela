"""Durable encrypted identity outbox. Tokens never appear in Celery arguments."""
from datetime import timedelta
from html import escape
import re

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.utils import timezone

from common.crypto import decrypt_string
from .models import IdentityMail


@shared_task(name="accounts.deliver_identity_mail", ignore_result=True)
def deliver_identity_mail(mail_id):
    with transaction.atomic():
        mail = IdentityMail.objects.select_for_update().filter(pk=mail_id).first()
        if not mail or mail.status in ("sent", "expired"):
            return
        now = timezone.now()
        if mail.expires_at <= now or (mail.challenge and mail.challenge.revoked_at):
            mail.status, mail.encrypted_body = "expired", ""
            mail.save(update_fields=["status", "encrypted_body"])
            return
        if mail.attempts >= 3 or (mail.last_attempt_at and mail.last_attempt_at > now - timedelta(minutes=1)):
            return
        mail.attempts += 1
        mail.last_attempt_at = now
        try:
            if not settings.DEBUG and settings.EMAIL_BACKEND != "django.core.mail.backends.smtp.EmailBackend":
                raise ValueError("Production requires real SMTP")
            if settings.EMAIL_BACKEND.endswith("smtp.EmailBackend") and not settings.EMAIL_HOST:
                raise ValueError("SMTP not configured")
            body = decrypt_string(mail.encrypted_body)
            if body.startswith("enc:"):
                raise ValueError("Unable to decrypt outbox")
            message = EmailMultiAlternatives(mail.subject, body, settings.DEFAULT_FROM_EMAIL, [mail.recipient])
            html_body = escape(body).replace("\n", "<br>")
            html_body = re.sub(r"https?://[^<\s]+", lambda match: '<a href="' + match.group(0)
                               + '">Abrir enlace de Sentinel</a>', html_body)
            message.attach_alternative("<html lang='es'><body><h1>Sentinel</h1><p>"
                + html_body + "</p></body></html>", "text/html")
            if message.send(fail_silently=False) != 1:
                raise ValueError("SMTP did not accept message")
            mail.status, mail.encrypted_body = "sent", ""
        except Exception:
            # Do not log exception text: providers may include recipient or message body.
            mail.status = "failed"
            if mail.attempts >= 3:
                mail.encrypted_body = ""
        mail.save(update_fields=["status", "attempts", "last_attempt_at", "encrypted_body"])


@shared_task(name="accounts.dispatch_identity_mail", ignore_result=True)
def dispatch_identity_mail():
    from .models import AbuseBucket
    now = timezone.now()
    IdentityMail.objects.filter(expires_at__lte=now).exclude(encrypted_body="").update(
        encrypted_body="", status="expired")
    AbuseBucket.objects.filter(expires_at__lte=now).delete()
    for mail_id in IdentityMail.objects.filter(status__in=["queued", "failed"], attempts__lt=3,
                                               expires_at__gt=now).values_list("id", flat=True)[:50]:
        deliver_identity_mail.delay(str(mail_id))
