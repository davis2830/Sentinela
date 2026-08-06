from django.db import models

from common.models import BaseModel, OrganizationOwnedModel


class Incident(OrganizationOwnedModel):
    """Groups multiple related alerts into a single incident.

    Represents a disruption or issue that requires attention,
    tracking, and resolution. Has a lifecycle from open to closed.
    """

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        INVESTIGATING = "investigating", "Investigating"
        RESOLVED = "resolved", "Resolved"
        CLOSED = "closed", "Closed"

    class Priority(models.TextChoices):
        CRITICAL = "critical", "Critical"
        HIGH = "high", "High"
        MEDIUM = "medium", "Medium"
        LOW = "low", "Low"

    title = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN,
    )
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIUM,
    )
    opened_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-opened_at"]
        db_table = "incidents_incident"
        indexes = [
            models.Index(fields=["organization", "-opened_at"]),
            models.Index(fields=["status"]),
            models.Index(fields=["priority"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.status} / {self.priority})"


class IncidentAlert(BaseModel):
    """Links an alert to an incident.

    Many-to-many relationship between incidents and alerts
    that allows tracking which alerts contributed to each incident.
    """

    incident = models.ForeignKey(
        Incident,
        on_delete=models.CASCADE,
        related_name="incident_alerts",
    )
    alert_id = models.UUIDField()
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-added_at"]
        db_table = "incidents_incident_alert"
        unique_together = ("incident", "alert_id")

    def __str__(self):
        return f"Incident {self.incident_id} <- Alert {self.alert_id}"


class IncidentTimelineEvent(BaseModel):
    """Represents an event in the incident timeline.

    Tracks all actions taken during an incident: status changes,
    notes, alert additions, etc. Provides a full audit trail
    of the incident response.
    """

    class EventType(models.TextChoices):
        CREATED = "created", "Created"
        STATUS_CHANGED = "status_changed", "Status Changed"
        PRIORITY_CHANGED = "priority_changed", "Priority Changed"
        ALERT_ADDED = "alert_added", "Alert Added"
        NOTE_ADDED = "note_added", "Note Added"
        RESOLVED = "resolved", "Resolved"
        CLOSED = "closed", "Closed"

    incident = models.ForeignKey(
        Incident,
        on_delete=models.CASCADE,
        related_name="timeline_events",
    )
    event_type = models.CharField(
        max_length=30,
        choices=EventType.choices,
    )
    description = models.TextField(blank=True)
    old_value = models.CharField(max_length=100, blank=True)
    new_value = models.CharField(max_length=100, blank=True)
    occurred_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-occurred_at"]
        db_table = "incidents_timeline_event"

    def __str__(self):
        return f"{self.incident.title} - {self.event_type} @ {self.occurred_at}"