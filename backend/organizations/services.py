from django.apps import apps
from django.db import transaction

from .models import (
    PLAN_LIMITS,
    Organization,
    OrganizationPlanTier,
    OrganizationSubscriptionStatus,
)


class QuotaExceededException(Exception):
    """Raised when an organization exceeds its plan limits."""

    def __init__(self, message, resource_type, current, limit, plan_tier):
        super().__init__(message)
        self.resource_type = resource_type
        self.current = current
        self.limit = limit
        self.plan_tier = plan_tier


class FeatureNotAllowedException(Exception):
    """Raised when an organization attempts to use a feature not included in its plan."""

    def __init__(self, message, feature_name, plan_tier):
        super().__init__(message)
        self.feature_name = feature_name
        self.plan_tier = plan_tier


class QuotaService:
    """Service for enforcing and tracking SaaS plan limits and premium feature gates."""

    @staticmethod
    def get_usage_summary(organization):
        """Calculate live resource usage against plan limits for an organization."""
        limits = organization.get_plan_limits()

        # 1. Monitoring Targets
        try:
            MonitoringTarget = apps.get_model("monitoring", "MonitoringTarget")
            targets_count = MonitoringTarget.objects.filter(organization=organization).count()
        except Exception:
            targets_count = 0

        # 2. SSL Certificates
        try:
            SSLCertificate = apps.get_model("ssl_monitor", "SSLCertificate")
            ssl_count = SSLCertificate.objects.filter(organization=organization).count()
        except Exception:
            ssl_count = 0

        # 3. API Checks
        try:
            APICheck = apps.get_model("api_checks", "APICheck")
            api_count = APICheck.objects.filter(organization=organization).count()
        except Exception:
            api_count = 0

        # 4. Status Pages
        try:
            StatusPage = apps.get_model("status_page", "StatusPage")
            status_pages_count = StatusPage.objects.filter(organization=organization).count()
        except Exception:
            status_pages_count = 0

        # 5. Team Members (active users + pending invitations)
        try:
            User = apps.get_model("accounts", "User")
            InvitationToken = apps.get_model("organizations", "InvitationToken")
            active_users = User.objects.filter(organization=organization).count()
            pending_invites = InvitationToken.objects.filter(
                organization=organization, is_used=False
            ).count()
            members_count = active_users + pending_invites
        except Exception:
            members_count = 0

        # 6. Private Agents (Probes)
        try:
            AgentProbe = apps.get_model("monitoring", "AgentProbe")
            agents_count = AgentProbe.objects.filter(organization=organization).count()
        except Exception:
            agents_count = 0

        # 7. DNS Records
        try:
            DNSRecord = apps.get_model("dns_monitor", "DNSRecord")
            dns_count = DNSRecord.objects.filter(organization=organization).count()
        except Exception:
            dns_count = 0

        # 8. Monitored Domains (WHOIS)
        try:
            DomainInfo = apps.get_model("domain", "DomainInfo")
            domains_count = DomainInfo.objects.filter(organization=organization).count()
        except Exception:
            domains_count = 0

        # 9. Security Headers Targets
        try:
            SecurityHeaderTarget = apps.get_model("security_headers", "SecurityHeaderTarget")
            sec_headers_count = SecurityHeaderTarget.objects.filter(organization=organization).count()
        except Exception:
            sec_headers_count = 0

        # 10. Notification Channels
        try:
            NotificationChannel = apps.get_model("notifications", "NotificationChannel")
            channels_count = NotificationChannel.objects.filter(organization=organization).count()
        except Exception:
            channels_count = 0

        def build_metric(current, limit):
            limit_val = limit if limit is not None else 9999
            pct = 0
            if limit_val > 0 and limit_val < 9999:
                pct = min(100, round((current / limit_val) * 100))
            elif limit_val >= 9999:
                pct = 0  # unlimited
            return {
                "current": current,
                "limit": limit_val,
                "percentage": pct,
                "is_unlimited": limit_val >= 9999,
                "is_exceeded": current >= limit_val if limit_val < 9999 else False,
            }

        usage = {
            "targets": build_metric(targets_count, limits.get("max_monitoring_targets")),
            "ssl_certificates": build_metric(ssl_count, limits.get("max_ssl_certificates")),
            "api_checks": build_metric(api_count, limits.get("max_api_checks")),
            "dns_records": build_metric(dns_count, limits.get("max_dns_records")),
            "domains": build_metric(domains_count, limits.get("max_domains")),
            "security_headers": build_metric(sec_headers_count, limits.get("max_security_headers")),
            "notification_channels": build_metric(channels_count, limits.get("max_notification_channels")),
            "team_members": build_metric(members_count, limits.get("max_team_members")),
            "status_pages": build_metric(status_pages_count, limits.get("max_status_pages")),
            "private_agents": build_metric(agents_count, limits.get("max_private_agents")),
        }

        all_plans = [
            PLAN_LIMITS[OrganizationPlanTier.FREE],
            PLAN_LIMITS[OrganizationPlanTier.PRO],
            PLAN_LIMITS[OrganizationPlanTier.BUSINESS],
            PLAN_LIMITS[OrganizationPlanTier.ENTERPRISE],
        ]

        return {
            "plan_tier": organization.plan_tier,
            "plan_name": limits.get("name", "Pro / Growth"),
            "subscription_status": organization.subscription_status,
            "billing_email": organization.billing_email,
            "is_in_trial": organization.is_in_trial,
            "trial_days_remaining": organization.trial_days_remaining,
            "trial_ends_at": organization.trial_ends_at,
            "limits": limits,
            "usage": usage,
            "all_plans": all_plans,
        }

    @staticmethod
    def check_quota(organization, resource_type):
        """Check if organization can create one more resource of type.

        Raises QuotaExceededException if quota is exceeded.
        """
        limits = organization.get_plan_limits()
        summary = QuotaService.get_usage_summary(organization)
        metric = summary["usage"].get(resource_type)

        if not metric:
            return True

        if metric["is_exceeded"]:
            resource_labels = {
                "targets": "monitores de Uptime",
                "ssl_certificates": "certificados SSL",
                "api_checks": "API Checks sintéticos",
                "dns_records": "registros DNS monitoreados",
                "domains": "dominios WHOIS monitoreados",
                "security_headers": "objetivos de cabeceras de seguridad",
                "notification_channels": "canales de notificación",
                "team_members": "miembros de equipo",
                "status_pages": "páginas de estado",
                "private_agents": "agentes satélite privados",
            }
            label = resource_labels.get(resource_type, resource_type)
            raise QuotaExceededException(
                f"Has alcanzado el límite de {metric['limit']} {label} permitido en tu plan {summary['plan_name']}. "
                f"Actualiza a un plan superior para continuar agregando recursos.",
                resource_type=resource_type,
                current=metric["current"],
                limit=metric["limit"],
                plan_tier=organization.plan_tier,
            )
        return True

    @staticmethod
    def check_min_interval(organization, requested_interval):
        """Check if the requested check interval meets the organization's plan minimum.

        Raises QuotaExceededException if interval is lower than allowed.
        """
        if not requested_interval or not organization:
            return True

        limits = organization.get_plan_limits()
        min_allowed = limits.get("min_check_interval_seconds", 60)
        try:
            val = int(requested_interval)
        except (ValueError, TypeError):
            val = 60

        if val < min_allowed:
            summary = QuotaService.get_usage_summary(organization)
            raise QuotaExceededException(
                f"El intervalo de sondeo mínimo permitido para tu plan {summary['plan_name']} es de {min_allowed} segundos ({min_allowed // 60} min). "
                f"Para escaneos de alta frecuencia ({val}s), actualiza a un plan superior.",
                resource_type="min_interval",
                current=val,
                limit=min_allowed,
                plan_tier=organization.plan_tier,
            )
        return True

    @staticmethod
    def check_feature_access(organization, feature_name):
        """Check if a specific premium feature is included in the organization's plan."""
        if not organization:
            return True

        limits = organization.get_plan_limits()
        has_access = limits.get(feature_name, False)

        if not has_access:
            feature_labels = {
                "sla_reports": "Informes Oficiales de Auditoría & SLA",
                "maintenance_windows": "Programación de Ventanas de Mantenimiento",
                "rca_postmortem": "Análisis de Causa Raíz (RCA) y Post-Mortems",
                "custom_domain_status_page": "Dominio Personalizado en Status Page",
            }
            label = feature_labels.get(feature_name, feature_name)
            plan_name = PLAN_LIMITS.get(organization.plan_tier, {}).get("name", organization.plan_tier)
            raise FeatureNotAllowedException(
                f"La funcionalidad '{label}' no está incluida en tu plan actual ({plan_name}). "
                f"Actualiza tu suscripción a Pro o Business para desbloquear esta capacidad.",
                feature_name=feature_name,
                plan_tier=organization.plan_tier,
            )
        return True


