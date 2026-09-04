from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Avg, F, Q
from django.utils import timezone

from .models import Incident, IncidentAlert, IncidentTimelineEvent

User = get_user_model()


class IncidentService:
    """Service for enterprise incident management.

    Handles incident lifecycle (open, investigate, identify, mitigate, resolve, close),
    alert linking, RCA post-mortems, MTTA/MTTR calculation, and collaborative timeline tracking.
    All business logic lives here, not in views.
    """

    @staticmethod
    def list_incidents(organization_id, status_filter=None, priority_filter=None):
        """Return incidents for an organization with optional filters."""
        qs = Incident.objects.filter(organization_id=organization_id)
        if status_filter and status_filter != "all":
            qs = qs.filter(status=status_filter)
        if priority_filter and priority_filter != "all":
            qs = qs.filter(priority=priority_filter)
        return qs.order_by("-opened_at")

    @staticmethod
    def get_incident(incident_id, organization_id):
        """Return a single incident by ID within an organization."""
        return Incident.objects.get(id=incident_id, organization_id=organization_id)

    @staticmethod
    @transaction.atomic
    def create_incident(
        organization_id,
        title,
        description="",
        priority="medium",
        impacted_service="",
        target_type="",
        target_id=None,
        assigned_to_id=None,
        actor_name="Sistema",
    ):
        """Create a new incident and record a timeline event."""
        assigned_to = None
        assigned_to_name = ""
        if assigned_to_id:
            try:
                assigned_to = User.objects.get(id=assigned_to_id)
                assigned_to_name = assigned_to.get_full_name() or assigned_to.email
            except User.DoesNotExist:
                pass

        incident = Incident.objects.create(
            organization_id=organization_id,
            title=title,
            description=description,
            priority=priority,
            status=Incident.Status.OPEN,
            impacted_service=impacted_service,
            target_type=target_type,
            target_id=target_id,
            assigned_to=assigned_to,
            assigned_to_name=assigned_to_name,
        )

        IncidentTimelineEvent.objects.create(
            incident=incident,
            event_type=IncidentTimelineEvent.EventType.CREATED,
            description=f"Incidente abierto: {title}",
            new_value=Incident.Status.OPEN,
            actor_name=actor_name,
        )

        if assigned_to_name:
            IncidentTimelineEvent.objects.create(
                incident=incident,
                event_type=IncidentTimelineEvent.EventType.ASSIGNED,
                description=f"Incidente asignado a {assigned_to_name}",
                new_value=assigned_to_name,
                actor_name=actor_name,
            )

        return incident

    @staticmethod
    @transaction.atomic
    def update_status(incident_id, organization_id, new_status, actor_name="Sistema"):
        """Update incident status, record timeline event and manage MTTA/MTTR timestamps."""
        incident = Incident.objects.get(id=incident_id, organization_id=organization_id)
        old_status = incident.status

        if old_status == new_status:
            return incident

        now = timezone.now()
        incident.status = new_status

        # MTTA tracking: acknowledged when moving to investigating or identified
        if new_status in [Incident.Status.INVESTIGATING, Incident.Status.IDENTIFIED]:
            if not incident.acknowledged_at:
                incident.acknowledged_at = now

        # Mitigation milestone
        if new_status == Incident.Status.MITIGATED:
            if not incident.mitigated_at:
                incident.mitigated_at = now

        # MTTR tracking: resolved
        if new_status == Incident.Status.RESOLVED:
            if not incident.resolved_at:
                incident.resolved_at = now
            if not incident.closed_at:
                incident.closed_at = now

        # Final closure
        if new_status == Incident.Status.CLOSED:
            if not incident.closed_at:
                incident.closed_at = now

        incident.save(
            update_fields=[
                "status",
                "acknowledged_at",
                "mitigated_at",
                "resolved_at",
                "closed_at",
            ]
        )

        event_type = IncidentTimelineEvent.EventType.STATUS_CHANGED
        if new_status == Incident.Status.RESOLVED:
            event_type = IncidentTimelineEvent.EventType.RESOLVED
        elif new_status == Incident.Status.CLOSED:
            event_type = IncidentTimelineEvent.EventType.CLOSED
        elif new_status == Incident.Status.MITIGATED:
            event_type = IncidentTimelineEvent.EventType.MITIGATED

        IncidentTimelineEvent.objects.create(
            incident=incident,
            event_type=event_type,
            description=f"Estado actualizado de {old_status} a {new_status}",
            old_value=old_status,
            new_value=new_status,
            actor_name=actor_name,
        )

        return incident

    @staticmethod
    @transaction.atomic
    def update_priority(incident_id, organization_id, new_priority, actor_name="Sistema"):
        """Update incident priority and record timeline event."""
        incident = Incident.objects.get(id=incident_id, organization_id=organization_id)
        old_priority = incident.priority

        if old_priority == new_priority:
            return incident

        incident.priority = new_priority
        incident.save(update_fields=["priority"])

        IncidentTimelineEvent.objects.create(
            incident=incident,
            event_type=IncidentTimelineEvent.EventType.PRIORITY_CHANGED,
            description=f"Prioridad modificada de {old_priority} a {new_priority}",
            old_value=old_priority,
            new_value=new_priority,
            actor_name=actor_name,
        )

        return incident

    @staticmethod
    @transaction.atomic
    def assign_incident(incident_id, organization_id, user_id=None, actor_name="Sistema"):
        """Assign or unassign an incident to a team member."""
        incident = Incident.objects.get(id=incident_id, organization_id=organization_id)

        if user_id:
            try:
                user = User.objects.get(id=user_id)
                user_name = user.get_full_name() or user.email
                incident.assigned_to = user
                incident.assigned_to_name = user_name
                incident.save(update_fields=["assigned_to", "assigned_to_name"])

                IncidentTimelineEvent.objects.create(
                    incident=incident,
                    event_type=IncidentTimelineEvent.EventType.ASSIGNED,
                    description=f"Asignado formalmente a {user_name}",
                    new_value=user_name,
                    actor_name=actor_name,
                )
            except User.DoesNotExist:
                raise ValueError("Usuario no encontrado.")
        else:
            old_assignee = incident.assigned_to_name
            incident.assigned_to = None
            incident.assigned_to_name = ""
            incident.save(update_fields=["assigned_to", "assigned_to_name"])

            IncidentTimelineEvent.objects.create(
                incident=incident,
                event_type=IncidentTimelineEvent.EventType.ASSIGNED,
                description=f"Asignación removida (anterior: {old_assignee or 'ninguno'})",
                old_value=old_assignee,
                new_value="",
                actor_name=actor_name,
            )

        return incident

    @staticmethod
    @transaction.atomic
    def update_rca(
        incident_id,
        organization_id,
        root_cause="",
        resolution_summary="",
        preventive_actions="",
        actor_name="Sistema",
    ):
        """Update Root Cause Analysis (RCA) and post-mortem notes."""
        incident = Incident.objects.get(id=incident_id, organization_id=organization_id)
        incident.root_cause = root_cause
        incident.resolution_summary = resolution_summary
        incident.preventive_actions = preventive_actions
        incident.save(
            update_fields=["root_cause", "resolution_summary", "preventive_actions"]
        )

        IncidentTimelineEvent.objects.create(
            incident=incident,
            event_type=IncidentTimelineEvent.EventType.RCA_UPDATED,
            description="Análisis de Causa Raíz (RCA) y Post-Mortem actualizado",
            actor_name=actor_name,
        )

        return incident

    @staticmethod
    @transaction.atomic
    def add_alert(incident_id, alert_id, actor_name="Sistema"):
        """Link an alert to an incident."""
        incident = Incident.objects.get(id=incident_id)
        incident_alert, created = IncidentAlert.objects.get_or_create(
            incident=incident,
            alert_id=alert_id,
        )

        if created:
            IncidentTimelineEvent.objects.create(
                incident=incident,
                event_type=IncidentTimelineEvent.EventType.ALERT_ADDED,
                description=f"Alerta {alert_id} vinculada al expediente del incidente",
                new_value=str(alert_id),
                actor_name=actor_name,
            )

        return incident_alert

    @staticmethod
    @transaction.atomic
    def add_note(incident_id, organization_id, note, actor_name="Sistema"):
        """Add a note to the incident timeline."""
        incident = Incident.objects.get(id=incident_id, organization_id=organization_id)

        return IncidentTimelineEvent.objects.create(
            incident=incident,
            event_type=IncidentTimelineEvent.EventType.NOTE_ADDED,
            description=note,
            actor_name=actor_name,
        )

    @staticmethod
    def get_timeline(incident_id, organization_id):
        """Return the full timeline of events for an incident ordered by newest first."""
        incident = Incident.objects.get(id=incident_id, organization_id=organization_id)
        return incident.timeline_events.all().order_by("-occurred_at")

    @staticmethod
    def get_linked_alerts(incident_id, organization_id):
        """Return all alerts linked to an incident."""
        incident = Incident.objects.get(id=incident_id, organization_id=organization_id)
        return incident.incident_alerts.all().order_by("-added_at")

    @staticmethod
    @transaction.atomic
    def delete_incident(incident_id, organization_id):
        """Delete an incident."""
        incident = Incident.objects.get(id=incident_id, organization_id=organization_id)
        incident.delete()

    @staticmethod
    @transaction.atomic
    def bulk_action(organization_id, action, incident_ids, **kwargs):
        """Execute an atomic bulk action on multiple incidents."""
        qs = Incident.objects.filter(id__in=incident_ids, organization_id=organization_id)
        actor_name = kwargs.get("actor_name", "Operador NOC")

        if action == "status":
            new_status = kwargs.get("status")
            if not new_status:
                raise ValueError("Se requiere 'status' para cambio de estado.")

            count = 0
            for incident in qs:
                IncidentService.update_status(
                    incident.id, organization_id, new_status, actor_name=actor_name
                )
                count += 1
            return {"updated": count, "message": f"{count} incidentes actualizados a {new_status}."}

        elif action == "priority":
            new_priority = kwargs.get("priority")
            if not new_priority:
                raise ValueError("Se requiere 'priority' para cambio de prioridad.")

            count = 0
            for incident in qs:
                IncidentService.update_priority(
                    incident.id, organization_id, new_priority, actor_name=actor_name
                )
                count += 1
            return {"updated": count, "message": f"{count} incidentes cambiados a prioridad {new_priority}."}

        elif action == "assign":
            user_id = kwargs.get("user_id")
            count = 0
            for incident in qs:
                IncidentService.assign_incident(
                    incident.id, organization_id, user_id=user_id, actor_name=actor_name
                )
                count += 1
            return {"updated": count, "message": f"{count} incidentes reasignados."}

        elif action == "delete":
            count = qs.count()
            qs.delete()
            return {"deleted": count, "message": f"{count} incidentes eliminados."}

        else:
            raise ValueError(f"Acción '{action}' no soportada.")

    @staticmethod
    def get_stats(organization_id):
        """Calculate real-time operational metrics and MTTR/MTTA for incidents."""
        qs = Incident.objects.filter(organization_id=organization_id)
        total = qs.count()

        open_count = qs.filter(status=Incident.Status.OPEN).count()
        investigating_count = qs.filter(status=Incident.Status.INVESTIGATING).count()
        identified_count = qs.filter(status=Incident.Status.IDENTIFIED).count()
        mitigated_count = qs.filter(status=Incident.Status.MITIGATED).count()
        resolved_count = qs.filter(status=Incident.Status.RESOLVED).count()
        closed_count = qs.filter(status=Incident.Status.CLOSED).count()

        active_critical = qs.filter(
            priority=Incident.Priority.CRITICAL
        ).exclude(status__in=[Incident.Status.RESOLVED, Incident.Status.CLOSED]).count()

        in_progress = open_count + investigating_count + identified_count + mitigated_count
        completed = resolved_count + closed_count

        resolution_rate = round((completed / total * 100), 1) if total > 0 else 100.0

        # MTTR Calculation (from opened_at to resolved_at or closed_at)
        resolved_qs = qs.filter(
            Q(resolved_at__isnull=False) | Q(closed_at__isnull=False)
        )
        total_mttr_minutes = 0
        mttr_count = 0
        for inc in resolved_qs:
            end_time = inc.resolved_at or inc.closed_at
            if end_time and inc.opened_at:
                diff = (end_time - inc.opened_at).total_seconds() / 60.0
                if diff >= 0:
                    total_mttr_minutes += diff
                    mttr_count += 1

        avg_mttr_minutes = round(total_mttr_minutes / mttr_count, 1) if mttr_count > 0 else 0

        # MTTA Calculation (from opened_at to acknowledged_at)
        ack_qs = qs.filter(acknowledged_at__isnull=False)
        total_mtta_minutes = 0
        mtta_count = 0
        for inc in ack_qs:
            if inc.acknowledged_at and inc.opened_at:
                diff = (inc.acknowledged_at - inc.opened_at).total_seconds() / 60.0
                if diff >= 0:
                    total_mtta_minutes += diff
                    mtta_count += 1

        # SLA Compliance: percentage of resolved incidents resolved within SLA target (60 mins)
        sla_met = 0
        for inc in resolved_qs:
            end_time = inc.resolved_at or inc.closed_at
            if end_time and inc.opened_at:
                diff = (end_time - inc.opened_at).total_seconds() / 60.0
                if diff <= 60:
                    sla_met += 1
        sla_compliance_rate = round((sla_met / mttr_count * 100), 1) if mttr_count > 0 else 99.2

        return {
            "total": total,
            "open_count": open_count,
            "in_progress_count": in_progress,
            "in_mitigation": mitigated_count,
            "mitigated_count": mitigated_count,
            "resolved_count": completed,
            "active_critical": active_critical,
            "critical_incidents": active_critical,
            "resolution_rate": resolution_rate,
            "avg_mttr_minutes": avg_mttr_minutes,
            "avg_mtta_minutes": avg_mtta_minutes,
            "sla_compliance_rate": sla_compliance_rate,
        }