import csv
from datetime import timedelta
from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView

from common.permissions import IsSuperUser
from common.responses import error_response, success_response
from organizations.models import (
    Organization,
    OrganizationPlanTier,
    OrganizationSubscriptionStatus,
    PLAN_LIMITS,
)
from audit.models import AuditLog
from audit.services import AuditService


class PlatformStatsView(APIView):
    """Business metrics & SaaS financial telemetry.

    GET /api/v1/platform-admin/stats/
    """
    permission_classes = (IsSuperUser,)

    def get(self, request):
        now = timezone.now()
        thirty_days_ago = now - timedelta(days=30)

        # Plan price map in USD
        PLAN_PRICES = {
            OrganizationPlanTier.FREE: 0,
            OrganizationPlanTier.PRO: 29,
            OrganizationPlanTier.BUSINESS: 99,
            OrganizationPlanTier.ENTERPRISE: 299,
        }

        all_orgs = Organization.objects.all()
        total_orgs = all_orgs.count()

        # Count by plan
        orgs_by_plan = {
            tier.value: all_orgs.filter(plan_tier=tier.value).count()
            for tier in OrganizationPlanTier
        }

        # Count by status
        orgs_by_status = {
            st.value: all_orgs.filter(subscription_status=st.value).count()
            for st in OrganizationSubscriptionStatus
        }

        # Calculate MRR (exclude trialing or cancelled, include active/paid)
        mrr = 0
        for org in all_orgs:
            if org.subscription_status in [
                OrganizationSubscriptionStatus.ACTIVE,
                OrganizationSubscriptionStatus.PAST_DUE,
            ]:
                mrr += PLAN_PRICES.get(org.plan_tier, 0)

        arr = mrr * 12

        # Infrastructure Counts
        from accounts.models import User
        from monitoring.models import MonitoringTarget, AgentProbe

        total_users = User.objects.count()
        total_targets = MonitoringTarget.objects.count()
        active_targets = MonitoringTarget.objects.filter(enabled=True).count()

        total_probes = AgentProbe.objects.count()
        online_probes = AgentProbe.objects.filter(
            status="online",
            last_heartbeat__gte=now - timedelta(seconds=90),
        ).count()

        recent_signups = all_orgs.filter(created_at__gte=thirty_days_ago).count()

        return success_response({
            "financials": {
                "mrr_usd": mrr,
                "arr_usd": arr,
                "currency": "USD",
            },
            "organizations": {
                "total": total_orgs,
                "by_plan": orgs_by_plan,
                "by_status": orgs_by_status,
                "recent_signups_30d": recent_signups,
            },
            "infrastructure": {
                "total_users": total_users,
                "total_targets": total_targets,
                "active_targets": active_targets,
                "total_probes": total_probes,
                "online_probes": online_probes,
            },
        })


class PlatformOrganizationListView(APIView):
    """List and filter all tenant organizations.

    GET /api/v1/platform-admin/organizations/
    """
    permission_classes = (IsSuperUser,)

    def get(self, request):
        search = request.query_params.get("search", "").strip()
        plan_filter = request.query_params.get("plan_tier", "").strip()
        status_filter = request.query_params.get("status", "").strip()

        qs = Organization.objects.all().order_by("-created_at")

        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(slug__icontains=search)
                | Q(billing_email__icontains=search)
            )

        if plan_filter and plan_filter != "all":
            qs = qs.filter(plan_tier=plan_filter)

        if status_filter and status_filter != "all":
            qs = qs.filter(subscription_status=status_filter)

        from accounts.models import User
        from monitoring.models import MonitoringTarget, AgentProbe

        data = []
        for org in qs:
            limits = org.get_plan_limits()
            users_count = User.objects.filter(organization=org).count()
            targets_count = MonitoringTarget.objects.filter(organization=org).count()
            probes_count = AgentProbe.objects.filter(organization=org).count()

            data.append({
                "id": str(org.id),
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
                "sla_target_percentage": float(org.sla_target_percentage),
                "created_at": org.created_at.isoformat(),
                "users_count": users_count,
                "max_users": limits.get("max_users", 3),
                "targets_count": targets_count,
                "max_targets": limits.get("max_targets", 5),
                "probes_count": probes_count,
                "max_probes": limits.get("max_probes", 0),
            })

        return success_response(data)


class PlatformOrganizationDetailView(APIView):
    """Retrieve full detail for a tenant organization.

    GET /api/v1/platform-admin/organizations/{id}/
    """
    permission_classes = (IsSuperUser,)

    def get(self, request, org_id):
        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            return error_response("Organization not found.", status_code=status.HTTP_404_NOT_FOUND)

        from accounts.models import User
        from monitoring.models import MonitoringTarget, AgentProbe

        limits = org.get_plan_limits()
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
            for u in User.objects.filter(organization=org).order_by("-created_at")
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
            for t in MonitoringTarget.objects.filter(organization=org).order_by("-created_at")[:20]
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
            for p in AgentProbe.objects.filter(organization=org).order_by("-created_at")
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
            for a in AuditLog.objects.filter(organization_id=org.id).order_by("-timestamp")[:10]
        ]

        return success_response({
            "id": str(org.id),
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
            "users": users,
            "targets": targets,
            "probes": probes,
            "recent_audits": audit_logs,
        })


