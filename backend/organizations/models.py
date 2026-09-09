import secrets
import uuid
from datetime import timedelta

from django.db import models
from django.utils import timezone


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


PLAN_LIMITS = {
    OrganizationPlanTier.FREE: {
        "tier": "free",
        "name": "Starter / Free",
        "price_monthly_usd": 0,
        "max_monitoring_targets": 5,
        "max_ssl_certificates": 2,
        "max_api_checks": 1,
        "max_private_agents": 0,
        "min_check_interval_seconds": 300,
        "metrics_retention_days": 7,
        "max_team_members": 1,
        "max_status_pages": 1,
        "custom_domain_status_page": False,
        "sla_reports": False,
        "maintenance_windows": False,
        "rca_postmortem": False,
    },
    OrganizationPlanTier.PRO: {
        "tier": "pro",
        "name": "Pro / Growth",
        "price_monthly_usd": 29,
        "max_monitoring_targets": 25,
        "max_ssl_certificates": 10,
        "max_api_checks": 5,
        "max_private_agents": 1,
        "min_check_interval_seconds": 60,
        "metrics_retention_days": 30,
        "max_team_members": 5,
        "max_status_pages": 2,
        "custom_domain_status_page": True,
        "sla_reports": True,
        "maintenance_windows": False,
        "rca_postmortem": False,
    },
    OrganizationPlanTier.BUSINESS: {
        "tier": "business",
        "name": "Business",
        "price_monthly_usd": 99,
        "max_monitoring_targets": 75,
        "max_ssl_certificates": 50,
        "max_api_checks": 25,
        "max_private_agents": 3,
        "min_check_interval_seconds": 30,
        "metrics_retention_days": 90,
        "max_team_members": 15,
        "max_status_pages": 10,
        "custom_domain_status_page": True,
        "sla_reports": True,
        "maintenance_windows": True,
        "rca_postmortem": True,
    },
    OrganizationPlanTier.ENTERPRISE: {
        "tier": "enterprise",
        "name": "Enterprise Dedicated",
        "price_monthly_usd": 399,
        "max_monitoring_targets": 9999,
        "max_ssl_certificates": 9999,
        "max_api_checks": 9999,
        "max_private_agents": 9999,
        "min_check_interval_seconds": 15,
        "metrics_retention_days": 365,
        "max_team_members": 9999,
        "max_status_pages": 9999,
        "custom_domain_status_page": True,
        "sla_reports": True,
        "maintenance_windows": True,
        "rca_postmortem": True,
    },
}


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

    # SaaS Subscription & Billing
    plan_tier = models.CharField(
        max_length=20,
        choices=OrganizationPlanTier.choices,
        default=OrganizationPlanTier.PRO,
        help_text="Current subscription tier.",
    )
    subscription_status = models.CharField(
        max_length=20,
        choices=OrganizationSubscriptionStatus.choices,
        default=OrganizationSubscriptionStatus.TRIALING,
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
        default=60,
        help_text="Default interval for monitoring checks in seconds.",
    )

    # Retention & Compliance (ISO 27001 / SOC 2)
    metrics_retention_days = models.IntegerField(
        default=90,
        help_text="Days to retain raw time-series metrics in TimescaleDB.",
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
        if not self.trial_ends_at and not self.pk:
            self.trial_ends_at = timezone.now() + timedelta(days=14)
        super().save(*args, **kwargs)

    @property
    def is_in_trial(self):
        if self.subscription_status == OrganizationSubscriptionStatus.TRIALING:
            if self.trial_ends_at:
                return timezone.now() <= self.trial_ends_at
            return True
        return False

    @property
    def trial_days_remaining(self):
        if not self.trial_ends_at or timezone.now() > self.trial_ends_at:
            return 0
        delta = self.trial_ends_at - timezone.now()
        return max(0, delta.days)

    def get_plan_limits(self):
        return PLAN_LIMITS.get(
            self.plan_tier, PLAN_LIMITS[OrganizationPlanTier.FREE]
        )



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