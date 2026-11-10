import csv
from datetime import timedelta
from django.db.models import Count, OuterRef, Exists
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework import serializers

from accounts.platform_auth import PlatformAPIView
from common.responses import error_response, success_response
from organizations.models import (
    Organization,
    OrganizationPlanTier,
    OrganizationSubscriptionStatus,
    PLAN_LIMITS,
)
from audit.models import AuditLog
from audit.services import AuditService
from .platform_queries import directory, counted
from .platform_resources import usage
from .platform_serializers import OrganizationOutput, OrganizationDetailOutput, AccessOutput, DirectoryMetaOutput
from .platform_queries import DirectoryQuery
from django.db import transaction


def mutation_reason(request):
    class Reason(serializers.Serializer):
        reason = serializers.CharField(min_length=3, max_length=500)

    data = Reason(data=request.data)
    data.is_valid(raise_exception=True)
    return data.validated_data["reason"]


class PlatformCatalogView(PlatformAPIView):
    def get(self, request):
        from .plans import plan_limits

        beta = False
        if request.query_params.get("organization_id"):

            class Query(serializers.Serializer):
                organization_id = serializers.UUIDField()

            query = Query(data=request.query_params)
            query.is_valid(raise_exception=True)
            beta = Organization.objects.get(pk=query.validated_data["organization_id"]).beta_managed
        return success_response(
            {
                "plans": [
                    {
                        "id": tier,
                        "name": label,
                        "price": None if beta and tier == "business" else PLAN_LIMITS[tier].get("price_monthly_usd"),
                        "limits": plan_limits(tier, beta=beta),
                    }
                    for tier, label in OrganizationPlanTier.choices
                ]
            }
        )


class PlatformClassificationView(PlatformAPIView):
    @transaction.atomic
    def post(self, request, org_id):
        reason = mutation_reason(request)

        class Input(serializers.Serializer):
            is_test = serializers.BooleanField()

        payload = Input(data=request.data)
        payload.is_valid(raise_exception=True)
        org = Organization.objects.select_for_update().filter(pk=org_id).first()
        if not org:
            return error_response("Organización no encontrada.", status_code=404)
        before = org.is_test
        org.is_test = payload.validated_data["is_test"]
        org.save(update_fields=["is_test"])
        AuditService.log(
            action="config_change",
            module="organization",
            organization_id=org.id,
            user_id=request.user.id,
            user_email=request.user.email,
            description=f"Clasificación de prueba: {before} → {org.is_test}. Motivo: {reason}",
        )
        return success_response({"is_test": org.is_test})


class PlatformStatsView(PlatformAPIView):
    """Business metrics & SaaS financial telemetry.

    GET /api/v1/platform-admin/stats/
    """

    def get(self, request):
        now = timezone.now()
        thirty_days_ago = now - timedelta(days=30)

        # Plan price map in USD
        PLAN_PRICES = {tier: plan.get("price_monthly_usd") for tier, plan in PLAN_LIMITS.items()}

        classification = request.query_params.get("classification", "customers")
        if classification not in ("customers", "tests", "all"):
            return error_response("Clasificación inválida.", status_code=400)
        all_orgs = Organization.objects.all()
        if classification != "all":
            all_orgs = all_orgs.filter(is_test=classification == "tests")
        total_orgs = all_orgs.count()

        # Count by plan
        orgs_by_plan = {tier.value: all_orgs.filter(plan_tier=tier.value).count() for tier in OrganizationPlanTier}

        # Count by status
        orgs_by_status = {
            st.value: all_orgs.filter(subscription_status=st.value).count() for st in OrganizationSubscriptionStatus
        }

        # Calculate MRR (exclude trialing or cancelled, include active/paid)
        mrr = 0
        quoted = 0
        for group in (
            all_orgs.filter(subscription_status__in=["active", "past_due"])
            .values("plan_tier", "beta_managed")
            .annotate(n=Count("id"))
        ):
            price = PLAN_PRICES.get(group["plan_tier"])
            if group["beta_managed"] and group["plan_tier"] == "business":
                price = None
            if price is None:
                quoted += group["n"]
            else:
                mrr += price * group["n"]

        arr = mrr * 12

        # Infrastructure Counts
        from accounts.models import User
        from monitoring.models import MonitoringTarget, AgentProbe

        total_users = User.objects.filter(organization__in=all_orgs).count()
        total_targets = MonitoringTarget.objects.filter(organization__in=all_orgs).count()
        active_targets = MonitoringTarget.objects.filter(organization__in=all_orgs, enabled=True).count()

        total_probes = AgentProbe.objects.filter(organization__in=all_orgs).count()
        online_probes = AgentProbe.objects.filter(
            organization__in=all_orgs,
            status="online",
            last_heartbeat__gte=now - timedelta(seconds=90),
        ).count()

        recent_signups = all_orgs.filter(created_at__gte=thirty_days_ago).count()

        return success_response(
            {
                "classification": classification,
                "financials": {
                    "mrr_usd": mrr,
                    "is_estimate": True,
                    "quoted_organizations": quoted,
                    "arr_usd": arr,
                    "currency": "USD",
                },
                "organizations": {
                    "total": total_orgs,
                    "by_plan": orgs_by_plan,
                    "by_status": orgs_by_status,
                    "recent_signups_30d": recent_signups,
                    "trial_expiring_7d": all_orgs.filter(
                        subscription_status="trialing",
                        trial_ends_at__gte=now,
                        trial_ends_at__lte=now + timedelta(days=7),
                    ).count(),
                },
                "infrastructure": {
                    "total_users": total_users,
                    "total_targets": total_targets,
                    "active_targets": active_targets,
                    "total_probes": total_probes,
                    "online_probes": online_probes,
                },
            }
        )


