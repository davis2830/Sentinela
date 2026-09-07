import uuid
from django.db import models
from common.models import OrganizationOwnedModel


class StatusPageConfig(OrganizationOwnedModel):
    """Configuration settings for an organization's Status Page."""

    class AnnouncementType(models.TextChoices):
        INFO = "info", "Informativo"
        WARNING = "warning", "Advertencia"
        CRITICAL = "critical", "Crítico"

    company_name = models.CharField(max_length=255, default="Servicios de la Empresa")
    slug = models.CharField(max_length=100, unique=True, db_index=True)
    description = models.TextField(
        blank=True,
        default="Estado de disponibilidad y rendimiento de nuestros servicios en tiempo real.",
    )
    logo_url = models.CharField(max_length=1000, blank=True, default="")
    website_url = models.URLField(max_length=500, blank=True, default="")
    is_public = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)
    support_email = models.EmailField(blank=True, default="")
    
    # Custom Announcement Broadcast Banner
    custom_announcement = models.TextField(blank=True, default="")
    announcement_type = models.CharField(
        max_length=20,
        choices=AnnouncementType.choices,
        default=AnnouncementType.INFO,
    )
    announcement_active = models.BooleanField(default=False)

    # Visibility toggles
    show_uptime_pct = models.BooleanField(default=True)
    show_latency_24h = models.BooleanField(default=True)

    # Monitored components selection & customization
    monitored_targets = models.JSONField(
        default=list,
        blank=True,
        help_text="List of target IDs to include on the status page",
    )
    component_settings = models.JSONField(
        default=list,
        blank=True,
        help_text="Detailed config of published components, categories, custom names, and visibility",
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
    status_page = models.ForeignKey(
        StatusPageConfig,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="maintenances",
    )
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()

    class Meta:
        db_table = "status_page_maintenance"
        ordering = ["-start_time"]

    def __str__(self):
        return f"{self.title} ({self.status})"


class MaintenanceUpdate(models.Model):
    """Log entry of progress during a scheduled maintenance window."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    maintenance = models.ForeignKey(
        ScheduledMaintenance,
        on_delete=models.CASCADE,
        related_name="updates",
    )
    message = models.TextField()
    status = models.CharField(max_length=20, default="scheduled")
    posted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "status_page_maintenance_update"
        ordering = ["-posted_at"]

    def __str__(self):
        return f"Update for {self.maintenance_id} at {self.posted_at}"


class StatusPageSubscriber(OrganizationOwnedModel):
    """Email subscriber for notifications on incidents and maintenances."""

    status_page = models.ForeignKey(
        StatusPageConfig,
        on_delete=models.CASCADE,
        related_name="subscribers",
    )
    email = models.EmailField(db_index=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "status_page_subscriber"
        ordering = ["-created_at"]
        unique_together = ("status_page", "email")

    def __str__(self):
        return f"{self.email} -> {self.status_page.slug}"
