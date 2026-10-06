import uuid

from django.db import models


class BaseModel(models.Model):
    """Base model with UUID primary key and audit timestamps.

    All entities in Sentinel must inherit from this model to ensure
    consistency across the platform.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ["-created_at"]


class OrganizationOwnedModel(BaseModel):
    """Base model for entities that belong to an Organization.

    Enforces multi-tenancy by requiring every entity to have
    an organization reference.
    """

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="%(class)ss",
    )

    class Meta:
        abstract = True
        ordering = ["-created_at"]


class ScanLease(OrganizationOwnedModel):
    """Durable per-resource reservation shared by API, Beat and workers."""
    resource_key = models.CharField(max_length=255, unique=True)
    token = models.UUIDField(null=True)
    started = models.BooleanField(default=False)
    pending_until = models.DateTimeField(null=True)
    next_allowed_at = models.DateTimeField(null=True)
