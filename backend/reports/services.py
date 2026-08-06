from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .models import Report


class ReportService:
    """Service for report generation and management.

    Handles CRUD operations for reports and delegates
    data generation to specialized generators based on type.
    All business logic lives here, not in views.
    """

    @staticmethod
    def list_reports(organization_id, report_type=None):
        """Return reports for an organization with optional type filter."""
        qs = Report.objects.filter(organization_id=organization_id)
        if report_type:
            qs = qs.filter(report_type=report_type)
        return qs.order_by("-created_at")

    @staticmethod
    def get_report(report_id, organization_id):
        """Return a single report by ID within an organization."""
        return Report.objects.get(id=report_id, organization_id=organization_id)

    @staticmethod
    @transaction.atomic
    def create_report(
        organization_id,
        report_type,
        title,
        parameters=None,
        period_start=None,
        period_end=None,
    ):
        """Create a new report record.

        The actual data generation is handled by the generate_report
        Celery task.

        Args:
            organization_id: UUID of the organization.
            report_type: One of sla, availability, ssl, incidents, trends, summary.
            title: Report title.
            parameters: Optional dict of generation parameters.
            period_start: Optional start of the reporting period.
            period_end: Optional end of the reporting period.

        Returns:
            The created Report instance.
        """
        return Report.objects.create(
            organization_id=organization_id,
            report_type=report_type,
            title=title,
            parameters=parameters or {},
            period_start=period_start,
            period_end=period_end,
            status=Report.Status.PENDING,
        )

    @staticmethod
    @transaction.atomic
    def delete_report(report_id, organization_id):
        """Delete a report."""
        report = Report.objects.get(id=report_id, organization_id=organization_id)
        report.delete()

    @staticmethod
    @transaction.atomic
    def generate_report(report_id):
        """Generate report data based on the report type.

        Delegates to the appropriate generator and updates the
        report with the generated data.

        Args:
            report_id: UUID of the report to generate.

        Returns:
            bool: True if generation succeeded, False otherwise.
        """
        try:
            report = Report.objects.get(id=report_id)
        except Report.DoesNotExist:
            return False

        report.status = Report.Status.GENERATING
        report.save(update_fields=["status"])

        try:
            if report.report_type == "sla":
                data = SLAReportGenerator.generate(report)
            elif report.report_type == "availability":
                data = AvailabilityReportGenerator.generate(report)
            elif report.report_type == "ssl":
                data = SSLReportGenerator.generate(report)
            elif report.report_type == "incidents":
                data = IncidentsReportGenerator.generate(report)
            elif report.report_type == "trends":
                data = TrendsReportGenerator.generate(report)
            elif report.report_type == "summary":
                data = SummaryReportGenerator.generate(report)
            else:
                report.status = Report.Status.FAILED
                report.error_message = f"Unknown report type: {report.report_type}"
                report.save(update_fields=["status", "error_message"])
                return False

            report.data = data
            report.status = Report.Status.COMPLETED
            report.generated_at = timezone.now()
            report.save(update_fields=["data", "status", "generated_at"])
            return True

        except Exception as exc:
            report.status = Report.Status.FAILED
            report.error_message = str(exc)[:1000]
            report.save(update_fields=["status", "error_message"])
            return False


class SLAReportGenerator:
    """Generates SLA reports from monitoring data."""

    @staticmethod
    def generate(report):
        """Calculate SLA metrics for all monitoring targets.

        Returns:
            dict with targets SLA data.
        """
        from monitoring.models import MonitoringTarget

        period_start = report.period_start or (timezone.now() - timedelta(days=30))
        period_end = report.period_end or timezone.now()

        targets = MonitoringTarget.objects.filter(
            organization_id=report.organization_id
        )

        results = []
        for target in targets:
            checks = target.checks.filter(
                checked_at__gte=period_start,
                checked_at__lte=period_end,
            )
            total = checks.count()
            up = checks.filter(status="up").count()
            sla_percentage = (up / total * 100) if total > 0 else 0.0

            results.append({
                "target_id": str(target.id),
                "target_name": target.name,
                "target_type": target.target_type,
                "endpoint": target.endpoint,
                "total_checks": total,
                "up_checks": up,
                "sla_percentage": round(sla_percentage, 2),
            })

        overall_sla = (
            sum(r["sla_percentage"] for r in results) / len(results)
            if results else 0.0
        )

        return {
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "overall_sla": round(overall_sla, 2),
            "targets": results,
        }


class AvailabilityReportGenerator:
    """Generates availability reports from monitoring data."""

    @staticmethod
    def generate(report):
        """Calculate availability metrics for all monitoring targets.

        Similar to SLA but focuses on downtime analysis.
        """
        from monitoring.models import MonitoringTarget

        period_start = report.period_start or (timezone.now() - timedelta(days=30))
        period_end = report.period_end or timezone.now()

        targets = MonitoringTarget.objects.filter(
            organization_id=report.organization_id
        )

        results = []
        for target in targets:
            checks = target.checks.filter(
                checked_at__gte=period_start,
                checked_at__lte=period_end,
            )
            total = checks.count()
            up = checks.filter(status="up").count()
            down = checks.filter(status="down").count()
            slow = checks.filter(status="slow").count()
            error = checks.filter(status="error").count()

            availability = (up / total * 100) if total > 0 else 0.0
            downtime_pct = (down / total * 100) if total > 0 else 0.0

            results.append({
                "target_id": str(target.id),
                "target_name": target.name,
                "endpoint": target.endpoint,
                "total_checks": total,
                "up": up,
                "down": down,
                "slow": slow,
                "error": error,
                "availability_percentage": round(availability, 2),
                "downtime_percentage": round(downtime_pct, 2),
            })

        return {
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "targets": results,
        }


