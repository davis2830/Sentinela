from django.db import models
from common.models import OrganizationOwnedModel


class StatusPageConfig(OrganizationOwnedModel):
    """Configuration settings for an organization's Status Page."""

    company_name = models.CharField(max_length=255, default="Servicios de la Empresa")
    slug = models.CharField(max_length=100, unique=True, db_index=True)
    description = models.TextField(
        blank=True,
        default="Estado de disponibilidad y rendimiento de nuestros servicios en tiempo real.",
    )
    logo_url = models.CharField(max_length=1000, blank=True, default="")
    is_public = models.BooleanField(default=True)
    support_email = models.EmailField(blank=True, default="")
    monitored_targets = models.JSONField(
        default=list,
        blank=True,
        help_text="List of target IDs to include on the status page",
    )

    class Meta:
        db_table = "status_page_config"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Status Page for {self.company_name} ({self.slug})"


class ScheduledMaintenance(OrganizationOwnedModel):
    """Represents a planned or ongoing maintenance window."""

    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SCHEDULED,
    )
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()

    class Meta:
        db_table = "status_page_maintenance"
        ordering = ["-start_time"]

    def __str__(self):
        return f"{self.title} ({self.status})"
