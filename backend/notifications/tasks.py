import logging

from celery import shared_task

from .services import NotificationService

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="notifications.send")
def send_notification_task(self, notification_id):
    """Send a notification through its configured channel.

    Delegates to NotificationService which routes to the
    appropriate delivery handler (email, slack, teams, webhook).

    Args:
        notification_id: UUID string of the Notification.
    """
    logger.info("Sending notification %s...", notification_id)

    try:
        success = NotificationService.send_notification(notification_id)
        if success:
            logger.info("Notification %s sent successfully.", notification_id)
        else:
            logger.warning("Notification %s failed to send.", notification_id)
        return success
    except Exception as exc:
        logger.exception("Error sending notification %s: %s", notification_id, exc)
        return False


@shared_task(name="notifications.send_pending")
def send_pending_notifications():
    """Send all pending notifications.

    Runs periodically via Celery Beat to retry any
    notifications that are still in pending status.
    """
    from .models import Notification

    pending = Notification.objects.filter(status=Notification.Status.PENDING)
    count = 0

    for notification in pending:
        send_notification_task.delay(str(notification.id))
        count += 1

    logger.info("Scheduled %d pending notifications for delivery.", count)
    return count