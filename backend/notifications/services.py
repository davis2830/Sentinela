import csv
from datetime import datetime
import io
import json
import logging
import time
import uuid

import requests
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Avg
from django.utils import timezone

from .models import Notification, NotificationChannel

logger = logging.getLogger(__name__)

SEVERITY_LEVELS = {
    "info": 1,
    "warning": 2,
    "critical": 3,
}


def meets_min_severity(channel_min, alert_severity):
    """Check if an alert's severity satisfies the channel's minimum threshold."""
    req_level = SEVERITY_LEVELS.get((channel_min or "info").lower(), 1)
    act_level = SEVERITY_LEVELS.get((alert_severity or "info").lower(), 1)
    return act_level >= req_level


def is_in_quiet_hours(start_str, end_str, check_time=None):
    """Check if check_time falls within the quiet hours window (HH:MM)."""
    if not start_str or not end_str:
        return False
    try:
        if check_time is None:
            check_time = timezone.now().time()
        start_t = datetime.strptime(start_str, "%H:%M").time()
        end_t = datetime.strptime(end_str, "%H:%M").time()
        if start_t <= end_t:
            return start_t <= check_time <= end_t
        else:
            # Spans over midnight (e.g., 22:00 to 08:00)
            return check_time >= start_t or check_time <= end_t
    except Exception:
        return False


