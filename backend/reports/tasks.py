import logging

from celery import shared_task

from .services import ReportService

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="reports.generate")
def generate_report_task(self, report_id):
    """Generate a report asynchronously.

    Delegates to ReportService which routes to the appropriate
    generator based on the report type.

    Args:
        report_id: UUID string of the Report.
    """
    logger.info("Generating report %s...", report_id)

    try:
        success = ReportService.generate_report(report_id)
        if success:
            logger.info("Report %s generated successfully.", report_id)
        else:
            logger.warning("Report %s generation failed.", report_id)
        return success
    except Exception as exc:
        logger.exception("Error generating report %s: %s", report_id, exc)
        return False