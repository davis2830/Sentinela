import logging
from datetime import timedelta
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from audit.models import AuditLog
from .models import (
    MaintenanceWindow,
    MaintenanceWindowTarget,
    MaintenanceWindowUpdate,
)

logger = logging.getLogger(__name__)


class MaintenanceWindowService:
    """Service for managing operational maintenance windows, target suppressions, and SLA telemetry."""

    @staticmethod
    def list_windows(organization_id, status_filter=None, team_id=None, search=None):
        """List maintenance windows for an organization with optional filters."""
        qs = (
            MaintenanceWindow.objects.filter(organization_id=organization_id)
            .select_related("responsible_team", "responsible_user", "created_by", "status_page")
            .prefetch_related("targets", "updates")
        )

        if status_filter:
            qs = qs.filter(status=status_filter)

        if team_id:
            qs = qs.filter(responsible_team_id=team_id)

        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(targets__target_name__icontains=search)
            ).distinct()

        return qs.order_by("-start_time")

    @staticmethod
    def get_window(window_id, organization_id):
        """Get a single maintenance window by ID."""
        return (
            MaintenanceWindow.objects.select_related(
                "responsible_team", "responsible_user", "created_by", "status_page"
            )
            .prefetch_related("targets", "updates")
            .get(id=window_id, organization_id=organization_id)
        )

    @staticmethod
    def _sync_to_status_page(window, message=None):
        """Synchronize operational maintenance window with public ScheduledMaintenance on Status Page."""
        try:
            from status_page.models import ScheduledMaintenance, StatusPageConfig, MaintenanceUpdate

            if window.publish_to_status_page:
                target_page = window.status_page
                if not target_page:
                    target_page = (
                        StatusPageConfig.objects.filter(
                            organization_id=window.organization_id, is_default=True
                        ).first()
                        or StatusPageConfig.objects.filter(organization_id=window.organization_id).first()
                    )
                    if target_page and not window.status_page:
                        window.status_page = target_page
                        window.save(update_fields=["status_page"])

                if not target_page:
                    return

                status_val = window.status
                if status_val not in ScheduledMaintenance.Status.values:
                    status_val = ScheduledMaintenance.Status.SCHEDULED

                if window.status_page_maintenance:
                    sm = window.status_page_maintenance
                    sm.title = window.title
                    sm.description = window.description
                    sm.status = status_val
                    sm.start_time = window.start_time
                    sm.end_time = window.end_time
                    sm.status_page = target_page
                    sm.save()
                else:
                    sm = ScheduledMaintenance.objects.create(
                        organization_id=window.organization_id,
                        status_page=target_page,
                        title=window.title,
                        description=window.description,
                        status=status_val,
                        start_time=window.start_time,
                        end_time=window.end_time,
                    )
                    window.status_page_maintenance = sm
                    window.save(update_fields=["status_page_maintenance"])

                if message:
                    MaintenanceUpdate.objects.create(
                        maintenance=sm,
                        message=message,
                        status=status_val,
                    )
            else:
                if window.status_page_maintenance:
                    sm = window.status_page_maintenance
                    window.status_page_maintenance = None
                    window.save(update_fields=["status_page_maintenance"])
                    sm.delete()
        except Exception as e:
            logger.error(f"Error synchronizing maintenance {window.id} to status page: {e}")

    @staticmethod
    @transaction.atomic
    def create_window(organization_id, data, user=None):
        """Create a new maintenance window with associated targets and audit entry."""
        targets_data = data.pop("targets", [])

        window = MaintenanceWindow.objects.create(
            organization_id=organization_id,
            created_by=user if user and user.is_authenticated else None,
            **data,
        )

        # Create targets
        for t in targets_data:
            MaintenanceWindowTarget.objects.create(
                maintenance_window=window,
                target_type=t.get("target_type", MaintenanceWindowTarget.TargetType.MONITORING),
                target_id=t.get("target_id"),
                target_name=t.get("target_name", ""),
            )

        # Create initial update
        user_name = (user.get_full_name() if user else None) or getattr(user, "email", "Sistema")
        MaintenanceWindowUpdate.objects.create(
            maintenance_window=window,
            message="Ventana de mantenimiento programada en el sistema.",
            status=window.status,
            actor_name=user_name,
        )

        # Synchronize with Status Page if requested
        MaintenanceWindowService._sync_to_status_page(
            window, message="Mantenimiento programado en la plataforma."
        )

        # Audit
        AuditLog.objects.create(
            organization_id=organization_id,
            user_id=user.id if user and user.is_authenticated else None,
            user_email=user.email if user and user.is_authenticated else "",
            action=AuditLog.Action.CREATE,
            module="maintenance",
            result=AuditLog.Result.SUCCESS,
            description=f"Ventana de mantenimiento programada: '{window.title}'",
            metadata={
                "maintenance_id": str(window.id),
                "title": window.title,
                "start_time": str(window.start_time),
                "end_time": str(window.end_time),
                "targets_count": len(targets_data),
                "published_to_status_page": window.publish_to_status_page,
            },
        )

        return window

    @staticmethod
    @transaction.atomic
    def update_window(window_id, organization_id, data, user=None):
        """Update an existing maintenance window and optionally refresh targets."""
        window = MaintenanceWindow.objects.get(id=window_id, organization_id=organization_id)

        targets_data = data.pop("targets", None)

        for field, val in data.items():
            setattr(window, field, val)
        window.save()

        if targets_data is not None:
            # Recreate targets
            window.targets.all().delete()
            for t in targets_data:
                MaintenanceWindowTarget.objects.create(
                    maintenance_window=window,
                    target_type=t.get("target_type", MaintenanceWindowTarget.TargetType.MONITORING),
                    target_id=t.get("target_id"),
                    target_name=t.get("target_name", ""),
                )

        # Synchronize with Status Page
        MaintenanceWindowService._sync_to_status_page(window)

        # Audit
        AuditLog.objects.create(
            organization_id=organization_id,
            user_id=user.id if user and user.is_authenticated else None,
            user_email=user.email if user and user.is_authenticated else "",
            action=AuditLog.Action.UPDATE,
            module="maintenance",
            result=AuditLog.Result.SUCCESS,
            description=f"Ventana de mantenimiento actualizada: '{window.title}'",
            metadata={"maintenance_id": str(window.id), "title": window.title},
        )

        return window

    @staticmethod
    @transaction.atomic
    def delete_window(window_id, organization_id, user=None):
        """Delete a maintenance window."""
        window = MaintenanceWindow.objects.get(id=window_id, organization_id=organization_id)
        title = window.title
        if window.status_page_maintenance:
            try:
                window.status_page_maintenance.delete()
            except Exception:
                pass
        window.delete()

        AuditLog.objects.create(
            organization_id=organization_id,
            user_id=user.id if user and user.is_authenticated else None,
            user_email=user.email if user and user.is_authenticated else "",
            action=AuditLog.Action.DELETE,
            module="maintenance",
            result=AuditLog.Result.SUCCESS,
            description=f"Ventana de mantenimiento eliminada: '{title}'",
            metadata={"maintenance_id": str(window_id), "title": title},
        )

    @staticmethod
    @transaction.atomic
    def start_window(window_id, organization_id, user=None):
        """Transition maintenance window immediately to in_progress."""
        window = MaintenanceWindow.objects.get(id=window_id, organization_id=organization_id)
        window.status = MaintenanceWindow.Status.IN_PROGRESS
        window.save(update_fields=["status"])

        user_name = (user.get_full_name() if user else None) or getattr(user, "email", "Operador")
        MaintenanceWindowUpdate.objects.create(
            maintenance_window=window,
            message="Mantenimiento iniciado manualmente por el operador.",
            status=window.status,
            actor_name=user_name,
        )

        MaintenanceWindowService._sync_to_status_page(
            window, message="Mantenimiento iniciado manualmente por el operador."
        )

        AuditLog.objects.create(
            organization_id=organization_id,
            user_id=user.id if user and user.is_authenticated else None,
            user_email=user.email if user and user.is_authenticated else "",
            action=AuditLog.Action.UPDATE,
            module="maintenance",
            result=AuditLog.Result.SUCCESS,
            description=f"Mantenimiento iniciado: '{window.title}'",
            metadata={"maintenance_id": str(window.id), "status": window.status},
        )

        return window

    @staticmethod
    @transaction.atomic
    def complete_window(window_id, organization_id, user=None):
        """Mark maintenance window as completed."""
        window = MaintenanceWindow.objects.get(id=window_id, organization_id=organization_id)
        window.status = MaintenanceWindow.Status.COMPLETED
        window.save(update_fields=["status"])

        user_name = (user.get_full_name() if user else None) or getattr(user, "email", "Operador")
        MaintenanceWindowUpdate.objects.create(
            maintenance_window=window,
            message="Mantenimiento concluido exitosamente. Servicios restablecidos.",
            status=window.status,
            actor_name=user_name,
        )

        MaintenanceWindowService._sync_to_status_page(
            window, message="Mantenimiento concluido exitosamente. Servicios restablecidos."
        )

        AuditLog.objects.create(
            organization_id=organization_id,
            user_id=user.id if user and user.is_authenticated else None,
            user_email=user.email if user and user.is_authenticated else "",
            action=AuditLog.Action.UPDATE,
            module="maintenance",
            result=AuditLog.Result.SUCCESS,
            description=f"Mantenimiento completado: '{window.title}'",
            metadata={"maintenance_id": str(window.id), "status": window.status},
        )

        return window

    @staticmethod
    @transaction.atomic
    def cancel_window(window_id, organization_id, user=None):
        """Mark maintenance window as cancelled."""
        window = MaintenanceWindow.objects.get(id=window_id, organization_id=organization_id)
        window.status = MaintenanceWindow.Status.CANCELLED
        window.save(update_fields=["status"])

        user_name = (user.get_full_name() if user else None) or getattr(user, "email", "Operador")
        MaintenanceWindowUpdate.objects.create(
            maintenance_window=window,
            message="Ventana de mantenimiento cancelada.",
            status=window.status,
            actor_name=user_name,
        )

        MaintenanceWindowService._sync_to_status_page(
            window, message="Ventana de mantenimiento cancelada."
        )

        AuditLog.objects.create(
            organization_id=organization_id,
            user_id=user.id if user and user.is_authenticated else None,
            user_email=user.email if user and user.is_authenticated else "",
            action=AuditLog.Action.UPDATE,
            module="maintenance",
            result=AuditLog.Result.SUCCESS,
            description=f"Mantenimiento cancelado: '{window.title}'",
            metadata={"maintenance_id": str(window.id), "status": window.status},
        )

        return window

    @staticmethod
    @transaction.atomic
    def add_update(window_id, organization_id, message, status=None, user=None):
        """Add a progress note / milestone to a maintenance window."""
        window = MaintenanceWindow.objects.get(id=window_id, organization_id=organization_id)

        if status and status != window.status:
            window.status = status
            window.save(update_fields=["status"])

        user_name = (user.get_full_name() if user else None) or getattr(user, "email", "Operador")
        update = MaintenanceWindowUpdate.objects.create(
            maintenance_window=window,
            message=message,
            status=window.status,
            actor_name=user_name,
        )

        # Mirror note to public status page if published
        if window.publish_to_status_page and window.status_page_maintenance:
            try:
                from status_page.models import MaintenanceUpdate as PublicUpdate
                PublicUpdate.objects.create(
                    maintenance=window.status_page_maintenance,
                    message=message,
                    status=window.status,
                )
            except Exception as e:
                logger.error(f"Error mirroring update to status page: {e}")

        return update

    @staticmethod
    @transaction.atomic
    def bulk_action(organization_id, maintenance_ids, action, user=None):
        """Execute atomic bulk action across multiple maintenance windows."""
        windows = MaintenanceWindow.objects.filter(
            id__in=maintenance_ids, organization_id=organization_id
        )

        count = windows.count()
        user_name = (user.get_full_name() if user else None) or getattr(user, "email", "Operador")

        if action == "start":
            for w in windows:
                w.status = MaintenanceWindow.Status.IN_PROGRESS
                w.save(update_fields=["status"])
                MaintenanceWindowUpdate.objects.create(
                    maintenance_window=w,
                    message="Mantenimiento iniciado en lote.",
                    status=w.status,
                    actor_name=user_name,
                )
        elif action == "complete":
            for w in windows:
                w.status = MaintenanceWindow.Status.COMPLETED
                w.save(update_fields=["status"])
                MaintenanceWindowUpdate.objects.create(
                    maintenance_window=w,
                    message="Mantenimiento completado en lote.",
                    status=w.status,
                    actor_name=user_name,
                )
        elif action == "cancel":
            for w in windows:
                w.status = MaintenanceWindow.Status.CANCELLED
                w.save(update_fields=["status"])
                MaintenanceWindowUpdate.objects.create(
                    maintenance_window=w,
                    message="Mantenimiento cancelado en lote.",
                    status=w.status,
                    actor_name=user_name,
                )
        elif action == "delete":
            windows.delete()

        AuditLog.objects.create(
            organization_id=organization_id,
            user_id=user.id if user and user.is_authenticated else None,
            user_email=user.email if user and user.is_authenticated else "",
            action=AuditLog.Action.UPDATE if action != "delete" else AuditLog.Action.DELETE,
            module="maintenance",
            result=AuditLog.Result.SUCCESS,
            description=f"Acción en lote '{action}' ejecutada sobre {count} mantenimientos",
            metadata={"action": action, "affected_count": count},
        )

        return {"count": count, "action": action}

    @staticmethod
    def is_target_in_maintenance(organization_id, target_type, target_id, at_time=None) -> bool:
        """Check if a given infrastructure target is currently under an active maintenance window.

        Evaluates status, datetime window, recurrence rules, and target mapping.
        """
        now = at_time or timezone.now()

        # Fetch candidate windows: in_progress or scheduled
        candidates = MaintenanceWindow.objects.filter(
            organization_id=organization_id,
            status__in=[MaintenanceWindow.Status.IN_PROGRESS, MaintenanceWindow.Status.SCHEDULED],
        ).prefetch_related("targets")

        for window in candidates:
            if not window.is_currently_active(now):
                continue

            # Check if this window covers this target
            targets = window.targets.all()
            if not targets.exists():
                # If window has no specific targets, it acts as global or check if ALL is specified
                continue

            for t in targets:
                if t.target_type == MaintenanceWindowTarget.TargetType.ALL:
                    return True
                if t.target_type == target_type:
                    # If target_id is specified on target rule, match it; otherwise all targets of that type
                    if not t.target_id or (target_id and str(t.target_id) == str(target_id)):
                        return True

        return False

    @staticmethod
    def get_stats(organization_id):
        """Calculate NOC summary stats for maintenance windows."""
        now = timezone.now()
        thirty_days_ahead = now + timedelta(days=7)
        first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        windows = MaintenanceWindow.objects.filter(organization_id=organization_id)

        # 1. In progress
        active_in_progress = 0
        active_targets_set = set()

        for w in windows:
            if w.is_currently_active(now):
                active_in_progress += 1
                for t in w.targets.all():
                    active_targets_set.add(f"{t.target_type}:{t.target_id or 'all'}")

        # 2. Upcoming next 7 days
        upcoming_7d = windows.filter(
            status=MaintenanceWindow.Status.SCHEDULED,
            start_time__gte=now,
            start_time__lte=thirty_days_ahead,
        ).count()

        # 3. Scheduled hours in current month
        month_windows = windows.filter(start_time__gte=first_of_month)
        total_minutes = sum(w.duration_minutes for w in month_windows)
        total_hours = round(total_minutes / 60, 1)

        return {
            "active_in_progress": active_in_progress,
            "upcoming_7d": upcoming_7d,
            "targets_in_maintenance": len(active_targets_set),
            "scheduled_hours_month": total_hours,
        }
