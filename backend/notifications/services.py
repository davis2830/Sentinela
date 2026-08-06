import json
import logging

import requests
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from .models import Notification, NotificationChannel

logger = logging.getLogger(__name__)


class NotificationChannelService:
    """Service for notification channel management.

    Handles CRUD operations for notification channels.
    """

    @staticmethod
    def list_channels(organization_id):
        """Return all notification channels for an organization."""
        return NotificationChannel.objects.filter(
            organization_id=organization_id
        ).order_by("-created_at")

    @staticmethod
    def get_channel(channel_id, organization_id):
        """Return a single channel by ID within an organization."""
        return NotificationChannel.objects.get(
            id=channel_id, organization_id=organization_id
        )

    @staticmethod
    @transaction.atomic
    def create_channel(organization_id, name, channel_type, config=None, enabled=True):
        """Create a new notification channel.

        Args:
            organization_id: UUID of the organization.
            name: Display name for the channel.
            channel_type: One of email, slack, teams, webhook.
            config: Channel-specific configuration dict.
            enabled: Whether the channel is active (default True).

        Returns:
            The created NotificationChannel instance.
        """
        return NotificationChannel.objects.create(
            organization_id=organization_id,
            name=name,
            channel_type=channel_type,
            config=config or {},
            enabled=enabled,
        )

    @staticmethod
    @transaction.atomic
    def update_channel(channel_id, organization_id, **fields):
        """Update an existing notification channel."""
        channel = NotificationChannel.objects.get(
            id=channel_id, organization_id=organization_id
        )
        for field, value in fields.items():
            if value is not None:
                setattr(channel, field, value)
        channel.save()
        return channel

    @staticmethod
    @transaction.atomic
    def delete_channel(channel_id, organization_id):
        """Delete a notification channel."""
        channel = NotificationChannel.objects.get(
            id=channel_id, organization_id=organization_id
        )
        channel.delete()


