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
            elif channel.channel_type == "discord":
                response = DiscordDeliveryHandler.send(channel, notification)
            elif channel.channel_type == "telegram":
                response = TelegramDeliveryHandler.send(channel, notification)
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
            try:
                NotificationService.send_notification(notification.id)
            except Exception as send_err:
                logger.warning("Failed to send notification %s: %s", notification.id, send_err)
            count += 1
        return count

    @staticmethod
    def test_channel(channel_id, organization_id):
        """Send a test notification to a specific channel."""
        channel = NotificationChannel.objects.get(
            id=channel_id, organization_id=organization_id
        )
        notification = NotificationService.create_notification(
            organization_id=organization_id,
            channel_id=channel.id,
            title="🔔 Sentinela - Notificación de Prueba",
            message=f"Esta es una notificación de prueba para validar la integración con el canal '{channel.name}' ({channel.channel_type}).",
        )
        from .tasks import send_notification_task
        send_notification_task(str(notification.id))
        notification.refresh_from_db()
        return notification

    @staticmethod
    def get_notification_stats(organization_id):
        """Returns KPI summary statistics for notifications."""
        channels = NotificationChannel.objects.filter(organization_id=organization_id)
        notifications = Notification.objects.filter(organization_id=organization_id)

        total_channels = channels.count()
        enabled_channels = channels.filter(enabled=True).count()
        total_sent = notifications.filter(status=Notification.Status.SENT).count()
        total_failed = notifications.filter(status=Notification.Status.FAILED).count()
        active_types_count = channels.values("channel_type").distinct().count()

        return {
            "total_channels": total_channels,
            "enabled_channels": enabled_channels,
            "total_sent": total_sent,
            "total_failed": total_failed,
            "active_types_count": active_types_count,
        }


class EmailDeliveryHandler:
    """Handles email notification delivery via custom or default SMTP."""

    @staticmethod
    def send(channel, notification):
        config = channel.config or {}
        recipients = config.get("recipients", [])

        if not recipients:
            raise ValueError("No recipients configured for email channel.")

        smtp_host = config.get("smtp_host")
        from_email = config.get("from_email") or config.get("smtp_user") or "alertas@sentinela.local"

        if smtp_host:
            from django.core.mail import EmailMessage, get_connection
            connection = get_connection(
                backend="django.core.mail.backends.smtp.EmailBackend",
                host=smtp_host,
                port=int(config.get("smtp_port", 587)),
                username=config.get("smtp_user"),
                password=config.get("smtp_password"),
                use_tls=config.get("use_tls", True),
                use_ssl=config.get("use_ssl", False),
                timeout=10,
            )
            email = EmailMessage(
                subject=notification.title,
                body=notification.message,
                from_email=from_email,
                to=recipients,
                connection=connection,
            )
            email.send(fail_silently=False)
        else:
            send_mail(
                subject=notification.title,
                message=notification.message,
                from_email=from_email,
                recipient_list=recipients,
                fail_silently=False,
            )

        return f"Email sent to {len(recipients)} recipients via {smtp_host or 'default SMTP'}."


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


class DiscordDeliveryHandler:
    """Handles Discord notification delivery via Webhook."""

    @staticmethod
    def send(channel, notification):
        config = channel.config or {}
        webhook_url = config.get("webhook_url")

        if not webhook_url:
            raise ValueError("No webhook_url configured for Discord channel.")

        payload = {
            "content": f"**{notification.title}**\n{notification.message}",
        }

        response = requests.post(webhook_url, json=payload, timeout=10)
        response.raise_for_status()

        return f"Discord notification sent (HTTP {response.status_code})."


class TelegramDeliveryHandler:
    """Handles Telegram notification delivery via Bot API."""

    @staticmethod
    def send(channel, notification):
        config = channel.config or {}
        bot_token = config.get("bot_token")
        chat_id = config.get("chat_id")

        if not bot_token or not chat_id:
            raise ValueError("bot_token and chat_id are required for Telegram channel.")

        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": f"*{notification.title}*\n\n{notification.message}",
            "parse_mode": "Markdown",
        }

        response = requests.post(url, json=payload, timeout=10)
        response.raise_for_status()

        return f"Telegram message sent to chat {chat_id}."