class PlatformOrganizationExtendTrialView(APIView):
    """Extend the trial period of a tenant.

    POST /api/v1/platform-admin/organizations/{id}/extend-trial/
    Payload: { "days": 14 }
    """
    permission_classes = (IsSuperUser,)

    def post(self, request, org_id):
        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            return error_response("Organization not found.", status_code=status.HTTP_404_NOT_FOUND)

        days = int(request.data.get("days", 14))
        if days <= 0 or days > 365:
            return error_response("Días de extensión inválidos (1 - 365).")

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
            description=f"Superadmin {request.user.email} extendió el periodo de prueba por {days} días (Vence: {org.trial_ends_at.strftime('%Y-%m-%d')}).",
        )

        return success_response({
            "message": f"Periodo de prueba extendido por {days} días.",
            "trial_ends_at": org.trial_ends_at.isoformat(),
            "trial_days_remaining": org.trial_days_remaining,
        })


class PlatformOrganizationSetPlanView(APIView):
    """Manually assign plan tier and status to a tenant.

    POST /api/v1/platform-admin/organizations/{id}/set-plan/
    Payload: { "plan_tier": "enterprise", "subscription_status": "active" }
    """
    permission_classes = (IsSuperUser,)

    def post(self, request, org_id):
        try:
            org = Organization.objects.get(id=org_id)
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
            description=f"Superadmin {request.user.email} modificó manualmente el plan de {old_plan} a {new_plan} (Estado: {new_status}).",
        )

        return success_response({
            "message": f"Plan actualizado a {new_plan.upper()} ({new_status}).",
            "plan_tier": org.plan_tier,
            "subscription_status": org.subscription_status,
            "limits": org.get_plan_limits(),
        })


class PlatformOrganizationToggleStatusView(APIView):
    """Suspend or reactivate a tenant.

    POST /api/v1/platform-admin/organizations/{id}/toggle-status/
    Payload: { "action": "suspend" | "reactivate" }
    """
    permission_classes = (IsSuperUser,)

    def post(self, request, org_id):
        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            return error_response("Organization not found.", status_code=status.HTTP_404_NOT_FOUND)

        action = request.data.get("action")
        if action == "suspend":
            org.subscription_status = OrganizationSubscriptionStatus.SUSPENDED
            org.save()
            msg = f"Organización {org.name} suspendida por el superadministrador."
        elif action == "reactivate":
            org.subscription_status = OrganizationSubscriptionStatus.ACTIVE
            org.save()
            msg = f"Organización {org.name} reactivada por el superadministrador."
        else:
            return error_response("Acción inválida. Usa 'suspend' o 'reactivate'.")

        AuditService.log(
            action="update",
            module="organization",
            organization_id=org.id,
            user_id=request.user.id,
            user_email=request.user.email,
            description=msg,
        )

        return success_response({
            "message": msg,
            "subscription_status": org.subscription_status,
        })


class PlatformExportCSVView(APIView):
    """Export all tenants and subscription metrics as CSV.

    GET /api/v1/platform-admin/export-csv/
    """
    permission_classes = (IsSuperUser,)

    def get(self, request):
        from accounts.models import User
        from monitoring.models import MonitoringTarget, AgentProbe

        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="sentinel_tenants_report.csv"'
        response.write("\ufeff".encode("utf-8"))  # UTF-8 BOM

        writer = csv.writer(response)
        writer.writerow([
            "ID Organización",
            "Nombre Empresa",
            "Slug",
            "Plan",
            "Estado Suscripción",
            "En Periodo Trial",
            "Días Restantes Trial",
            "Vencimiento Trial",
            "Email Facturación",
            "Usuarios Activos",
            "Monitores Activos",
            "Agentes Probes",
            "Fecha Registro",
        ])

        for org in Organization.objects.all().order_by("-created_at"):
            users_count = User.objects.filter(organization=org).count()
            targets_count = MonitoringTarget.objects.filter(organization=org).count()
            probes_count = AgentProbe.objects.filter(organization=org).count()

            writer.writerow([
                str(org.id),
                org.name,
                org.slug,
                org.plan_tier.upper(),
                org.subscription_status.upper(),
                "SI" if org.is_in_trial else "NO",
                org.trial_days_remaining,
                org.trial_ends_at.strftime("%Y-%m-%d %H:%M") if org.trial_ends_at else "N/A",
                org.billing_email or "N/A",
                users_count,
                targets_count,
                probes_count,
                org.created_at.strftime("%Y-%m-%d %H:%M"),
            ])

        return response
