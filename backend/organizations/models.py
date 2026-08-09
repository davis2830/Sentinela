import uuid

from django.db import models


class Organization(models.Model):
    """Represents a Sentinel customer (tenant).

    All entities in the platform belong to an Organization.
    This is the root of multi-tenancy.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    status = models.CharField(
        max_length=20,
        default="active",
        choices=[
            ("active", "Active"),
            ("suspended", "Suspended"),
            ("cancelled", "Cancelled"),
        ],
    )
    timezone = models.CharField(max_length=50, default="UTC")
    locale = models.CharField(max_length=10, default="en-US")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        db_table = "organizations_organization"

    def __str__(self):
        return self.name


import secrets
from datetime import timedelta
from django.utils import timezone


class InvitationToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="invitations"
    )
    email = models.EmailField()
    token = models.CharField(max_length=128, unique=True)
    role = models.CharField(max_length=20, default="member")
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        ordering = ["-created_at"]
        db_table = "organizations_invitation_token"

    def is_valid(self):
        return not self.is_used and timezone.now() <= self.expires_at

    @classmethod
    def create_invitation(cls, organization, email, role="member", first_name="", last_name=""):
        token_str = f"inv_{secrets.token_urlsafe(32)}"
        expires_at = timezone.now() + timedelta(hours=48)
        return cls.objects.create(
            organization=organization,
            email=email,
            token=token_str,
            role=role,
            first_name=first_name,
            last_name=last_name,
            expires_at=expires_at,
        )