class OrganizationService:
    """Service for organization management.

    Handles CRUD operations and configuration for tenants.
    All business logic lives here, not in views.
    """

    @staticmethod
    def list_organizations():
        """Return all organizations ordered by creation date."""
        return Organization.objects.all().order_by("-created_at")

    @staticmethod
    def get_organization(organization_id):
        """Return a single organization by ID.

        Raises:
            Organization.DoesNotExist if not found.
        """
        return Organization.objects.get(id=organization_id)

    @staticmethod
    @transaction.atomic
    def create_organization(name, slug, timezone="UTC", locale="en-US", plan_tier="pro"):
        """Create a new organization."""
        return Organization.objects.create(
            name=name,
            slug=slug,
            timezone=timezone,
            locale=locale,
            plan_tier=plan_tier,
            subscription_status=OrganizationSubscriptionStatus.TRIALING,
        )

    @staticmethod
    @transaction.atomic
    def update_organization(organization_id, **fields):
        """Update an existing organization."""
        organization = Organization.objects.get(id=organization_id)
        for field, value in fields.items():
            if value is not None:
                setattr(organization, field, value)
        organization.save()
        return organization

    @staticmethod
    @transaction.atomic
    def change_plan(organization_id, new_tier):
        """Change the subscription plan of an organization."""
        organization = Organization.objects.get(id=organization_id)
        if new_tier not in OrganizationPlanTier.values:
            raise ValueError(f"Nivel de plan no válido: {new_tier}")

        organization.plan_tier = new_tier
        if organization.subscription_status == OrganizationSubscriptionStatus.TRIALING and new_tier in ["business", "enterprise"]:
            organization.subscription_status = OrganizationSubscriptionStatus.ACTIVE
        organization.save()
        return organization

    @staticmethod
    @transaction.atomic
    def delete_organization(organization_id):
        """Delete an organization."""
        organization = Organization.objects.get(id=organization_id)
        organization.delete()