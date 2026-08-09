from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from .models import StatusPageConfig, ScheduledMaintenance
from monitoring.models import MonitoringTarget, MonitoringCheck
from api_checks.models import APICheckTarget, APICheckResult
from incidents.models import Incident


class StatusPageService:
    """Service for Status Page configuration, maintenance management, and 90-day uptime calculations."""

    @staticmethod
    def get_or_create_config(organization_id):
        """Get or create default status page configuration for an organization."""
        config = StatusPageConfig.objects.filter(organization_id=organization_id).first()
        if not config:
            slug = f"status-{str(organization_id)[:8]}"
            config = StatusPageConfig.objects.create(
                organization_id=organization_id,
                company_name="Servicios de Monitoreo",
                slug=slug,
                is_public=True,
            )
        return config

    @staticmethod
    @transaction.atomic
    def update_config(organization_id, data):
        """Update status page configuration."""
        config = StatusPageService.get_or_create_config(organization_id)
        for key, value in data.items():
            if value is not None:
                setattr(config, key, value)
        config.save()
        return config

    @staticmethod
    def get_public_status_data(slug):
        """Calculates 90-day uptime bars, overall health status, active incidents, and maintenances."""
        config = StatusPageConfig.objects.filter(slug=slug).first()
        if not config:
            raise ValueError("Status Page no encontrada.")

        if not config.is_public:
            raise PermissionError("Esta Status Page es privada.")

        org_id = config.organization_id

        # 1. Fetch Services/Targets
        targets = MonitoringTarget.objects.filter(organization_id=org_id, enabled=True)
        api_targets = APICheckTarget.objects.filter(organization_id=org_id, enabled=True)

        now = timezone.now()
        start_90_days_ago = now - timedelta(days=90)

        services_data = []
        overall_operational = True
        overall_outage = False

        date_list = [(now.date() - timedelta(days=i)) for i in range(89, -1, -1)]

        # Process Uptime Targets
        for target in targets:
            checks = MonitoringCheck.objects.filter(
                target=target,
                checked_at__gte=start_90_days_ago,
            ).values("checked_at", "status", "latency")

            # Group checks per day
            checks_by_day = {}
            for c in checks:
                day_key = c["checked_at"].date()
                if day_key not in checks_by_day:
                    checks_by_day[day_key] = {"total": 0, "up": 0, "down": 0}
                checks_by_day[day_key]["total"] += 1
                if c["status"] == "up":
                    checks_by_day[day_key]["up"] += 1
                else:
                    checks_by_day[day_key]["down"] += 1

            day_blocks = []
            total_up = 0
            total_checks = 0

            for d in date_list:
                stats = checks_by_day.get(d)
                if stats and stats["total"] > 0:
                    day_uptime = (stats["up"] / stats["total"]) * 100
                    status = "up" if day_uptime >= 99 else "degraded" if day_uptime >= 80 else "down"
                    total_up += stats["up"]
                    total_checks += stats["total"]
                    day_checks_count = stats["total"]
                else:
                    day_uptime = 100.0
                    status = "up"
                    day_checks_count = 0

                day_blocks.append({
                    "date": d.strftime("%Y-%m-%d"),
                    "status": status,
                    "uptime_pct": round(day_uptime, 2),
                    "total_checks": day_checks_count,
                })

            service_status = "up" if target.last_status == "up" else "down"
            if service_status == "down":
                overall_outage = True

            overall_uptime_pct = round((total_up / total_checks * 100), 2) if total_checks > 0 else 100.0

            services_data.append({
                "id": str(target.id),
                "name": target.name,
                "type": "uptime",
                "category": "Websites & Portales Web",
                "current_status": service_status,
                "uptime_90_days_pct": overall_uptime_pct,
                "history_90_days": day_blocks,
            })

        # Process API Check Targets
        for api_t in api_targets:
            results = APICheckResult.objects.filter(
                target=api_t,
                checked_at__gte=start_90_days_ago,
            ).values("checked_at", "status", "response_time_ms")

            checks_by_day = {}
            for r in results:
                day_key = r["checked_at"].date()
                if day_key not in checks_by_day:
                    checks_by_day[day_key] = {"total": 0, "pass": 0, "fail": 0}
                checks_by_day[day_key]["total"] += 1
                if r["status"] in ["pass", "ok"]:
                    checks_by_day[day_key]["pass"] += 1
                else:
                    checks_by_day[day_key]["fail"] += 1

            day_blocks = []
            total_pass = 0
            total_checks = 0

            for d in date_list:
                stats = checks_by_day.get(d)
                if stats and stats["total"] > 0:
                    day_uptime = (stats["pass"] / stats["total"]) * 100
                    status = "up" if day_uptime >= 99 else "degraded" if day_uptime >= 80 else "down"
                    total_pass += stats["pass"]
                    total_checks += stats["total"]
                    day_checks_count = stats["total"]
                else:
                    day_uptime = 100.0
                    status = "up"
                    day_checks_count = 0

                day_blocks.append({
                    "date": d.strftime("%Y-%m-%d"),
                    "status": status,
                    "uptime_pct": round(day_uptime, 2),
                    "total_checks": day_checks_count,
                })

            api_status = "up" if api_t.last_status in ["pass", "ok"] else "down"
            if api_status == "down":
                overall_outage = True

            overall_uptime_pct = round((total_pass / total_checks * 100), 2) if total_checks > 0 else 100.0

            services_data.append({
                "id": str(api_t.id),
                "name": api_t.name,
                "type": "api",
                "category": "APIs & Integraciones Backend",
                "current_status": api_status,
                "uptime_90_days_pct": overall_uptime_pct,
                "history_90_days": day_blocks,
            })

        # 2. Active Incidents
        active_incidents = Incident.objects.filter(
            organization_id=org_id,
            status__in=[
                Incident.Status.OPEN,
                Incident.Status.INVESTIGATING,
                Incident.Status.IDENTIFIED,
                Incident.Status.MITIGATED,
            ],
        ).order_by("-opened_at")

        incidents_data = [
            {
                "id": str(inc.id),
                "title": inc.title,
                "description": inc.description,
                "priority": inc.priority,
                "status": inc.status,
                "opened_at": inc.opened_at.isoformat(),
            }
            for inc in active_incidents
        ]

        # Past Incidents (Resolved/Closed in last 30 days)
        past_incidents = Incident.objects.filter(
            organization_id=org_id,
            status__in=[Incident.Status.RESOLVED, Incident.Status.CLOSED],
            opened_at__gte=now - timedelta(days=30),
        ).order_by("-opened_at")[:5]

        past_incidents_data = [
            {
                "id": str(inc.id),
                "title": inc.title,
                "description": inc.description,
                "priority": inc.priority,
                "status": inc.status,
                "opened_at": inc.opened_at.isoformat(),
                "closed_at": inc.closed_at.isoformat() if inc.closed_at else None,
            }
            for inc in past_incidents
        ]

        # 3. Scheduled Maintenances
        maintenances = ScheduledMaintenance.objects.filter(
            organization_id=org_id,
            status__in=[ScheduledMaintenance.Status.SCHEDULED, ScheduledMaintenance.Status.IN_PROGRESS],
        ).order_by("start_time")

        maintenances_data = [
            {
                "id": str(m.id),
                "title": m.title,
                "description": m.description,
                "status": m.status,
                "start_time": m.start_time.isoformat(),
                "end_time": m.end_time.isoformat(),
            }
            for m in maintenances
        ]

        # Global Status Summary & High-Level KPIs
        total_services_count = len(services_data)
        operational_services_count = sum(1 for s in services_data if s["current_status"] == "up")
        avg_uptime = (
            round(sum(s["uptime_90_days_pct"] for s in services_data) / total_services_count, 2)
            if total_services_count > 0
            else 100.0
        )

        if overall_outage:
            system_status = "outage"
            system_status_label = "Interrupción importante de servicio"
        elif len(active_incidents) > 0 or any(m.status == "in_progress" for m in maintenances):
            system_status = "degraded"
            system_status_label = "Degradación parcial de servicio"
        return {
            "company_name": config.company_name,
            "description": config.description,
            "logo_url": config.logo_url,
            "support_email": config.support_email,
            "system_status": system_status,
            "system_status_label": system_status_label,
            "global_uptime_pct": avg_uptime,
            "total_services_count": total_services_count,
            "operational_services_count": operational_services_count,
            "services": services_data,
            "active_incidents": incidents_data,
            "past_incidents": past_incidents_data,
            "maintenances": maintenances_data,
            "updated_at": now.isoformat(),
        }

    # Maintenance CRUD
    @staticmethod
    def list_maintenances(organization_id):
        return ScheduledMaintenance.objects.filter(organization_id=organization_id).order_by("-start_time")

    @staticmethod
    @transaction.atomic
    def create_maintenance(organization_id, data):
        return ScheduledMaintenance.objects.create(
            organization_id=organization_id,
            title=data["title"],
            description=data.get("description", ""),
            status=data.get("status", ScheduledMaintenance.Status.SCHEDULED),
            start_time=data["start_time"],
            end_time=data["end_time"],
        )

    @staticmethod
    @transaction.atomic
    def update_maintenance(maintenance_id, organization_id, data):
        m = ScheduledMaintenance.objects.get(id=maintenance_id, organization_id=organization_id)
        for k, v in data.items():
            if v is not None:
                setattr(m, k, v)
        m.save()
        return m

    @staticmethod
    @transaction.atomic
    def delete_maintenance(maintenance_id, organization_id):
        m = ScheduledMaintenance.objects.get(id=maintenance_id, organization_id=organization_id)
        m.delete()