class PlatformOrganizationListView(PlatformAPIView):
    query_serializer = DirectoryQuery
    output_serializer = OrganizationOutput
    output_many = True
    meta_serializer = DirectoryMetaOutput
    """List and filter all tenant organizations.

    GET /api/v1/platform-admin/organizations/
    """

    def get(self, request):
        qs, validated = directory(request)

        from accounts.models import User

        total = qs.count()
        data = []
        qs = counted(qs).annotate(
            access_protected=Exists(
                User.objects.filter(organization_id=OuterRef("pk"), is_superuser=True, is_active=True)
            )
        )
        # Bound interactive directory requests without changing legacy exports.
        if request.query_params.get("page") is not None:
            try:
                page = max(1, int(request.query_params["page"]))
            except (TypeError, ValueError):
                return error_response("Página inválida.", status_code=400)
            qs = qs[(page - 1) * 25 : page * 25]
        for org in qs:
            limits = org.get_plan_limits()
            users_count = org.directory_users
            targets_count = org.directory_targets
            probes_count = org.directory_probes

            data.append(
                {
                    "id": str(org.id),
                    "is_test": org.is_test,
                    "name": org.name,
                    "slug": org.slug,
                    "plan_tier": org.plan_tier,
                    "subscription_status": org.subscription_status,
                    "access_protected": org.access_protected,
                    "access_status": org.status,
                    "beta_status": org.beta_status if org.beta_managed else None,
                    "beta_managed": org.beta_managed,
                    "is_in_trial": org.is_in_trial,
                    "trial_days_remaining": org.trial_days_remaining,
                    "trial_ends_at": org.trial_ends_at.isoformat() if org.trial_ends_at else None,
                    "billing_email": org.billing_email,
                    "tax_id": org.tax_id,
                    "website": org.website,
                    "contact_phone": org.contact_phone,
                    "sla_target_percentage": float(org.sla_target_percentage),
                    "created_at": org.created_at.isoformat(),
                    "users_count": users_count,
                    "max_users": limits["max_team_members"],
                    "targets_count": targets_count,
                    "max_targets": limits["max_monitoring_targets"],
                    "probes_count": probes_count,
                    "max_probes": limits["max_private_agents"],
                }
            )

        response = success_response(data)
        response.data["meta"] = {
            "total": total,
            "page": validated["page"],
            "page_size": 25,
            "has_next": validated["page"] * 25 < total,
        }
        return response


