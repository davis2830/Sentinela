from django.db import transaction
from django.utils import timezone

from .models import Incident, IncidentAlert, IncidentTimelineEvent


class IncidentService:
    """Service for incident management.

    Handles incident lifecycle (open, investigate, resolve, close),
    alert linking, and timeline tracking.
    All business logic lives here, not in views.
    """

    @staticmethod
    def list_incidents(organization_id, status_filter=None, priority_filter=None):
        """Return incidents for an organization with optional filters.

        Args:
            organization_id: UUID of the organization.
            status_filter: Optional status filter (open, investigating, resolved, closed).
            priority_filter: Optional priority filter (critical, high, medium, low).

        Returns:
            QuerySet of Incident instances.
        """
        qs = Incident.objects.filter(organization_id=organization_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if priority_filter:
            qs = qs.filter(priority=priority_filter)
        return qs.order_by("-opened_at")

    @staticmethod
    def get_incident(incident_id, organization_id):
        """Return a single incident by ID within an organization."""
        return Incident.objects.get(id=incident_id, organization_id=organization_id)

    @staticmethod
    @transaction.atomic
    def create_incident(organization_id, title, description="", priority="medium"):
        """Create a new incident and record a timeline event.

        Args:
            organization_id: UUID of the organization.
            title: Incident title.
            description: Optional incident description.
            priority: Incident priority (critical, high, medium, low).

        Returns:
            The created Incident instance.
        """
        incident = Incident.objects.create(
            organization_id=organization_id,
            title=title,
            description=description,
            priority=priority,
            status=Incident.Status.OPEN,
        )

        IncidentTimelineEvent.objects.create(
            incident=incident,
            event_type=IncidentTimelineEvent.EventType.CREATED,
            description=f"Incident created: {title}",
            new_value=Incident.Status.OPEN,
        )

        return incident

    @staticmethod
    @transaction.atomic
    def update_status(incident_id, organization_id, new_status):
        """Update incident status and record timeline event.

        Args:
            incident_id: UUID of the incident.
            organization_id: UUID of the organization.
            new_status: New status (open, investigating, resolved, closed).

        Returns:
            The updated Incident instance.
        """
        incident = Incident.objects.get(id=incident_id, organization_id=organization_id)
        old_status = incident.status

        if old_status == new_status:
            return incident

        incident.status = new_status

        if new_status == Incident.Status.RESOLVED:
            incident.closed_at = timezone.now()
        elif new_status == Incident.Status.CLOSED:
            if not incident.closed_at:
                incident.closed_at = timezone.now()

        incident.save(update_fields=["status", "closed_at"])

        event_type = IncidentTimelineEvent.EventType.STATUS_CHANGED
        if new_status == Incident.Status.RESOLVED:
            event_type = IncidentTimelineEvent.EventType.RESOLVED
        elif new_status == Incident.Status.CLOSED:
            event_type = IncidentTimelineEvent.EventType.CLOSED

        IncidentTimelineEvent.objects.create(
            incident=incident,
            event_type=event_type,
            description=f"Status changed from {old_status} to {new_status}",
            old_value=old_status,
            new_value=new_status,
        )

        return incident

    @staticmethod
    @transaction.atomic
    def update_priority(incident_id, organization_id, new_priority):
        """Update incident priority and record timeline event.

        Args:
            incident_id: UUID of the incident.
            organization_id: UUID of the organization.
            new_priority: New priority (critical, high, medium, low).

        Returns:
            The updated Incident instance.
        """
        incident = Incident.objects.get(id=incident_id, organization_id=organization_id)
        old_priority = incident.priority

        if old_priority == new_priority:
            return incident

        incident.priority = new_priority
        incident.save(update_fields=["priority"])

        IncidentTimelineEvent.objects.create(
            incident=incident,
            event_type=IncidentTimelineEvent.EventType.PRIORITY_CHANGED,
            description=f"Priority changed from {old_priority} to {new_priority}",
            old_value=old_priority,
            new_value=new_priority,
        )

        return incident

    @staticmethod
    @transaction.atomic
    def add_alert(incident_id, alert_id):
        """Link an alert to an incident.

        Args:
            incident_id: UUID of the incident.
            alert_id: UUID of the alert to link.

        Returns:
            The created IncidentAlert instance (or existing if already linked).
        """
        incident = Incident.objects.get(id=incident_id)
        incident_alert, created = IncidentAlert.objects.get_or_create(
            incident=incident,
            alert_id=alert_id,
        )

        if created:
            IncidentTimelineEvent.objects.create(
                incident=incident,
                event_type=IncidentTimelineEvent.EventType.ALERT_ADDED,
                description=f"Alert {alert_id} linked to incident",
                new_value=str(alert_id),
            )

        return incident_alert

    @staticmethod
    @transaction.atomic
    def add_note(incident_id, organization_id, note):
        """Add a note to the incident timeline.

        Args:
            incident_id: UUID of the incident.
            organization_id: UUID of the organization.
            note: Note text to add.

        Returns:
            The created IncidentTimelineEvent instance.
        """
        incident = Incident.objects.get(id=incident_id, organization_id=organization_id)

        return IncidentTimelineEvent.objects.create(
            incident=incident,
            event_type=IncidentTimelineEvent.EventType.NOTE_ADDED,
            description=note,
        )

    @staticmethod
    def get_timeline(incident_id, organization_id):
        """Return the full timeline of events for an incident.

        Args:
            incident_id: UUID of the incident.
            organization_id: UUID of the organization.

        Returns:
            QuerySet of IncidentTimelineEvent instances ordered by most recent.
        """
        incident = Incident.objects.get(id=incident_id, organization_id=organization_id)
        return incident.timeline_events.all()

    @staticmethod
    def get_linked_alerts(incident_id, organization_id):
        """Return all alerts linked to an incident.

        Args:
            incident_id: UUID of the incident.
            organization_id: UUID of the organization.

        Returns:
            QuerySet of IncidentAlert instances.
        """
        incident = Incident.objects.get(id=incident_id, organization_id=organization_id)
        return incident.incident_alerts.all()

    @staticmethod
    @transaction.atomic
    def delete_incident(incident_id, organization_id):
        """Delete an incident."""
        incident = Incident.objects.get(id=incident_id, organization_id=organization_id)
        incident.delete()