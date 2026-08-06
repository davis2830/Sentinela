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
        WEBHOOK = "webhook", "Webhook"

    name = models.CharField(max_length=255)
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