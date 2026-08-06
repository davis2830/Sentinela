import uuid

from django.db import models


class AuditLog(models.Model):
    """Immutable audit log entry.

    Records all administrative actions across the platform.
    This table must NEVER be modified or deleted — it is the
    definitive record of all actions taken in the system.

    Stores: user, action, date, IP, module, result.
    """

    class Action(models.TextChoices):
        LOGIN = "login", "Login"
        LOGOUT = "logout", "Logout"
        CREATE = "create", "Create"
        UPDATE = "update", "Update"
        DELETE = "delete", "Delete"
        CONFIG_CHANGE = "config_change", "Config Change"
        ALERT_ACKNOWLEDGED = "alert_acknowledged", "Alert Acknowledged"
        ALERT_RESOLVED = "alert_resolved", "Alert Resolved"
        INCIDENT_CREATED = "incident_created", "Incident Created"
        INCIDENT_STATUS_CHANGED = "incident_status_changed", "Incident Status Changed"
        INCIDENT_RESOLVED = "incident_resolved", "Incident Resolved"
        INCIDENT_CLOSED = "incident_closed", "Incident Closed"
        ROLE_ASSIGNED = "role_assigned", "Role Assigned"
        ROLE_REMOVED = "role_removed", "Role Removed"
        NOTIFICATION_SENT = "notification_sent", "Notification Sent"
        REPORT_GENERATED = "report_generated", "Report Generated"

    class Result(models.TextChoices):
        SUCCESS = "success", "Success"
        FAILURE = "failure", "Failure"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization_id = models.UUIDField(null=True, blank=True, db_index=True)
    user_id = models.UUIDField(null=True, blank=True, db_index=True)
    user_email = models.CharField(max_length=255, blank=True)
    action = models.CharField(max_length=50, choices=Action.choices)
    module = models.CharField(max_length=50)
    result = models.CharField(max_length=20, choices=Result.choices, default=Result.SUCCESS)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    description = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-timestamp"]
        db_table = "audit_log"
        indexes = [
            models.Index(fields=["organization_id", "-timestamp"]),
            models.Index(fields=["action"]),
            models.Index(fields=["module"]),
            models.Index(fields=["user_id"]),
        ]

    def __str__(self):
        return f"{self.action} - {self.module} - {self.user_email} @ {self.timestamp}"