class NotificationService:
    """Service for notification delivery.

    Completely independent from the alert engine. Handles
    creating, sending, and tracking notifications across
    multiple channels.
    """

    @staticmethod
    def list_notifications(organization_id, status_filter=None):
        """Return notifications for an organization with optional filter."""
        qs = Notification.objects.filter(organization_id=organization_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs.order_by("-created_at")

    @staticmethod
    def get_notification(notification_id, organization_id):
        """Return a single notification by ID within an organization."""
        return Notification.objects.get(
            id=notification_id, organization_id=organization_id
        )

    @staticmethod
    @transaction.atomic
    def create_notification(
        organization_id,
        channel_id,
        title,
        message,
        alert_id=None,
    ):
        """Create a pending notification.

        The actual delivery is handled by the send_notification Celery task.

        Args:
            organization_id: UUID of the organization.
            channel_id: UUID of the notification channel.
            title: Notification title.
            message: Notification message body.
            alert_id: Optional UUID of the alert that triggered this.

        Returns:
            The created Notification instance.
        """
        return Notification.objects.create(
            organization_id=organization_id,
            channel_id=channel_id,
            alert_id=alert_id,
            title=title,
            message=message,
            status=Notification.Status.PENDING,
        )

    @staticmethod
    @transaction.atomic
    def send_notification(notification_id):
        """Send a notification through its configured channel.

        Delegates to the appropriate delivery handler based on
        the channel type. Updates the notification status and
        records the response or error.

        Args:
            notification_id: UUID of the notification to send.

        Returns:
            bool: True if sent successfully, False otherwise.
        """
        try:
            notification = Notification.objects.get(id=notification_id)
        except Notification.DoesNotExist:
            logger.error("Notification %s not found.", notification_id)
            return False

        if notification.status == Notification.Status.SENT:
            logger.info("Notification %s already sent, skipping.", notification_id)
            return True

        channel = notification.channel
        if not channel or not channel.enabled:
            notification.status = Notification.Status.FAILED
            notification.error_message = "Channel not found or disabled."
            notification.save(update_fields=["status", "error_message"])
            return False

        try:
            if channel.channel_type == "email":
                response = EmailDeliveryHandler.send(channel, notification)
            elif channel.channel_type == "slack":
                response = SlackDeliveryHandler.send(channel, notification)
            elif channel.channel_type == "teams":
                response = TeamsDeliveryHandler.send(channel, notification)
            elif channel.channel_type == "webhook":
                response = WebhookDeliveryHandler.send(channel, notification)
            else:
                notification.status = Notification.Status.FAILED
                notification.error_message = f"Unknown channel type: {channel.channel_type}"
                notification.save(update_fields=["status", "error_message"])
                return False

            notification.status = Notification.Status.SENT
            notification.sent_at = timezone.now()
            notification.response = str(response)[:1000]
            notification.save(update_fields=["status", "sent_at", "response"])
            return True

        except Exception as exc:
            logger.exception("Error sending notification %s: %s", notification_id, exc)
            notification.status = Notification.Status.FAILED
            notification.error_message = str(exc)[:1000]
            notification.save(update_fields=["status", "error_message"])
            return False

    @staticmethod
    def send_to_all_channels(organization_id, title, message, alert_id=None):
        """Send a notification to all enabled channels for an organization.

        Creates a notification for each enabled channel and dispatches
        send tasks asynchronously.

        Args:
            organization_id: UUID of the organization.
            title: Notification title.
            message: Notification message body.
            alert_id: Optional UUID of the alert that triggered this.

        Returns:
            int: Number of notifications created.
        """
        channels = NotificationChannel.objects.filter(
            organization_id=organization_id,
            enabled=True,
        )

        count = 0
        for channel in channels:
            notification = NotificationService.create_notification(
                organization_id=organization_id,
                channel_id=channel.id,
                title=title,
                message=message,
                alert_id=alert_id,
            )
            from .tasks import send_notification_task
            send_notification_task.delay(str(notification.id))
            count += 1

        return count


class EmailDeliveryHandler:
    """Handles email notification delivery."""

    @staticmethod
    def send(channel, notification):
        """Send an email notification.

        Expects channel.config to contain:
            - recipients: List of email addresses
            - from_email: Optional sender address (defaults to settings)

        Args:
            channel: NotificationChannel instance.
            notification: Notification instance.

        Returns:
            str: Delivery confirmation.
        """
        config = channel.config or {}
        recipients = config.get("recipients", [])
        from_email = config.get("from_email", None)

        if not recipients:
            raise ValueError("No recipients configured for email channel.")

        send_mail(
            subject=notification.title,
            message=notification.message,
            from_email=from_email,
            recipient_list=recipients,
            fail_silently=False,
        )

        return f"Email sent to {len(recipients)} recipients."


class SlackDeliveryHandler:
    """Handles Slack notification delivery via Incoming Webhook."""

    @staticmethod
    def send(channel, notification):
        """Send a Slack notification via webhook.

        Expects channel.config to contain:
            - webhook_url: Slack incoming webhook URL

        Args:
            channel: NotificationChannel instance.
            notification: Notification instance.

        Returns:
            str: Delivery confirmation.
        """
        config = channel.config or {}
        webhook_url = config.get("webhook_url")

        if not webhook_url:
            raise ValueError("No webhook_url configured for Slack channel.")

        payload = {
            "text": f"*{notification.title}*\n{notification.message}",
        }

        response = requests.post(webhook_url, json=payload, timeout=10)
        response.raise_for_status()

        return f"Slack notification sent (HTTP {response.status_code})."


class TeamsDeliveryHandler:
    """Handles Microsoft Teams notification delivery via Incoming Webhook."""

    @staticmethod
    def send(channel, notification):
        """Send a Teams notification via webhook.

        Expects channel.config to contain:
            - webhook_url: Teams incoming webhook URL

        Args:
            channel: NotificationChannel instance.
            notification: Notification instance.

        Returns:
            str: Delivery confirmation.
        """
        config = channel.config or {}
        webhook_url = config.get("webhook_url")

        if not webhook_url:
            raise ValueError("No webhook_url configured for Teams channel.")

        payload = {
            "@type": "MessageCard",
            "@context": "http://schema.org/extensions",
            "themeColor": "FF0000" if "critical" in notification.title.lower() else "FFA500",
            "summary": notification.title,
            "sections": [
                {
                    "activityTitle": notification.title,
                    "text": notification.message,
                }
            ],
        }

        response = requests.post(webhook_url, json=payload, timeout=10)
        response.raise_for_status()

        return f"Teams notification sent (HTTP {response.status_code})."


class WebhookDeliveryHandler:
    """Handles generic webhook notification delivery."""

    @staticmethod
    def send(channel, notification):
        """Send a notification to a generic webhook.

        Expects channel.config to contain:
            - webhook_url: Webhook URL
            - headers: Optional dict of custom headers

        Args:
            channel: NotificationChannel instance.
            notification: Notification instance.

        Returns:
            str: Delivery confirmation.
        """
        config = channel.config or {}
        webhook_url = config.get("webhook_url")
        headers = config.get("headers", {})

        if not webhook_url:
            raise ValueError("No webhook_url configured for webhook channel.")

        payload = {
            "title": notification.title,
            "message": notification.message,
            "alert_id": str(notification.alert_id) if notification.alert_id else None,
            "notification_id": str(notification.id),
        }

        response = requests.post(
            webhook_url,
            json=payload,
            headers=headers,
            timeout=10,
        )
        response.raise_for_status()

        return f"Webhook notification sent (HTTP {response.status_code})."