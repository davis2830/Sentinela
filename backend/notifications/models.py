from django.db import models

from common.models import BaseModel, OrganizationOwnedModel


class NotificationChannel(OrganizationOwnedModel):
    """Represents a notification delivery channel for an organization.

    Each channel has a type (email, slack, teams, webhook) and
    configuration specific to that type.
    """

    class ChannelType(models.TextChoices):
        EMAIL = "email", "Email"
        SLACK = "slack", "Slack"
        TEAMS = "teams", "Microsoft Teams"
        DISCORD = "discord", "Discord"
        TELEGRAM = "telegram", "Telegram"
        WEBHOOK = "webhook", "Webhook"

    name = models.CharField(max_length=255)
    description = models.CharField(max_length=255, blank=True, default="")
    channel_type = models.CharField(
        max_length=20,
        choices=ChannelType.choices,
    )
    config = models.JSONField(
        default=dict,
        blank=True,
        help_text="Channel-specific configuration (webhook URL, email recipients, etc.)",
    )
    enabled = models.BooleanField(default=True)

    # Smart Routing & Alert Fatigue Management
    min_severity = models.CharField(
        max_length=20,
        choices=[
            ("info", "Informativo (Todas)"),
            ("warning", "Advertencia & Crítica"),
            ("critical", "Solo Críticas"),
        ],
        default="info",
        help_text="Severidad mínima requerida para despachar a este canal",
    )
    subscribed_events = models.JSONField(
        default=list,
        blank=True,
        help_text="Eventos suscritos: alert_triggered, alert_resolved, incident_opened, incident_resolved, maintenance",
    )
    rate_limit_per_hour = models.PositiveIntegerField(
        default=0,
        help_text="Límite máximo de notificaciones por hora (0 = ilimitado)",
    )

    # Quiet Hours (Horario de Silencio)
    quiet_hours_enabled = models.BooleanField(default=False)
    quiet_hours_start = models.CharField(max_length=5, default="22:00", blank=True)
    quiet_hours_end = models.CharField(max_length=5, default="08:00", blank=True)
    quiet_hours_critical_override = models.BooleanField(
        default=True,
        help_text="Permitir que alertas críticas ignoren las horas de silencio",
    )

    class Meta:
        ordering = ["-created_at"]
        db_table = "notifications_channel"

    def __str__(self):
        return f"{self.name} ({self.channel_type})"


class Notification(BaseModel):
    """Represents a notification delivery attempt.

    Records the channel, status, response, and timestamp for
    each notification sent. Must be completely independent
    from the alert engine.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    channel = models.ForeignKey(
        NotificationChannel,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications",
    )
    alert_id = models.UUIDField(null=True, blank=True)
    title = models.CharField(max_length=500)
    message = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    severity = models.CharField(max_length=20, default="info", blank=True)
    event_type = models.CharField(max_length=50, default="alert_triggered", blank=True)
    duration_ms = models.PositiveIntegerField(
        default=0,
        help_text="Tiempo de respuesta de la API/SMTP en ms",
    )
    http_status = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Código de estado HTTP de respuesta",
    )
    retry_count = models.PositiveIntegerField(default=0)
    sent_at = models.DateTimeField(null=True, blank=True)
    response = models.TextField(blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        db_table = "notifications_notification"
        indexes = [
            models.Index(fields=["organization", "-created_at"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.status})"