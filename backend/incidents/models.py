from django.conf import settings
from django.db import models

from common.models import BaseModel, OrganizationOwnedModel


class Incident(OrganizationOwnedModel):
    """Groups multiple related alerts into a single incident.

    Represents a disruption or issue that requires attention,
    tracking, and resolution. Has an enterprise ITIL/SRE lifecycle
    from open to closed.
    """

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        INVESTIGATING = "investigating", "Investigating"
        IDENTIFIED = "identified", "Identified"
        MITIGATED = "mitigated", "Mitigated"
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

    # Ownership & Assignment
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_incidents",
    )
    assigned_to_name = models.CharField(max_length=255, blank=True, default="")

    # Impacted Service & Correlation
    impacted_service = models.CharField(max_length=255, blank=True, default="")
    target_type = models.CharField(max_length=50, blank=True, default="")
    target_id = models.UUIDField(null=True, blank=True)

    # Root Cause Analysis (RCA) & Post-Mortem
    root_cause = models.TextField(blank=True, default="")
    resolution_summary = models.TextField(blank=True, default="")
    preventive_actions = models.TextField(blank=True, default="")

    # SLA Milestones & Tracking (MTTA / MTTR)
    opened_at = models.DateTimeField(auto_now_add=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    mitigated_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-opened_at"]
        db_table = "incidents_incident"
        indexes = [
            models.Index(fields=["organization", "-opened_at"]),
            models.Index(fields=["status"]),
            models.Index(fields=["priority"]),
            models.Index(fields=["target_type", "target_id"]),
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
    notes, alert additions, assignment, RCA updates, etc.
    Provides a full audit trail of the incident response.
    """

    class EventType(models.TextChoices):
        CREATED = "created", "Created"
        STATUS_CHANGED = "status_changed", "Status Changed"
        PRIORITY_CHANGED = "priority_changed", "Priority Changed"
        ALERT_ADDED = "alert_added", "Alert Added"
        NOTE_ADDED = "note_added", "Note Added"
        ASSIGNED = "assigned", "Assigned"
        RCA_UPDATED = "rca_updated", "RCA Updated"
        MITIGATED = "mitigated", "Mitigated"
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
    actor_name = models.CharField(max_length=255, blank=True, default="Sistema")
    occurred_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-occurred_at"]
        db_table = "incidents_timeline_event"

    def __str__(self):
        return f"{self.incident.title} - {self.event_type} @ {self.occurred_at}"