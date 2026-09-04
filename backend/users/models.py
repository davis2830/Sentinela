import uuid

from django.db import models


class Permission(models.Model):
    """Individual system permission.

    Examples:
        monitoring.create
        monitoring.update
        alerts.manage
        users.manage
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=255)
    module = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["module", "code"]
        db_table = "users_permission"

    def __str__(self):
        return f"{self.code} ({self.name})"


class Role(models.Model):
    """Defines permissions within an organization.

    Examples: Administrator, Operator, Auditor, Viewer
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="roles",
    )
    permissions = models.ManyToManyField(
        Permission,
        related_name="roles",
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        db_table = "users_role"
        unique_together = ("name", "organization")

    def __str__(self):
        return self.name


class UserRole(models.Model):
    """Associates a user with a role within their organization."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="user_roles",
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        related_name="user_roles",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        db_table = "users_user_role"
        unique_together = ("user", "role")

    def __str__(self):
        return f"{self.user.email} - {self.role.name}"


class Team(models.Model):
    """Team / Workgroup within an organization.

    Examples: SRE Team, NOC Tier 1, SecOps, DBA Team, Cloud Infrastructure
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="teams",
    )
    lead = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="led_teams",
    )
    contact_email = models.EmailField(blank=True, default="")
    members = models.ManyToManyField(
        "accounts.User",
        related_name="teams",
        blank=True,
    )
    color = models.CharField(max_length=30, default="#10B981")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        db_table = "users_team"
        unique_together = ("name", "organization")

    def __str__(self):
        return self.name