class PlatformOrganizationDetailView(PlatformAPIView):
    output_serializer = OrganizationDetailOutput
    """Retrieve full detail for a tenant organization.

    GET /api/v1/platform-admin/organizations/{id}/
    """

    def get(self, request, org_id):
        section = request.query_params.get("section")
        if section not in (None, "general", "users", "infrastructure", "audit"):
            return error_response("Sección inválida.", status_code=400)
        try:
            page = int(request.query_params.get("page", 1))
            if not 1 <= page <= 100000:
                raise ValueError()
        except ValueError:
            return error_response("Página inválida.", status_code=400)
        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            return error_response("Organization not found.", status_code=status.HTTP_404_NOT_FOUND)

        from accounts.models import User
        from monitoring.models import MonitoringTarget, AgentProbe

        limits = org.get_plan_limits()
        users_qs = User.objects.filter(organization=org).order_by("-created_at", "-id")
        targets_qs = MonitoringTarget.objects.filter(organization=org).order_by("-created_at", "-id")
        probes_qs = AgentProbe.objects.filter(organization=org).order_by("-created_at", "-id")
        audits_qs = AuditLog.objects.filter(organization_id=org.id).order_by("-timestamp", "-id")
        counts = {
            "users": users_qs.count(),
            "targets": targets_qs.count(),
            "probes": probes_qs.count(),
            "audit": audits_qs.count(),
        }
        start = (page - 1) * 25

        def scoped(qs, expected, legacy_limit=None):
            if section is None:
                return qs[:legacy_limit] if legacy_limit else qs
            return qs[start : start + 25] if section == expected else qs.none()

        users = [
            {
                "id": str(u.id),
                "email": u.email,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "is_staff": u.is_staff,
                "is_active": u.is_active,
                "last_login": u.last_login.isoformat() if u.last_login else None,
                "created_at": u.created_at.isoformat(),
            }
            for u in scoped(users_qs, "users")
        ]

        targets = [
            {
                "id": str(t.id),
                "name": t.name,
                "endpoint": t.endpoint,
                "target_type": t.target_type,
                "runner_type": t.runner_type,
                "enabled": t.enabled,
                "last_status": t.last_status,
                "last_latency": t.last_latency,
                "last_checked_at": t.last_checked_at.isoformat() if t.last_checked_at else None,
            }
            for t in scoped(targets_qs, "infrastructure", 20)
        ]

        probes = [
            {
                "id": str(p.id),
                "name": p.name,
                "status": p.status,
                "is_online": p.is_online,
                "last_heartbeat": p.last_heartbeat.isoformat() if p.last_heartbeat else None,
                "ip_address": p.ip_address,
                "hostname": p.hostname,
                "version": p.version,
            }
            for p in scoped(probes_qs, "infrastructure")
        ]

        audit_logs = [
            {
                "id": str(a.id),
                "user_email": a.user_email or "Sistema",
                "action": a.action,
                "resource_type": a.module,
                "resource_name": a.description,
                "description": a.description,
                "created_at": a.timestamp.isoformat(),
            }
            for a in scoped(audits_qs, "audit", 10)
        ]

        return success_response(
            {
                "id": str(org.id),
                "is_test": org.is_test,
                "counts": counts,
                "access_protected": users_qs.filter(is_superuser=True, is_active=True).exists(),
                "access_status": org.status,
                "beta_status": org.beta_status if org.beta_managed else None,
                "beta_managed": org.beta_managed,
                "resource_usage": usage(org) if section == "general" else [],
                "page": page,
                "has_next": (
                    counts.get(section, 0) if section != "infrastructure" else max(counts["targets"], counts["probes"])
                )
                > page * 25,
                "name": org.name,
                "slug": org.slug,
                "plan_tier": org.plan_tier,
                "subscription_status": org.subscription_status,
                "is_in_trial": org.is_in_trial,
                "trial_days_remaining": org.trial_days_remaining,
                "trial_ends_at": org.trial_ends_at.isoformat() if org.trial_ends_at else None,
                "billing_email": org.billing_email,
                "tax_id": org.tax_id,
                "contact_phone": org.contact_phone,
                "website": org.website,
                "sla_target_percentage": float(org.sla_target_percentage),
                "created_at": org.created_at.isoformat(),
                "limits": limits,
                "users_count": counts["users"],
                "max_users": limits["max_team_members"],
                "targets_count": MonitoringTarget.objects.filter(organization=org).count(),
                "max_targets": limits["max_monitoring_targets"],
                "probes_count": counts["probes"],
                "max_probes": limits["max_private_agents"],
                "users": users,
                "targets": targets,
                "probes": probes,
                "recent_audits": audit_logs,
            }
        )


class PlatformOrganizationExtendTrialView(PlatformAPIView):
    """Extend the trial period of a tenant.

    POST /api/v1/platform-admin/organizations/{id}/extend-trial/
    Payload: { "days": 14 }
    """

    @transaction.atomic
    def post(self, request, org_id):
        reason = mutation_reason(request)
        try:
            org = Organization.objects.select_for_update().get(id=org_id)
        except Organization.DoesNotExist:
            return error_response("Organization not found.", status_code=status.HTTP_404_NOT_FOUND)

        class TrialExtension(serializers.Serializer):
            days = serializers.IntegerField(min_value=1, max_value=365, default=14)

        payload = TrialExtension(data=request.data)
        if not payload.is_valid():
            return error_response("Días de extensión inválidos (1 - 365).")
        days = payload.validated_data["days"]

        base_time = max(timezone.now(), org.trial_ends_at or timezone.now())
        org.trial_ends_at = base_time + timedelta(days=days)
        org.subscription_status = OrganizationSubscriptionStatus.TRIALING
        org.save()

        AuditService.log(
            action="update",
            module="subscription",
            organization_id=org.id,
            user_id=request.user.id,
            user_email=request.user.email,
            description=f"Superadmin {request.user.email} extendió el periodo de prueba por {days} días (Vence: {org.trial_ends_at.strftime('%Y-%m-%d')}). Motivo: {reason}",
        )

        return success_response(
            {
                "message": f"Periodo de prueba extendido por {days} días.",
                "trial_ends_at": org.trial_ends_at.isoformat(),
                "trial_days_remaining": org.trial_days_remaining,
            }
        )


