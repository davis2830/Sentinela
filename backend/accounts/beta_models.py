"""Private beta admission and short-lived identity artifacts; no plaintext secrets."""
import uuid

from django.conf import settings
from django.db import models


class BetaControl(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    admissions_open = models.BooleanField(default=False)
    capacity = models.PositiveSmallIntegerField(default=20)


class BetaInvitation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField()
    token_hash = models.CharField(max_length=64, unique=True)
    status = models.CharField(max_length=24, default="invited")
    user = models.OneToOneField(settings.AUTH_USER_MODEL, null=True, blank=True,
                              on_delete=models.SET_NULL, related_name="beta_invitation")
    organization_name = models.CharField(max_length=255, blank=True)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    operator = models.ForeignKey(settings.AUTH_USER_MODEL, null=True,
                                 on_delete=models.SET_NULL, related_name="issued_beta_invitations")
    reason = models.TextField(blank=True)


class EmailChallenge(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    email = models.EmailField()
    purpose = models.CharField(max_length=24, default="registration")
    token_hash = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True)
    revoked_at = models.DateTimeField(null=True)


class IdentityMail(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.EmailField()
    subject = models.CharField(max_length=200)
    encrypted_body = models.TextField()
    status = models.CharField(max_length=20, default="queued")
    attempts = models.PositiveSmallIntegerField(default=0)
    last_attempt_at = models.DateTimeField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    challenge = models.ForeignKey(EmailChallenge, null=True, on_delete=models.SET_NULL)
    invitation = models.ForeignKey(BetaInvitation, null=True, on_delete=models.SET_NULL)


class AbuseBucket(models.Model):
    # HMAC keys avoid storing recipient/IP identifiers in counters.
    key = models.CharField(primary_key=True, max_length=64)
    count = models.PositiveIntegerField(default=0)
    expires_at = models.DateTimeField(db_index=True)


class DisposableDomainPolicy(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    version = models.CharField(max_length=50)
    domains = models.JSONField(default=list)
    updated_at = models.DateTimeField(auto_now=True)
