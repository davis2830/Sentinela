from django.db import models

from common.models import OrganizationOwnedModel


class Report(OrganizationOwnedModel):
    """Represents a generated report for an organization.

    Reports aggregate data from monitoring, SSL, DNS, incidents,
    and other modules to provide insights and metrics.
    """

    class ReportType(models.TextChoices):
        SLA = "sla", "SLA"
        AVAILABILITY = "availability", "Availability"
        SSL = "ssl", "SSL"
        INCIDENTS = "incidents", "Incidents"
        TRENDS = "trends", "Trends"
        SUMMARY = "summary", "Summary"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        GENERATING = "generating", "Generating"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    report_type = models.CharField(
        max_length=20,
        choices=ReportType.choices,
    )
    title = models.CharField(max_length=500)
    parameters = models.JSONField(
        default=dict,
        blank=True,
        help_text="Report generation parameters (date range, targets, etc.)",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Generated report data",
    )
    error_message = models.TextField(blank=True)
    generated_at = models.DateTimeField(null=True, blank=True)
    period_start = models.DateTimeField(null=True, blank=True)
    period_end = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        db_table = "reports_report"
        indexes = [
            models.Index(fields=["organization", "-created_at"]),
            models.Index(fields=["report_type"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.report_type} / {self.status})"