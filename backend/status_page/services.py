import uuid
from datetime import timedelta
from django.db import transaction
from django.db.models import Avg, Q
from django.utils import timezone
from .models import StatusPageConfig, ScheduledMaintenance, MaintenanceUpdate, StatusPageSubscriber
from monitoring.models import MonitoringTarget, MonitoringCheck
from api_checks.models import APICheckTarget, APICheckResult
from incidents.models import Incident


class StatusPageService:
    """Service for Status Page configuration, component customization, maintenance tracking, and subscriber alerts."""

    @staticmethod
    def list_status_pages(organization_id):
        """List all Status Pages in the organization with summary KPIs."""
        # Ensure at least one default config exists
        default_config = StatusPageConfig.objects.filter(organization_id=organization_id).first()
        if not default_config:
            default_config = StatusPageService.get_or_create_config(organization_id)

        # If no page is marked default, mark the first one as default
        if not StatusPageConfig.objects.filter(organization_id=organization_id, is_default=True).exists():
            default_config.is_default = True
            default_config.save(update_fields=["is_default"])

        pages = StatusPageConfig.objects.filter(organization_id=organization_id).order_by("-is_default", "company_name")
        res = []
        for p in pages:
            settings = p.component_settings or []
            pub_count = sum(1 for s in settings if s.get("is_visible", True))
            sub_count = p.subscribers.filter(is_active=True).count()
            maint_count = p.maintenances.filter(
                status__in=[ScheduledMaintenance.Status.SCHEDULED, ScheduledMaintenance.Status.IN_PROGRESS]
            ).count()
            res.append({
                "id": str(p.id),
                "company_name": p.company_name,
                "slug": p.slug,
                "description": p.description,
                "logo_url": p.logo_url,
                "website_url": p.website_url,
                "support_email": p.support_email,
                "is_public": p.is_public,
                "is_default": p.is_default,
                "published_components_count": pub_count,
                "subscribers_count": sub_count,
                "active_maintenances_count": maint_count,
                "announcement_active": p.announcement_active,
                "created_at": p.created_at.isoformat(),
            })
        return res

    @staticmethod
    @transaction.atomic
    def create_status_page(organization_id, data):
        """Create a new status page for an enterprise client or brand."""
        slug = data["slug"].strip().lower()
        if StatusPageConfig.objects.filter(slug=slug).exists():
            raise ValueError(f"El slug '{slug}' ya está en uso. Elige un slug diferente.")

        is_first = not StatusPageConfig.objects.filter(organization_id=organization_id).exists()
        is_default = data.get("is_default", False) or is_first

        if is_default:
            StatusPageConfig.objects.filter(organization_id=organization_id, is_default=True).update(is_default=False)

        component_settings = []
        clone_from_id = data.get("clone_from_page_id")
        if clone_from_id:
            src = StatusPageConfig.objects.filter(organization_id=organization_id, id=clone_from_id).first()
            if src and src.component_settings:
                component_settings = src.component_settings

        page = StatusPageConfig.objects.create(
            organization_id=organization_id,
            company_name=data["company_name"],
            slug=slug,
            description=data.get("description", "Estado de disponibilidad y rendimiento de nuestros servicios en tiempo real."),
            logo_url=data.get("logo_url", ""),
            website_url=data.get("website_url", ""),
            support_email=data.get("support_email", ""),
            is_public=data.get("is_public", True),
            is_default=is_default,
            show_uptime_pct=data.get("show_uptime_pct", True),
            show_latency_24h=data.get("show_latency_24h", True),
            component_settings=component_settings,
        )
        return page

    @staticmethod
    def get_status_page(organization_id, page_id):
        """Get status page by ID."""
        return StatusPageConfig.objects.get(id=page_id, organization_id=organization_id)

    @staticmethod
    @transaction.atomic
    def delete_status_page(organization_id, page_id):
        """Delete a status page. Prevents deleting if only 1 page remains."""
        count = StatusPageConfig.objects.filter(organization_id=organization_id).count()
        if count <= 1:
            raise ValueError("No puedes eliminar la única Status Page de la organización.")

        page = StatusPageConfig.objects.get(id=page_id, organization_id=organization_id)
        was_default = page.is_default
        page.delete()

        if was_default:
            next_page = StatusPageConfig.objects.filter(organization_id=organization_id).first()
            if next_page:
                next_page.is_default = True
                next_page.save(update_fields=["is_default"])

    @staticmethod
    @transaction.atomic
    def set_default_status_page(organization_id, page_id):
        """Mark a status page as the default primary one."""
        StatusPageConfig.objects.filter(organization_id=organization_id, is_default=True).update(is_default=False)
        page = StatusPageConfig.objects.get(id=page_id, organization_id=organization_id)
        page.is_default = True
        page.save(update_fields=["is_default"])
        return page

    @staticmethod
    def get_or_create_config(organization_id, page_id=None):
        """Get or create status page configuration for an organization."""
        if page_id:
            config = StatusPageConfig.objects.filter(organization_id=organization_id, id=page_id).first()
            if config:
                return config

        config = StatusPageConfig.objects.filter(organization_id=organization_id, is_default=True).first()
        if not config:
            config = StatusPageConfig.objects.filter(organization_id=organization_id).first()

        if not config:
            slug = f"status-{str(organization_id)[:8]}"
            config = StatusPageConfig.objects.create(
                organization_id=organization_id,
                company_name="Servicios de la Empresa",
                slug=slug,
                is_public=True,
                is_default=True,
            )
        return config

    @staticmethod
    @transaction.atomic
    def update_config(organization_id, data, page_id=None):
        """Update status page configuration."""
        config = StatusPageService.get_or_create_config(organization_id, page_id=page_id)
        for key, value in data.items():
            if value is not None:
                setattr(config, key, value)
        config.save()
        return config

    @staticmethod
    def get_available_targets(organization_id):
        """Retrieve all potential monitoring targets that can be published on the Status Page."""
        uptime_targets = MonitoringTarget.objects.filter(organization_id=organization_id)
        api_targets = APICheckTarget.objects.filter(organization_id=organization_id)

        items = []
        for t in uptime_targets:
            items.append({
                "id": str(t.id),
                "name": t.name,
                "type": "uptime",
                "target_url": t.endpoint,
                "enabled": t.enabled,
                "current_status": t.last_status,
                "default_category": "Websites & Portales Web",
            })

        for a in api_targets:
            items.append({
                "id": str(a.id),
                "name": a.name,
                "type": "api",
                "target_url": a.url,
                "enabled": a.enabled,
                "current_status": "up" if a.last_status in ["pass", "ok"] else "down",
                "default_category": "APIs & Integraciones Backend",
            })

        return items

    @staticmethod
    def get_admin_stats(organization_id, page_id=None):
        """High-level metrics for the Admin Dashboard."""
        config = StatusPageService.get_or_create_config(organization_id, page_id=page_id)
        available = StatusPageService.get_available_targets(organization_id)
        total_targets = len(available)
        total_pages = StatusPageConfig.objects.filter(organization_id=organization_id).count()

        settings = config.component_settings or []
        if settings:
            published_count = sum(1 for s in settings if s.get("is_visible", True))
        else:
            published_count = sum(1 for a in available if a.get("enabled"))

        maintenances_count = ScheduledMaintenance.objects.filter(
            organization_id=organization_id,
            status__in=[ScheduledMaintenance.Status.SCHEDULED, ScheduledMaintenance.Status.IN_PROGRESS],
        ).filter(Q(status_page=config) | Q(status_page__isnull=True)).count()

        subscribers_count = StatusPageSubscriber.objects.filter(
            organization_id=organization_id,
            status_page=config,
            is_active=True,
        ).count()

        # Check projected status
        has_outage = any(a["current_status"] == "down" for a in available if a.get("enabled"))
        projected_status = "outage" if has_outage else "operational"

        return {
            "total_components": total_targets,
            "published_components": published_count,
            "scheduled_maintenances": maintenances_count,
            "active_subscribers": subscribers_count,
            "total_pages": total_pages,
            "projected_status": projected_status,
            "is_public": config.is_public,
            "is_default": config.is_default,
            "slug": config.slug,
            "company_name": config.company_name,
            "page_id": str(config.id),
        }

    @staticmethod
    def get_public_status_data(slug):
        """Calculates 90-day uptime bars, 24h latency, active incidents, announcements, and maintenances."""
        config = StatusPageConfig.objects.filter(slug=slug).first()
        if not config:
            raise ValueError("Status Page no encontrada.")

        if not config.is_public:
            raise PermissionError("Esta Status Page es privada.")

        org_id = config.organization_id
        now = timezone.now()
        start_90_days_ago = now - timedelta(days=90)
        start_24h_ago = now - timedelta(hours=24)
        date_list = [(now.date() - timedelta(days=i)) for i in range(89, -1, -1)]

        # Determine configured components
        settings_map = {}
        if config.component_settings:
            for cs in config.component_settings:
                settings_map[str(cs.get("id"))] = cs

        # Fetch targets
        targets = MonitoringTarget.objects.filter(organization_id=org_id, enabled=True)
        api_targets = APICheckTarget.objects.filter(organization_id=org_id, enabled=True)

        services_data = []
        overall_outage = False

        # Process Uptime Targets
        for target in targets:
            tid_str = str(target.id)
            c_setting = settings_map.get(tid_str)

            # If user specified component settings, check visibility
            if settings_map and (not c_setting or not c_setting.get("is_visible", True)):
                continue

            display_name = c_setting.get("display_name") if c_setting and c_setting.get("display_name") else target.name
            category = c_setting.get("category") if c_setting and c_setting.get("category") else "Websites & Portales Web"

            # 90-day checks
            checks = MonitoringCheck.objects.filter(
                target=target,
                checked_at__gte=start_90_days_ago,
            ).values("checked_at", "status", "latency")

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
                    st = "up" if day_uptime >= 99 else "degraded" if day_uptime >= 80 else "down"
                    total_up += stats["up"]
                    total_checks += stats["total"]
                    day_checks_count = stats["total"]
                else:
                    day_uptime = 100.0
                    st = "up"
                    day_checks_count = 0

                day_blocks.append({
                    "date": d.strftime("%Y-%m-%d"),
                    "status": st,
                    "uptime_pct": round(day_uptime, 2),
                    "total_checks": day_checks_count,
                })

            service_status = "up" if target.last_status == "up" else "down"
            if service_status == "down":
                overall_outage = True

            overall_uptime_pct = round((total_up / total_checks * 100), 2) if total_checks > 0 else 100.0

            # 24h Average Latency
            latency_24h_res = MonitoringCheck.objects.filter(
                target=target,
                checked_at__gte=start_24h_ago,
                latency__gt=0,
            ).aggregate(avg_lat=Avg("latency"))
            avg_latency_ms = round(latency_24h_res["avg_lat"] or 0, 1)

            services_data.append({
                "id": tid_str,
                "name": display_name,
                "type": "uptime",
                "category": category,
                "current_status": service_status,
                "uptime_90_days_pct": overall_uptime_pct,
                "avg_latency_24h_ms": avg_latency_ms,
                "history_90_days": day_blocks,
            })

        # Process API Targets
        for api_t in api_targets:
            aid_str = str(api_t.id)
            c_setting = settings_map.get(aid_str)

            if settings_map and (not c_setting or not c_setting.get("is_visible", True)):
                continue

            display_name = c_setting.get("display_name") if c_setting and c_setting.get("display_name") else api_t.name
            category = c_setting.get("category") if c_setting and c_setting.get("category") else "APIs & Integraciones Backend"

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
                    st = "up" if day_uptime >= 99 else "degraded" if day_uptime >= 80 else "down"
                    total_pass += stats["pass"]
                    total_checks += stats["total"]
                    day_checks_count = stats["total"]
                else:
                    day_uptime = 100.0
                    st = "up"
                    day_checks_count = 0

                day_blocks.append({
                    "date": d.strftime("%Y-%m-%d"),
                    "status": st,
                    "uptime_pct": round(day_uptime, 2),
                    "total_checks": day_checks_count,
                })

            api_status = "up" if api_t.last_status in ["pass", "ok"] else "down"
            if api_status == "down":
                overall_outage = True

            overall_uptime_pct = round((total_pass / total_checks * 100), 2) if total_checks > 0 else 100.0

            # 24h Average Latency for API
            api_latency_res = APICheckResult.objects.filter(
                target=api_t,
                checked_at__gte=start_24h_ago,
                response_time_ms__gt=0,
            ).aggregate(avg_lat=Avg("response_time_ms"))
            avg_latency_ms = round(api_latency_res["avg_lat"] or 0, 1)

            services_data.append({
                "id": aid_str,
                "name": display_name,
                "type": "api",
                "category": category,
                "current_status": api_status,
                "uptime_90_days_pct": overall_uptime_pct,
                "avg_latency_24h_ms": avg_latency_ms,
                "history_90_days": day_blocks,
            })

        # Collect IDs and display names of published components for this page
        published_target_ids = {str(s["id"]) for s in services_data}
        published_names = {s["name"].strip().lower() for s in services_data if s.get("name")}

        # Active Incidents matching this status page's components
        active_incidents_qs = Incident.objects.filter(
            organization_id=org_id,
            status__in=[
                Incident.Status.OPEN,
                Incident.Status.INVESTIGATING,
                Incident.Status.IDENTIFIED,
                Incident.Status.MITIGATED,
            ],
        ).order_by("-opened_at")

        if published_target_ids:
            active_incidents = [
                inc for inc in active_incidents_qs
                if (inc.target_id and str(inc.target_id) in published_target_ids)
                or (inc.impacted_service and inc.impacted_service.strip().lower() in published_names)
            ]
        else:
            active_incidents = list(active_incidents_qs)

        incidents_data = [
            {
                "id": str(inc.id),
                "title": inc.title,
                "description": inc.description,
                "priority": inc.priority,
                "status": inc.status,
                "impacted_service": inc.impacted_service,
                "opened_at": inc.opened_at.isoformat(),
            }
            for inc in active_incidents
        ]

        # Past Resolved Incidents (Last 30 Days)
        past_incidents_qs = Incident.objects.filter(
            organization_id=org_id,
            status__in=[Incident.Status.RESOLVED, Incident.Status.CLOSED],
            opened_at__gte=now - timedelta(days=30),
        ).order_by("-opened_at")

        if published_target_ids:
            past_incidents = [
                inc for inc in past_incidents_qs
                if (inc.target_id and str(inc.target_id) in published_target_ids)
                or (inc.impacted_service and inc.impacted_service.strip().lower() in published_names)
            ][:5]
        else:
            past_incidents = list(past_incidents_qs[:5])

        past_incidents_data = [
            {
                "id": str(inc.id),
                "title": inc.title,
                "description": inc.description,
                "priority": inc.priority,
                "status": inc.status,
                "impacted_service": inc.impacted_service,
                "opened_at": inc.opened_at.isoformat(),
                "closed_at": inc.closed_at.isoformat() if inc.closed_at else None,
            }
            for inc in past_incidents
        ]

        # Scheduled Maintenances with nested Updates (Scoped to this page or global)
        maintenances = ScheduledMaintenance.objects.filter(
            organization_id=org_id,
            status__in=[ScheduledMaintenance.Status.SCHEDULED, ScheduledMaintenance.Status.IN_PROGRESS],
        ).filter(
            Q(status_page=config) | Q(status_page__isnull=True)
        ).prefetch_related("updates").order_by("start_time")

        maintenances_data = []
        for m in maintenances:
            updates = [
                {
                    "id": str(u.id),
                    "message": u.message,
                    "status": u.status,
                    "posted_at": u.posted_at.isoformat(),
                }
                for u in m.updates.all()
            ]
            maintenances_data.append({
                "id": str(m.id),
                "title": m.title,
                "description": m.description,
                "status": m.status,
                "start_time": m.start_time.isoformat(),
                "end_time": m.end_time.isoformat(),
                "updates": updates,
            })

        # Global Status Summary & High-Level KPIs
        total_services_count = len(services_data)
        operational_services_count = sum(1 for s in services_data if s["current_status"] == "up")
        avg_uptime = (
            round(sum(s["uptime_90_days_pct"] for s in services_data) / total_services_count, 2)
            if total_services_count > 0
            else 100.0
        )

        # Global average latency across all services
        latencies = [s["avg_latency_24h_ms"] for s in services_data if s["avg_latency_24h_ms"] > 0]
        global_avg_latency_ms = round(sum(latencies) / len(latencies), 1) if latencies else 0

        if overall_outage:
            system_status = "outage"
            system_status_label = "Interrupción importante de servicio"
        elif len(active_incidents) > 0 or any(m.status == "in_progress" for m in maintenances):
            system_status = "degraded"
            system_status_label = "Degradación parcial de servicio"
        else:
            system_status = "operational"
            system_status_label = "Todos los sistemas operacionales"

        return {
            "company_name": config.company_name,
            "description": config.description,
            "logo_url": config.logo_url,
            "website_url": config.website_url,
            "support_email": config.support_email,
            "system_status": system_status,
            "system_status_label": system_status_label,
            "global_uptime_pct": avg_uptime,
            "global_avg_latency_ms": global_avg_latency_ms,
            "total_services_count": total_services_count,
            "operational_services_count": operational_services_count,
            "services": services_data,
            "active_incidents": incidents_data,
            "past_incidents": past_incidents_data,
            "maintenances": maintenances_data,
            # Broadcast announcement
            "custom_announcement": config.custom_announcement,
            "announcement_type": config.announcement_type,
            "announcement_active": config.announcement_active,
            # Visibility flags
            "show_uptime_pct": config.show_uptime_pct,
            "show_latency_24h": config.show_latency_24h,
            "updated_at": now.isoformat(),
        }

    # Maintenance CRUD & Updates
    @staticmethod
    def list_maintenances(organization_id, page_id=None):
        qs = ScheduledMaintenance.objects.filter(organization_id=organization_id).prefetch_related("updates")
        if page_id:
            qs = qs.filter(Q(status_page_id=page_id) | Q(status_page__isnull=True))
        return qs.order_by("-start_time")

    @staticmethod
    @transaction.atomic
    def create_maintenance(organization_id, data):
        m = ScheduledMaintenance.objects.create(
            organization_id=organization_id,
            status_page_id=data.get("status_page_id"),
            title=data["title"],
            description=data.get("description", ""),
            status=data.get("status", ScheduledMaintenance.Status.SCHEDULED),
            start_time=data["start_time"],
            end_time=data["end_time"],
        )
        initial_msg = data.get("initial_update") or "Mantenimiento planificado registrado en la plataforma."
        MaintenanceUpdate.objects.create(
            maintenance=m,
            message=initial_msg,
            status=m.status,
        )
        return m

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

    @staticmethod
    @transaction.atomic
    def add_maintenance_update(maintenance_id, organization_id, message, update_status=None):
        """Add a progress note to an ongoing or planned maintenance."""
        m = ScheduledMaintenance.objects.get(id=maintenance_id, organization_id=organization_id)
        if update_status and update_status in ScheduledMaintenance.Status.values:
            m.status = update_status
            m.save(update_fields=["status"])

        update = MaintenanceUpdate.objects.create(
            maintenance=m,
            message=message,
            status=m.status,
        )
        return update

    @staticmethod
    @transaction.atomic
    def bulk_action_maintenances(organization_id, action, maintenance_ids):
        """Bulk update or delete maintenance windows."""
        qs = ScheduledMaintenance.objects.filter(organization_id=organization_id, id__in=maintenance_ids)
        if action == "delete":
            count = qs.count()
            qs.delete()
            return {"deleted": count, "message": f"{count} mantenimientos eliminados."}
        elif action in ["completed", "in_progress", "scheduled", "cancelled"]:
            count = qs.update(status=action)
            return {"updated": count, "message": f"{count} mantenimientos marcados como {action}."}
        else:
            raise ValueError(f"Acción '{action}' no válida.")

    # Subscribers
    @staticmethod
    @transaction.atomic
    def subscribe_email(slug, email):
        """Publicly subscribe an email address to status updates."""
        config = StatusPageConfig.objects.filter(slug=slug).first()
        if not config:
            raise ValueError("Status Page no encontrada.")

        sub, created = StatusPageSubscriber.objects.get_or_create(
            organization_id=config.organization_id,
            status_page=config,
            email=email.strip().lower(),
            defaults={"is_active": True},
        )
        if not created and not sub.is_active:
            sub.is_active = True
            sub.save(update_fields=["is_active"])

        return sub

    @staticmethod
    @transaction.atomic
    def unsubscribe_email(slug, email):
        """Unsubscribe an email address."""
        config = StatusPageConfig.objects.filter(slug=slug).first()
        if not config:
            raise ValueError("Status Page no encontrada.")

        StatusPageSubscriber.objects.filter(
            status_page=config,
            email=email.strip().lower(),
        ).update(is_active=False)

    @staticmethod
    def list_subscribers(organization_id, page_id=None):
        """List all active subscribers for an organization or specific page."""
        qs = StatusPageSubscriber.objects.filter(
            organization_id=organization_id,
            is_active=True,
        )
        if page_id:
            qs = qs.filter(status_page_id=page_id)
        return qs.order_by("-created_at")

    @staticmethod
    def remove_subscriber(organization_id, subscriber_id):
        """Remove a subscriber from admin panel."""
        sub = StatusPageSubscriber.objects.get(id=subscriber_id, organization_id=organization_id)
        sub.delete()