class PlatformOrganizationSetPlanView(PlatformAPIView):
    """Manually assign plan tier and status to a tenant.

    POST /api/v1/platform-admin/organizations/{id}/set-plan/
    Payload: { "plan_tier": "enterprise", "subscription_status": "active" }
    """

    @transaction.atomic
    def post(self, request, org_id):
        reason = mutation_reason(request)
        try:
            org = Organization.objects.select_for_update().get(id=org_id)
        except Organization.DoesNotExist:
            return error_response("Organization not found.", status_code=status.HTTP_404_NOT_FOUND)

        new_plan = request.data.get("plan_tier")
        new_status = request.data.get("subscription_status", OrganizationSubscriptionStatus.ACTIVE)

        valid_plans = [c[0] for c in OrganizationPlanTier.choices]
        valid_statuses = [c[0] for c in OrganizationSubscriptionStatus.choices]

        if new_plan not in valid_plans:
            return error_response(f"Plan inválido. Opciones: {valid_plans}")

        if new_status not in valid_statuses:
            return error_response(f"Estado inválido. Opciones: {valid_statuses}")

        old_plan = org.plan_tier
        org.plan_tier = new_plan
        org.subscription_status = new_status
        org.save()

        AuditService.log(
            action="update",
            module="subscription",
            organization_id=org.id,
            user_id=request.user.id,
            user_email=request.user.email,
            description=f"Superadmin {request.user.email} modificó manualmente el plan de {old_plan} a {new_plan} (Estado: {new_status}). Motivo: {reason}",
        )

        return success_response(
            {
                "message": f"Plan actualizado a {new_plan.upper()} ({new_status}).",
                "plan_tier": org.plan_tier,
                "subscription_status": org.subscription_status,
                "limits": org.get_plan_limits(),
            }
        )


class PlatformOrganizationToggleStatusView(PlatformAPIView):
    output_serializer = AccessOutput
    """Suspend or reactivate a tenant.

    POST /api/v1/platform-admin/organizations/{id}/toggle-status/
    Payload: { "action": "suspend" | "reactivate" }
    """

    def post(self, request, org_id):
        from .platform_access import change_access

        return success_response(
            change_access(
                organization_id=org_id,
                actor=request.user,
                action=request.data.get("action"),
                reason=mutation_reason(request),
            )
        )


class PlatformExportCSVView(PlatformAPIView):
    """Export all tenants and subscription metrics as CSV.

    GET /api/v1/platform-admin/export-csv/
    """

    def get(self, request):

        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="sentinel_tenants_report.csv"'
        response.write("\ufeff".encode("utf-8"))  # UTF-8 BOM

        writer = csv.writer(response)
        writer.writerow(
            [
                "ID Organización",
                "Nombre Empresa",
                "Slug",
                "Plan",
                "Estado Suscripción",
                "En Periodo Trial",
                "Días Restantes Trial",
                "Vencimiento Trial",
                "Email Facturación",
                "Usuarios registrados",
                "Monitores registrados",
                "Agentes Probes",
                "Fecha Registro",
                "Clasificación",
                "Acceso",
                "Participación beta",
            ]
        )

        qs, _ = directory(request)
        for org in counted(qs).iterator(chunk_size=500):
            users_count = org.directory_users
            targets_count = org.directory_targets
            probes_count = org.directory_probes

            writer.writerow(
                [
                    str(org.id),
                    safe_csv_cell(org.name),
                    safe_csv_cell(org.slug),
                    org.plan_tier.upper(),
                    org.subscription_status.upper(),
                    "SI" if org.is_in_trial else "NO",
                    org.trial_days_remaining,
                    org.trial_ends_at.strftime("%Y-%m-%d %H:%M") if org.trial_ends_at else "N/A",
                    safe_csv_cell(org.billing_email or "N/A"),
                    users_count,
                    targets_count,
                    probes_count,
                    org.created_at.strftime("%Y-%m-%d %H:%M"),
                    "Prueba" if org.is_test else "Cliente",
                    org.status,
                    org.beta_status if org.beta_managed else "Fuera de beta",
                ]
            )

        return response


def safe_csv_cell(value):
    if value.lstrip().startswith(("=", "+", "-", "@")) or value.startswith(("\t", "\r", "\n")):
        return "'" + value
    return value
