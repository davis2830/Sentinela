import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone

from common.models import OrganizationOwnedModel


class MaintenanceWindow(OrganizationOwnedModel):
    """Represents a scheduled, recurring, or active operational maintenance window.

    Used by NOC & SRE teams to plan infrastructure interventions, suppressing
    external alert notifications and excluding downtime from SLA penalties.
    """

    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Programado"
        IN_PROGRESS = "in_progress", "En Curso"
        COMPLETED = "completed", "Completado"
        CANCELLED = "cancelled", "Cancelado"

    class Recurrence(models.TextChoices):
        NONE = "none", "Única vez"
        WEEKLY = "weekly", "Semanal"
        BIWEEKLY = "biweekly", "Quincenal"
        MONTHLY = "monthly", "Mensual"

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SCHEDULED,
        db_index=True,
    )
    start_time = models.DateTimeField(db_index=True)
    end_time = models.DateTimeField(db_index=True)

    # Recurrence rules
    recurrence = models.CharField(
        max_length=20,
        choices=Recurrence.choices,
        default=Recurrence.NONE,
    )
    recurrence_day_of_week = models.IntegerField(null=True, blank=True)  # 0=Mon .. 6=Sun
    recurrence_time_start = models.TimeField(null=True, blank=True)
    recurrence_time_end = models.TimeField(null=True, blank=True)

    # Operational suppression options
    suppress_notifications = models.BooleanField(
        default=True,
        help_text="Silencia despachos a canales externos (Slack, Telegram, Teams, Email).",
    )
    exclude_from_sla = models.BooleanField(
        default=True,
        help_text="Excluye el downtime durante este periodo del cálculo de SLA en reportes.",
    )
    publish_to_status_page = models.BooleanField(
        default=False,
        help_text="Publica automáticamente este mantenimiento en la Status Page seleccionada.",
    )

    status_page = models.ForeignKey(
        "status_page.StatusPageConfig",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="maintenance_windows",
    )
    status_page_maintenance = models.ForeignKey(
        "status_page.ScheduledMaintenance",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="operational_windows",
    )
    responsible_team = models.ForeignKey(
        "users.Team",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="maintenance_windows",
    )
    responsible_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_maintenance_windows",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_maintenance_windows",
    )

    class Meta:
        db_table = "maintenance_windows"
        ordering = ["-start_time"]

    def __str__(self):
        return f"{self.title} ({self.status}) [{self.start_time} - {self.end_time}]"

    def is_currently_active(self, at_time=None) -> bool:
        """Evaluate whether this maintenance window is actively in effect."""
        if self.status in [self.Status.COMPLETED, self.Status.CANCELLED]:
            return False

        if self.status == self.Status.IN_PROGRESS:
            return True

        now = at_time or timezone.now()

        if self.recurrence == self.Recurrence.NONE:
            return self.start_time <= now <= self.end_time

        if self.recurrence == self.Recurrence.WEEKLY and self.recurrence_day_of_week is not None:
            if now.weekday() == self.recurrence_day_of_week:
                if self.recurrence_time_start and self.recurrence_time_end:
                    curr_time = now.time()
                    return self.recurrence_time_start <= curr_time <= self.recurrence_time_end

        # Fallback to absolute datetime range
        return self.start_time <= now <= self.end_time

    @property
    def duration_minutes(self) -> int:
        """Duration in minutes between start and end."""
        if self.start_time and self.end_time:
            diff = (self.end_time - self.start_time).total_seconds()
            return max(0, int(diff / 60))
        return 0


class MaintenanceWindowTarget(models.Model):
    """Specific infrastructure target associated with a maintenance window."""

    class TargetType(models.TextChoices):
        ALL = "all", "Toda la Organización (Global)"
        MONITORING = "monitoring", "Uptime & Latencia"
        SSL = "ssl", "Certificados SSL"
        DNS = "dns", "Registros DNS"
        DOMAIN = "domain", "Dominios WHOIS"
        API_CHECK = "api_check", "API Endpoints"
        SECURITY_HEADERS = "security_headers", "Security Headers"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    maintenance_window = models.ForeignKey(
        MaintenanceWindow,
        on_delete=models.CASCADE,
        related_name="targets",
    )
    target_type = models.CharField(
        max_length=30,
        choices=TargetType.choices,
        default=TargetType.MONITORING,
    )
    target_id = models.UUIDField(null=True, blank=True)
    target_name = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "maintenance_window_targets"

    def __str__(self):
        return f"{self.target_type} ({self.target_name or self.target_id})"


class MaintenanceWindowUpdate(models.Model):
    """Progress note or milestone logged during a maintenance window."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    maintenance_window = models.ForeignKey(
        MaintenanceWindow,
        on_delete=models.CASCADE,
        related_name="updates",
    )
    message = models.TextField()
    status = models.CharField(max_length=30, default="in_progress")
    actor_name = models.CharField(max_length=150, blank=True)
    posted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "maintenance_window_updates"
        ordering = ["-posted_at"]

    def __str__(self):
        return f"Update for {self.maintenance_window.title} at {self.posted_at}"
