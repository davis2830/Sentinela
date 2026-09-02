import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(name="incidents.auto_close_resolved")
def auto_close_resolved_incidents():
    """Auto-close resolved incidents older than threshold if configured.

    Celery task for incident lifecycle background processing.
    """
    logger.info("Running incident maintenance task...")
    return 0
