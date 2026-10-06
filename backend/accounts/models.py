import hashlib
import secrets
import uuid

from .beta_models import AbuseBucket, BetaControl, BetaInvitation, EmailChallenge, IdentityMail, DisposableDomainPolicy

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class UserManager(BaseUserManager):
    """Manager for the custom User model.

    Provides methods to create regular users and superusers
    using email as the unique identifier instead of username.
    """

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Custom user model for Sentinel.

    Uses email as the unique identifier. Each user belongs to an
    organization (multi-tenancy).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    # Existing accounts remain an explicitly grandfathered cohort, never falsely verified.
    verification_required = models.BooleanField(default=False)
    session_version = models.PositiveIntegerField(default=0)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="users",
        null=True,
        blank=True,
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    phone_number = models.CharField(max_length=50, blank=True, default="")
    timezone = models.CharField(max_length=50, blank=True, default="")
    notification_preferences = models.JSONField(default=dict, blank=True)
    is_2fa_enabled = models.BooleanField(default=False)
    totp_secret = models.CharField(max_length=255, blank=True, default="")
    backup_codes = models.JSONField(default=list, blank=True)
    last_login = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        ordering = ["-created_at"]
        db_table = "accounts_user"

    def __str__(self):
        return self.email

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.email

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.email

    def get_short_name(self):
        return self.first_name or self.email


class APIToken(models.Model):
    """API token for programmatic access to Sentinel endpoints."""

    SCOPE_CHOICES = [
        ("read", "Read Only"),
        ("full", "Full Access"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="api_tokens")
    name = models.CharField(max_length=255)
    token_hash = models.CharField(max_length=64, unique=True)
    token_prefix = models.CharField(max_length=16, db_index=True)
    scope = models.CharField(max_length=20, default="full", choices=SCOPE_CHOICES)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        db_table = "accounts_api_token"

    def __str__(self):
        return f"{self.name} ({self.user.email})"

    @classmethod
    def issue(cls, *, user, name, scope="full", expires_at=None):
        """Create a token while returning the secret exactly once."""
        raw_token = f"snt_{secrets.token_hex(32)}"
        token = cls.objects.create(
            user=user,
            name=name,
            scope=scope,
            expires_at=expires_at,
            token_hash=hashlib.sha256(raw_token.encode("utf-8")).hexdigest(),
            token_prefix=raw_token[:12],
        )
        return token, raw_token

    @property
    def is_expired(self):
        if self.expires_at:
            from django.utils import timezone
            return timezone.now() > self.expires_at
        return False