class NotificationChannelService:
    """Service for notification channel management.

    Handles CRUD operations and bulk actions for notification channels.
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
    def create_channel(
        organization_id,
        name,
        channel_type,
        config=None,
        enabled=True,
        description="",
        min_severity="info",
        subscribed_events=None,
        rate_limit_per_hour=0,
        quiet_hours_enabled=False,
        quiet_hours_start="22:00",
        quiet_hours_end="08:00",
        quiet_hours_critical_override=True,
    ):
        """Create a new notification channel with smart routing configuration."""
        return NotificationChannel.objects.create(
            organization_id=organization_id,
            name=name,
            channel_type=channel_type,
            config=config or {},
            enabled=enabled,
            description=description,
            min_severity=min_severity,
            subscribed_events=subscribed_events or [],
            rate_limit_per_hour=rate_limit_per_hour,
            quiet_hours_enabled=quiet_hours_enabled,
            quiet_hours_start=quiet_hours_start,
            quiet_hours_end=quiet_hours_end,
            quiet_hours_critical_override=quiet_hours_critical_override,
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

    @staticmethod
    def bulk_action(organization_id, action, channel_ids):
        """Perform bulk operation on multiple channels."""
        channels = NotificationChannel.objects.filter(
            id__in=channel_ids, organization_id=organization_id
        )
        if action == "enable":
            count = channels.update(enabled=True)
            return {"action": action, "affected_count": count, "message": f"{count} canales activados con éxito."}
        elif action == "disable":
            count = channels.update(enabled=False)
            return {"action": action, "affected_count": count, "message": f"{count} canales pausados con éxito."}
        elif action == "delete":
            count = channels.count()
            channels.delete()
            return {"action": action, "affected_count": count, "message": f"{count} canales eliminados con éxito."}
        elif action == "test":
            tested = 0
            for ch in channels:
                try:
                    NotificationService.test_channel(ch.id, organization_id)
                    tested += 1
                except Exception as e:
                    logger.warning("Error testing channel %s in bulk: %s", ch.id, e)
            return {"action": action, "affected_count": tested, "message": f"Prueba enviada a {tested} canales."}
        return {"action": action, "affected_count": 0, "message": "Acción no reconocida."}


class NotificationService:
    """Service for notification delivery.

    Completely independent from the alert engine. Handles
    creating, sending, tracking and smart-routing notifications across
    multiple channels.
    """

    @staticmethod
    def list_notifications(organization_id, status_filter=None):
        """Return notifications for an organization with optional filter."""
        qs = Notification.objects.filter(organization_id=organization_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs.select_related("channel").order_by("-created_at")

    @staticmethod
    def get_notification(notification_id, organization_id):
        """Return a single notification by ID within an organization."""
        return Notification.objects.select_related("channel").get(
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
        severity="info",
        event_type="alert_triggered",
    ):
        """Create a pending notification."""
        return Notification.objects.create(
            organization_id=organization_id,
            channel_id=channel_id,
            alert_id=alert_id,
            title=title,
            message=message,
            status=Notification.Status.PENDING,
            severity=severity,
            event_type=event_type,
        )

    @staticmethod
    @transaction.atomic
    def send_notification(notification_id):
        """Send a notification through its configured channel.

        Delegates to the appropriate delivery handler, records latency duration_ms
        and response HTTP status code.
        """
        try:
            notification = Notification.objects.select_related("channel").get(id=notification_id)
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

        t0 = time.monotonic()
        try:
            if channel.channel_type == "email":
                resp_text, http_code, duration_ms = EmailDeliveryHandler.send(channel, notification)
            elif channel.channel_type == "slack":
                resp_text, http_code, duration_ms = SlackDeliveryHandler.send(channel, notification)
            elif channel.channel_type == "teams":
                resp_text, http_code, duration_ms = TeamsDeliveryHandler.send(channel, notification)
            elif channel.channel_type == "discord":
                resp_text, http_code, duration_ms = DiscordDeliveryHandler.send(channel, notification)
            elif channel.channel_type == "telegram":
                resp_text, http_code, duration_ms = TelegramDeliveryHandler.send(channel, notification)
            elif channel.channel_type == "webhook":
                resp_text, http_code, duration_ms = WebhookDeliveryHandler.send(channel, notification)
            else:
                notification.status = Notification.Status.FAILED
                notification.error_message = f"Unknown channel type: {channel.channel_type}"
                notification.save(update_fields=["status", "error_message"])
                return False

            notification.status = Notification.Status.SENT
            notification.sent_at = timezone.now()
            notification.response = str(resp_text)[:1000]
            notification.http_status = http_code
            notification.duration_ms = duration_ms
            notification.error_message = ""
            notification.save(update_fields=["status", "sent_at", "response", "http_status", "duration_ms", "error_message"])
            return True

        except Exception as exc:
            duration_ms = int((time.monotonic() - t0) * 1000)
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
            logger.exception("Error sending notification %s: %s", notification_id, exc)
            notification.status = Notification.Status.FAILED
            notification.duration_ms = duration_ms
            notification.http_status = status_code
            notification.error_message = str(exc)[:1000]
            notification.save(update_fields=["status", "error_message", "duration_ms", "http_status"])
            return False

    @staticmethod
    def send_to_all_channels(
        organization_id,
        title,
        message,
        alert_id=None,
        severity="info",
        event_type="alert_triggered",
    ):
        """Send a notification to all matching enabled channels for an organization.

        Applies smart routing:
        1. Minimum severity filtering.
        2. Subscribed events filtering.
        3. Quiet hours check (with critical severity override).
        4. Rate limit per hour enforcement.
        """
        channels = NotificationChannel.objects.filter(
            organization_id=organization_id,
            enabled=True,
        )

        now_time = timezone.now().time()
        one_hour_ago = timezone.now() - timezone.timedelta(hours=1)
        count = 0

        for channel in channels:
            # 1. Minimum Severity Check
            if not meets_min_severity(channel.min_severity, severity):
                logger.debug(
                    "Skipping channel %s: requires %s, received %s",
                    channel.name, channel.min_severity, severity,
                )
                continue

            # 2. Subscribed Events Check
            if channel.subscribed_events and len(channel.subscribed_events) > 0:
                if event_type not in channel.subscribed_events and "*" not in channel.subscribed_events:
                    logger.debug(
                        "Skipping channel %s: not subscribed to event %s",
                        channel.name, event_type,
                    )
                    continue

            # 3. Quiet Hours Check
            if channel.quiet_hours_enabled:
                in_quiet = is_in_quiet_hours(
                    channel.quiet_hours_start, channel.quiet_hours_end, now_time
                )
                if in_quiet:
                    # Check if critical override allows delivery
                    if channel.quiet_hours_critical_override and severity == "critical":
                        logger.info(
                            "Channel %s is in quiet hours, but critical alert bypassed silence.",
                            channel.name,
                        )
                    else:
                        logger.info(
                            "Skipping channel %s: in quiet hours (%s - %s).",
                            channel.name, channel.quiet_hours_start, channel.quiet_hours_end,
                        )
                        continue

            # 4. Rate Limiting Check
            if channel.rate_limit_per_hour and channel.rate_limit_per_hour > 0:
                recent_sent = Notification.objects.filter(
                    channel=channel,
                    created_at__gte=one_hour_ago,
                    status=Notification.Status.SENT,
                ).count()
                if recent_sent >= channel.rate_limit_per_hour:
                    logger.warning(
                        "Channel %s rate limit exceeded (%d/%d in last hour). Skipping notification.",
                        channel.name, recent_sent, channel.rate_limit_per_hour,
                    )
                    continue

            # Create and dispatch
            notification = NotificationService.create_notification(
                organization_id=organization_id,
                channel_id=channel.id,
                title=title,
                message=message,
                alert_id=alert_id,
                severity=severity,
                event_type=event_type,
            )
            try:
                NotificationService.send_notification(notification.id)
            except Exception as send_err:
                logger.warning("Failed to send notification %s: %s", notification.id, send_err)
            count += 1

        return count

    @staticmethod
    def test_channel(channel_id, organization_id):
        """Send a test notification to a specific registered channel."""
        channel = NotificationChannel.objects.get(
            id=channel_id, organization_id=organization_id
        )
        notification = NotificationService.create_notification(
            organization_id=organization_id,
            channel_id=channel.id,
            title="[PRUEBA] Sentinela - Notificación de Prueba",
            message=f"Esta es una notificación de prueba para validar la integración con el canal '{channel.name}' ({channel.channel_type}).",
            severity="info",
            event_type="test",
        )
        from .tasks import send_notification_task
        send_notification_task(str(notification.id))
        notification.refresh_from_db()
        return notification

    @staticmethod
    def test_channel_config(channel_type, config, custom_title=None, custom_message=None):
        """Perform a pre-flight live connection test before saving the channel."""
        t0 = time.monotonic()
        test_title = custom_title or "[TEST EN VIVO] Sentinela NOC - Verificación de Conexión"
        test_msg = custom_message or "Esta es una prueba de pre-vuelo para validar credenciales y endpoint antes de registrar el canal."

        class MockChannel:
            def __init__(self, c_type, conf):
                self.channel_type = c_type
                self.config = conf or {}
                self.name = f"Test-{c_type}"

        class MockNotification:
            def __init__(self, t, m):
                self.title = t
                self.message = m
                self.alert_id = None
                self.id = uuid.uuid4()

        channel = MockChannel(channel_type, config)
        notif = MockNotification(test_title, test_msg)

        try:
            if channel_type == "email":
                resp_text, http_code, duration_ms = EmailDeliveryHandler.send(channel, notif)
            elif channel_type == "slack":
                resp_text, http_code, duration_ms = SlackDeliveryHandler.send(channel, notif)
            elif channel_type == "teams":
                resp_text, http_code, duration_ms = TeamsDeliveryHandler.send(channel, notif)
            elif channel_type == "discord":
                resp_text, http_code, duration_ms = DiscordDeliveryHandler.send(channel, notif)
            elif channel_type == "telegram":
                resp_text, http_code, duration_ms = TelegramDeliveryHandler.send(channel, notif)
            elif channel_type == "webhook":
                resp_text, http_code, duration_ms = WebhookDeliveryHandler.send(channel, notif)
            else:
                raise ValueError(f"Tipo de canal no soportado: {channel_type}")

            return {
                "success": True,
                "status_code": http_code,
                "duration_ms": duration_ms,
                "message": resp_text,
            }
        except Exception as exc:
            duration_ms = int((time.monotonic() - t0) * 1000)
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
            return {
                "success": False,
                "status_code": status_code,
                "duration_ms": duration_ms,
                "message": str(exc),
            }

    @staticmethod
    def retry_notification(notification_id, organization_id):
        """Re-dispatch a failed or pending notification in 1-click."""
        notification = Notification.objects.get(
            id=notification_id, organization_id=organization_id
        )
        notification.retry_count += 1
        notification.status = Notification.Status.PENDING
        notification.error_message = ""
        notification.save(update_fields=["retry_count", "status", "error_message"])

        NotificationService.send_notification(notification.id)
        notification.refresh_from_db()
        return notification

    @staticmethod
    def export_csv(organization_id):
        """Export recent notification audit logs as CSV with UTF-8 BOM."""
        output = io.StringIO()
        output.write('\ufeff')
        writer = csv.writer(output)
        writer.writerow([
            "ID",
            "Fecha y Hora",
            "Canal",
            "Tipo",
            "Título",
            "Severidad",
            "Tipo de Evento",
            "Estado",
            "Código HTTP",
            "Duración (ms)",
            "Reintentos",
            "Respuesta",
            "Error",
        ])

        notifications = Notification.objects.filter(
            organization_id=organization_id
        ).select_related("channel").order_by("-created_at")[:500]

        for n in notifications:
            writer.writerow([
                str(n.id),
                n.created_at.strftime("%Y-%m-%d %H:%M:%S") if n.created_at else "",
                n.channel.name if n.channel else "N/A",
                n.channel.channel_type if n.channel else "N/A",
                n.title,
                n.severity,
                n.event_type,
                n.status,
                n.http_status if n.http_status is not None else "",
                n.duration_ms,
                n.retry_count,
                n.response.replace("\n", " ") if n.response else "",
                n.error_message.replace("\n", " ") if n.error_message else "",
            ])
        return output.getvalue()

    @staticmethod
    def get_notification_stats(organization_id):
        """Returns comprehensive KPI statistics for notifications."""
        channels = NotificationChannel.objects.filter(organization_id=organization_id)
        notifications = Notification.objects.filter(organization_id=organization_id)

        total_channels = channels.count()
        enabled_channels = channels.filter(enabled=True).count()
        total_sent = notifications.filter(status=Notification.Status.SENT).count()
        total_failed = notifications.filter(status=Notification.Status.FAILED).count()
        active_types_count = channels.values("channel_type").distinct().count()

        total_deliveries = total_sent + total_failed
        success_rate = round((total_sent / total_deliveries) * 100, 1) if total_deliveries > 0 else 100.0

        avg_dur = notifications.filter(duration_ms__gt=0).aggregate(Avg("duration_ms"))["duration_ms__avg"]
        avg_duration_ms = round(avg_dur, 1) if avg_dur else 0.0

        quiet_hours_active = channels.filter(enabled=True, quiet_hours_enabled=True).count()

        return {
            "total_channels": total_channels,
            "enabled_channels": enabled_channels,
            "total_sent": total_sent,
            "total_failed": total_failed,
            "active_types_count": active_types_count,
            "success_rate": success_rate,
            "avg_duration_ms": avg_duration_ms,
            "quiet_hours_active": quiet_hours_active,
        }


class EmailDeliveryHandler:
    """Handles email notification delivery via custom or default SMTP."""

    @staticmethod
    def send(channel, notification):
        t0 = time.monotonic()
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

        duration_ms = int((time.monotonic() - t0) * 1000)
        return (f"Email enviado a {len(recipients)} destinatarios vía {smtp_host or 'SMTP por defecto'}.", 250, duration_ms)


class SlackDeliveryHandler:
    """Handles Slack notification delivery via Incoming Webhook."""

    @staticmethod
    def send(channel, notification):
        t0 = time.monotonic()
        config = channel.config or {}
        webhook_url = config.get("webhook_url")

        if not webhook_url:
            raise ValueError("No webhook_url configured for Slack channel.")

        payload = {
            "text": f"*{notification.title}*\n{notification.message}",
        }

        response = requests.post(webhook_url, json=payload, timeout=10)
        duration_ms = int((time.monotonic() - t0) * 1000)
        response.raise_for_status()

        return (f"Notificación de Slack enviada (HTTP {response.status_code}).", response.status_code, duration_ms)


class TeamsDeliveryHandler:
    """Handles Microsoft Teams notification delivery via Incoming Webhook."""

    @staticmethod
    def send(channel, notification):
        t0 = time.monotonic()
        config = channel.config or {}
        webhook_url = config.get("webhook_url")

        if not webhook_url:
            raise ValueError("No webhook_url configured for Teams channel.")

        payload = {
            "@type": "MessageCard",
            "@context": "http://schema.org/extensions",
            "themeColor": "FF0000" if "critical" in getattr(notification, "severity", "").lower() or "critical" in notification.title.lower() else "FFA500",
            "summary": notification.title,
            "sections": [
                {
                    "activityTitle": notification.title,
                    "text": notification.message,
                }
            ],
        }

        response = requests.post(webhook_url, json=payload, timeout=10)
        duration_ms = int((time.monotonic() - t0) * 1000)
        response.raise_for_status()

        return (f"Notificación de Teams enviada (HTTP {response.status_code}).", response.status_code, duration_ms)


class WebhookDeliveryHandler:
    """Handles generic webhook notification delivery."""

    @staticmethod
    def send(channel, notification):
        t0 = time.monotonic()
        config = channel.config or {}
        webhook_url = config.get("webhook_url")
        headers = config.get("headers", {})

        if not webhook_url:
            raise ValueError("No webhook_url configured for webhook channel.")

        payload = {
            "title": notification.title,
            "message": notification.message,
            "severity": getattr(notification, "severity", "info"),
            "event_type": getattr(notification, "event_type", "alert_triggered"),
            "alert_id": str(notification.alert_id) if notification.alert_id else None,
            "notification_id": str(notification.id),
        }

        response = requests.post(
            webhook_url,
            json=payload,
            headers=headers,
            timeout=10,
        )
        duration_ms = int((time.monotonic() - t0) * 1000)
        response.raise_for_status()

        return (f"Webhook genérico enviado (HTTP {response.status_code}).", response.status_code, duration_ms)


class DiscordDeliveryHandler:
    """Handles Discord notification delivery via Webhook."""

    @staticmethod
    def send(channel, notification):
        t0 = time.monotonic()
        config = channel.config or {}
        webhook_url = config.get("webhook_url")

        if not webhook_url:
            raise ValueError("No webhook_url configured for Discord channel.")

        payload = {
            "content": f"**{notification.title}**\n{notification.message}",
        }

        response = requests.post(webhook_url, json=payload, timeout=10)
        duration_ms = int((time.monotonic() - t0) * 1000)
        response.raise_for_status()

        return (f"Notificación de Discord enviada (HTTP {response.status_code}).", response.status_code, duration_ms)


class TelegramDeliveryHandler:
    """Handles Telegram notification delivery via Bot API."""

    @staticmethod
    def send(channel, notification):
        t0 = time.monotonic()
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
        duration_ms = int((time.monotonic() - t0) * 1000)
        response.raise_for_status()

        return (f"Mensaje de Telegram enviado al chat {chat_id} (HTTP {response.status_code}).", response.status_code, duration_ms)