class SSLReportGenerator:
    """Generates SSL certificate reports."""

    @staticmethod
    def generate(report):
        """Summarize SSL certificate status for all domains."""
        from ssl_monitor.models import SSLCertificate

        certs = SSLCertificate.objects.filter(
            organization_id=report.organization_id
        )

        results = []
        for cert in certs:
            results.append({
                "domain": cert.domain,
                "issuer": cert.issuer,
                "expiration_date": cert.expiration_date.isoformat() if cert.expiration_date else None,
                "days_remaining": cert.days_remaining,
                "is_valid": cert.is_valid,
                "last_scanned_at": cert.last_scanned_at.isoformat() if cert.last_scanned_at else None,
                "error_message": cert.error_message,
            })

        valid_count = sum(1 for c in results if c["is_valid"])
        expiring_count = sum(
            1 for c in results
            if c["days_remaining"] is not None and c["days_remaining"] <= 15
        )
        expired_count = sum(
            1 for c in results
            if c["days_remaining"] is not None and c["days_remaining"] <= 0
        )

        return {
            "total_certificates": len(results),
            "valid": valid_count,
            "expiring_soon": expiring_count,
            "expired": expired_count,
            "certificates": results,
        }


class IncidentsReportGenerator:
    """Generates incident summary reports."""

    @staticmethod
    def generate(report):
        """Summarize incidents within the reporting period."""
        from incidents.models import Incident

        period_start = report.period_start or (timezone.now() - timedelta(days=30))
        period_end = report.period_end or timezone.now()

        incidents = Incident.objects.filter(
            organization_id=report.organization_id,
            opened_at__gte=period_start,
            opened_at__lte=period_end,
        )

        total = incidents.count()
        by_status = {
            "open": incidents.filter(status="open").count(),
            "investigating": incidents.filter(status="investigating").count(),
            "resolved": incidents.filter(status="resolved").count(),
            "closed": incidents.filter(status="closed").count(),
        }
        by_priority = {
            "critical": incidents.filter(priority="critical").count(),
            "high": incidents.filter(priority="high").count(),
            "medium": incidents.filter(priority="medium").count(),
            "low": incidents.filter(priority="low").count(),
        }

        incident_list = []
        for inc in incidents:
            incident_list.append({
                "id": str(inc.id),
                "title": inc.title,
                "status": inc.status,
                "priority": inc.priority,
                "opened_at": inc.opened_at.isoformat(),
                "closed_at": inc.closed_at.isoformat() if inc.closed_at else None,
            })

        return {
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "total_incidents": total,
            "by_status": by_status,
            "by_priority": by_priority,
            "incidents": incident_list,
        }


class TrendsReportGenerator:
    """Generates trend analysis reports."""

    @staticmethod
    def generate(report):
        """Analyze monitoring trends over the reporting period."""
        from monitoring.models import MonitoringTarget

        period_start = report.period_start or (timezone.now() - timedelta(days=30))
        period_end = report.period_end or timezone.now()

        targets = MonitoringTarget.objects.filter(
            organization_id=report.organization_id
        )

        results = []
        for target in targets:
            checks = target.checks.filter(
                checked_at__gte=period_start,
                checked_at__lte=period_end,
            ).order_by("checked_at")

            latencies = [c.latency for c in checks if c.latency is not None]
            avg_latency = sum(latencies) / len(latencies) if latencies else 0
            max_latency = max(latencies) if latencies else 0
            min_latency = min(latencies) if latencies else 0

            results.append({
                "target_id": str(target.id),
                "target_name": target.name,
                "total_checks": checks.count(),
                "avg_latency_ms": round(avg_latency, 2),
                "max_latency_ms": round(max_latency, 2),
                "min_latency_ms": round(min_latency, 2),
            })

        return {
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "targets": results,
        }


class SummaryReportGenerator:
    """Generates a comprehensive summary report."""

    @staticmethod
    def generate(report):
        """Generate a summary across all modules."""
        from alerts.models import Alert
        from incidents.models import Incident
        from monitoring.models import MonitoringTarget
        from ssl_monitor.models import SSLCertificate

        org_id = report.organization_id

        monitoring_count = MonitoringTarget.objects.filter(
            organization_id=org_id, enabled=True
        ).count()

        ssl_count = SSLCertificate.objects.filter(
            organization_id=org_id
        ).count()

        active_alerts = Alert.objects.filter(
            organization_id=org_id, status="active"
        ).count()

        open_incidents = Incident.objects.filter(
            organization_id=org_id, status__in=["open", "investigating"]
        ).count()

        return {
            "generated_at": timezone.now().isoformat(),
            "summary": {
                "monitoring_targets": monitoring_count,
                "ssl_certificates": ssl_count,
                "active_alerts": active_alerts,
                "open_incidents": open_incidents,
            },
        }