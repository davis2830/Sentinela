import secrets
import uuid
from datetime import timedelta
from django.db import models
from django.utils import timezone
from .plans import PLAN_LIMITS as PLAN_LIMITS, plan_limits

class OrganizationPlanTier(models.TextChoices):
    FREE = "free", "Free / Community"
    PRO = "pro", "Pro / Growth"
    BUSINESS = "business", "Business"
    ENTERPRISE = "enterprise", "Enterprise"


class OrganizationSubscriptionStatus(models.TextChoices):
    TRIALING = "trialing", "Trialing"
    ACTIVE = "active", "Active"
    PAST_DUE = "past_due", "Past Due"
    CANCELED = "canceled", "Canceled"
    SUSPENDED = "suspended", "Suspended"




class Organization(models.Model):
    """Represents a Sentinel customer (tenant).

    All entities in the platform belong to an Organization.
    This is the root of multi-tenancy.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    is_test = models.BooleanField(default=False, db_index=True)
    beta_managed = models.BooleanField(default=False)
    beta_status = models.CharField(max_length=20, default="active")
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
    timezone = models.CharField(max_length=50, default="America/Guatemala")
    locale = models.CharField(max_length=10, default="es-GT")

    # SaaS Subscription & Billing
    plan_tier = models.CharField(
        max_length=20,
        choices=OrganizationPlanTier.choices,
        default=OrganizationPlanTier.FREE,
        help_text="Current subscription tier.",
    )
    subscription_status = models.CharField(
        max_length=20,
        choices=OrganizationSubscriptionStatus.choices,
        default=OrganizationSubscriptionStatus.ACTIVE,
        help_text="Billing subscription status.",
    )
    trial_ends_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Expiration timestamp for free trial.",
    )
    billing_email = models.EmailField(blank=True, default="")
    tax_id = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Tax / Fiscal ID (RUT, RFC, NIF, CIF).",
    )
    contact_phone = models.CharField(max_length=50, blank=True, default="")
    website = models.CharField(max_length=255, blank=True, default="")
    logo_url = models.CharField(max_length=500, blank=True, default="")

    # SLA & Observability Defaults
    sla_target_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=99.90,
        help_text="Global monthly uptime SLA target percentage.",
    )
    alert_flapping_threshold = models.IntegerField(
        default=3,
        help_text="Number of state changes in 15m to trigger flapping alert.",
    )
    default_scan_interval_seconds = models.IntegerField(
        default=300,
        help_text="Default interval for monitoring checks in seconds.",
    )

    # Retention & Compliance (ISO 27001 / SOC 2)
    metrics_retention_days = models.IntegerField(
        default=90,
        help_text="Days to retain historical telemetry in PostgreSQL.",
    )
    audit_logs_retention_days = models.IntegerField(
        default=365,
        help_text="Days to retain immutable audit trail logs.",
    )
    resolved_incidents_retention_days = models.IntegerField(
        default=180,
        help_text="Days to retain resolved incident history.",
    )

    # Security & Access Control
    session_timeout_minutes = models.IntegerField(
        default=120,
        help_text="Idle session timeout in minutes.",
    )
    require_2fa = models.BooleanField(
        default=False,
        help_text="Enforce two-factor authentication for all operators.",
    )
    allowed_ip_ranges = models.TextField(
        blank=True,
        default="",
        help_text="Comma-separated CIDR/IP blocks allowed to access console.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        db_table = "organizations_organization"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        # Auto-provision 14-day trial on creation if not set
        if not self.trial_ends_at and self._state.adding and self.subscription_status == OrganizationSubscriptionStatus.TRIALING:
            self.trial_ends_at = timezone.now() + timedelta(days=14)
        super().save(*args, **kwargs)

    @property
    def is_in_trial(self):
        if self.subscription_status == OrganizationSubscriptionStatus.TRIALING:
            if self.trial_ends_at:
                return timezone.now() <= self.trial_ends_at
            return False
        return False

    @property
    def trial_days_remaining(self):
        if not self.trial_ends_at or timezone.now() > self.trial_ends_at:
            return 0
        delta = self.trial_ends_at - timezone.now()
        return max(0, delta.days)

    def get_plan_limits(self):
        return plan_limits(self.plan_tier, beta=self.beta_managed)



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
