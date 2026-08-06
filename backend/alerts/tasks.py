import logging

from celery import shared_task

from .services import AlertEvaluatorService

logger = logging.getLogger(__name__)


@shared_task(name="alerts.evaluate_rules")
def evaluate_alert_rules():
    """Evaluate all enabled alert rules across all organizations.

    This task runs periodically via Celery Beat. It checks each
    enabled rule against the current state of monitoring data
    and creates alerts for any rules whose conditions are met.

    Returns:
        int: Number of alerts created.
    """
    logger.info("Starting alert rule evaluation...")

    try:
        alerts_created = AlertEvaluatorService.evaluate_all_rules()
        logger.info("Alert evaluation complete: %d alerts created.", alerts_created)
        return alerts_created
    except Exception as exc:
        logger.exception("Error evaluating alert rules: %s", exc)
        return 0