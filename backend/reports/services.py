import csv
import io
from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from .models import Report


class ReportService:
    """Service for report generation and management."""

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
    def calculate_mttr_mttd(organization_id, period_start, period_end):
        """Calculate Mean Time to Repair (MTTR) and Mean Time to Detect (MTTD) in minutes."""
        from incidents.models import Incident

        incidents = Incident.objects.filter(
            organization_id=organization_id,
            opened_at__gte=period_start,
            opened_at__lte=period_end,
        )

        resolved_incidents = [i for i in incidents if i.closed_at is not None]
        if resolved_incidents:
            total_repair_time_seconds = sum(
                (i.closed_at - i.opened_at).total_seconds() for i in resolved_incidents
            )
            mttr_minutes = round(total_repair_time_seconds / len(resolved_incidents) / 60.0, 1)
        else:
            mttr_minutes = 0.0

        # MTTD calculation (Detection lag or default 5 minutes)
        if incidents.exists():
            detection_times = []
            for i in incidents:
                lag = (i.opened_at - i.created_at).total_seconds() / 60.0
                detection_times.append(max(lag, 1.0))
            mttd_minutes = round(sum(detection_times) / len(detection_times), 1)
        else:
            mttd_minutes = 0.0

        return {
            "mttr_minutes": mttr_minutes,
            "mttd_minutes": mttd_minutes,
            "total_incidents": len(incidents),
            "resolved_incidents": len(resolved_incidents),
        }

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
        """Create a new report record and immediately trigger data generation."""
        report = Report.objects.create(
            organization_id=organization_id,
            report_type=report_type,
            title=title,
            parameters=parameters or {},
            period_start=period_start or (timezone.now() - timedelta(days=30)),
            period_end=period_end or timezone.now(),
            status=Report.Status.PENDING,
        )

        # Synchronously generate report data for instant UI response
        ReportService.generate_report(report.id)
        report.refresh_from_db()
        return report

    @staticmethod
    @transaction.atomic
    def delete_report(report_id, organization_id):
        """Delete a report."""
        report = Report.objects.get(id=report_id, organization_id=organization_id)
        report.delete()

    @staticmethod
    @transaction.atomic
    def generate_report(report_id):
        """Generate report data based on the report type."""
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
    """Generates SLA reports from monitoring & API data."""

    @staticmethod
    def generate(report):
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
            sla_percentage = (up / total * 100) if total > 0 else 100.0

            results.append({
                "target_id": str(target.id),
                "target_name": target.name,
                "target_type": target.target_type,
                "endpoint": target.endpoint,
                "total_checks": total,
                "up_checks": up,
                "down_checks": down,
                "sla_percentage": round(sla_percentage, 2),
            })

        overall_sla = (
            sum(r["sla_percentage"] for r in results) / len(results)
            if results else 100.0
        )

        mttr_mttd = ReportService.calculate_mttr_mttd(
            report.organization_id, period_start, period_end
        )

        return {
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "overall_sla": round(overall_sla, 2),
            "mttr_minutes": mttr_mttd["mttr_minutes"],
            "mttd_minutes": mttr_mttd["mttd_minutes"],
            "total_incidents": mttr_mttd["total_incidents"],
            "targets": results,
        }


class AvailabilityReportGenerator:
    """Generates availability reports from monitoring data."""

    @staticmethod
    def generate(report):
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

            availability = (up / total * 100) if total > 0 else 100.0
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
    """Generates incident summary reports with MTTR and MTTD."""

    @staticmethod
    def generate(report):
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
            "identified": incidents.filter(status="identified").count(),
            "mitigated": incidents.filter(status="mitigated").count(),
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

        mttr_mttd = ReportService.calculate_mttr_mttd(
            report.organization_id, period_start, period_end
        )

        return {
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "total_incidents": total,
            "mttr_minutes": mttr_mttd["mttr_minutes"],
            "mttd_minutes": mttr_mttd["mttd_minutes"],
            "by_status": by_status,
            "by_priority": by_priority,
            "incidents": incident_list,
        }


class TrendsReportGenerator:
    """Generates trend analysis reports."""

    @staticmethod
    def generate(report):
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
    """Generates a comprehensive summary report across all modules."""

    @staticmethod
    def generate(report):
        from alerts.models import Alert
        from incidents.models import Incident
        from monitoring.models import MonitoringTarget
        from ssl_monitor.models import SSLCertificate

        org_id = report.organization_id
        period_start = report.period_start or (timezone.now() - timedelta(days=30))
        period_end = report.period_end or timezone.now()

        monitoring_targets = MonitoringTarget.objects.filter(
            organization_id=org_id, enabled=True
        )

        ssl_count = SSLCertificate.objects.filter(organization_id=org_id).count()
        active_alerts = Alert.objects.filter(organization_id=org_id, status="active").count()
        open_incidents = Incident.objects.filter(
            organization_id=org_id, status__in=["open", "investigating", "identified", "mitigated"]
        ).count()

        mttr_mttd = ReportService.calculate_mttr_mttd(org_id, period_start, period_end)

        # Calculate overall SLA
        total_checks = 0
        total_up = 0
        for t in monitoring_targets:
            c_qs = t.checks.filter(checked_at__gte=period_start, checked_at__lte=period_end)
            t_cnt = c_qs.count()
            u_cnt = c_qs.filter(status="up").count()
            total_checks += t_cnt
            total_up += u_cnt

        overall_sla = round((total_up / total_checks * 100), 2) if total_checks > 0 else 100.0

        return {
            "generated_at": timezone.now().isoformat(),
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "summary": {
                "overall_sla_percentage": overall_sla,
                "mttr_minutes": mttr_mttd["mttr_minutes"],
                "mttd_minutes": mttr_mttd["mttd_minutes"],
                "monitoring_targets": len(monitoring_targets),
                "ssl_certificates": ssl_count,
                "active_alerts": active_alerts,
                "open_incidents": open_incidents,
            },
        }


class ReportExporter:
    """Handles exporting report data into CSV or HTML/PDF formats."""

    @staticmethod
    def export_csv(report):
        """Generate CSV file content for a report."""
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(["REPORT TITLE", report.title])
        writer.writerow(["REPORT TYPE", report.report_type.upper()])
        writer.writerow(["GENERATED AT", report.generated_at.strftime("%Y-%m-%d %H:%M:%S") if report.generated_at else "N/A"])
        writer.writerow([])

        data = report.data or {}

        if report.report_type in ["sla", "availability", "trends"]:
            targets = data.get("targets", [])
            if targets:
                headers = list(targets[0].keys())
                writer.writerow([h.upper().replace("_", " ") for h in headers])
                for t in targets:
                    writer.writerow([t.get(h, "") for h in headers])
        elif report.report_type == "incidents":
            incidents = data.get("incidents", [])
            if incidents:
                writer.writerow(["ID", "TITLE", "STATUS", "PRIORITY", "OPENED AT", "CLOSED AT"])
                for i in incidents:
                    writer.writerow([
                        i.get("id"),
                        i.get("title"),
                        i.get("status"),
                        i.get("priority"),
                        i.get("opened_at"),
                        i.get("closed_at", "N/A"),
                    ])

        filename = f"report_{report.report_type}_{report.id.hex[:8]}.csv"
        return output.getvalue(), filename

    @staticmethod
    def export_html_pdf(report):
        """Generate executive HTML printable document for PDF export."""
        data = report.data or {}
        gen_at = report.generated_at.strftime("%Y-%m-%d %H:%M:%S") if report.generated_at else "N/A"
        p_start = report.period_start.strftime("%Y-%m-%d") if report.period_start else "N/A"
        p_end = report.period_end.strftime("%Y-%m-%d") if report.period_end else "N/A"

        targets = data.get("targets", [])
        overall_sla = data.get("overall_sla", data.get("summary", {}).get("overall_sla_percentage", 100.0))
        mttr = data.get("mttr_minutes", data.get("summary", {}).get("mttr_minutes", 0.0))
        mttd = data.get("mttd_minutes", data.get("summary", {}).get("mttd_minutes", 0.0))

        rows_html = ""
        for t in targets:
            rows_html += f"""
            <tr>
                <td style="padding:10px; border-bottom:1px solid #E5E7EB; font-weight:bold;">{t.get('target_name', 'Servicio')}</td>
                <td style="padding:10px; border-bottom:1px solid #E5E7EB;">{t.get('endpoint', '-')}</td>
                <td style="padding:10px; border-bottom:1px solid #E5E7EB;">{t.get('total_checks', 0)}</td>
                <td style="padding:10px; border-bottom:1px solid #E5E7EB; font-weight:bold; color:#10B981;">{t.get('sla_percentage', 100.0)}%</td>
            </tr>
            """

        html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{report.title}</title>
    <style>
        body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111827; margin: 40px; line-height: 1.5; }}
        .header {{ border-bottom: 2px solid #10B981; padding-bottom: 20px; margin-bottom: 30px; }}
        .title {{ font-size: 24px; font-weight: bold; color: #111827; margin: 0; }}
        .subtitle {{ font-size: 14px; color: #6B7280; margin-top: 5px; }}
        .kpi-container {{ display: flex; gap: 20px; margin-bottom: 30px; }}
        .kpi-card {{ flex: 1; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 15px; text-align: center; }}
        .kpi-value {{ font-size: 22px; font-weight: bold; color: #10B981; margin-top: 5px; }}
        .kpi-label {{ font-size: 11px; text-transform: uppercase; color: #6B7280; font-weight: bold; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 20px; text-align: left; font-size: 13px; }}
        th {{ background: #F3F4F6; padding: 10px; border-bottom: 2px solid #E5E7EB; text-transform: uppercase; font-size: 11px; color: #374151; }}
        .footer {{ margin-top: 50px; font-size: 11px; color: #9CA3AF; text-align: center; border-top: 1px solid #E5E7EB; padding-top: 20px; }}
    </style>
</head>
<body>
    <div class="header">
        <div class="title">Sentinela &bull; {report.title}</div>
        <div class="subtitle">Informe Ejecutivo de Cumplimiento de SLA y Métricas de Disponibilidad</div>
        <div style="font-size:12px; color:#4B5563; margin-top:10px;">
            Período: <strong>{p_start}</strong> al <strong>{p_end}</strong> | Generado el: <strong>{gen_at}</strong>
        </div>
    </div>

    <div class="kpi-container">
        <div class="kpi-card">
            <div class="kpi-label">Cumplimiento de SLA Global</div>
            <div class="kpi-value">{overall_sla}%</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">MTTR (Tiempo Medio Reparación)</div>
            <div class="kpi-value" style="color:#3B82F6;">{mttr} min</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">MTTD (Tiempo Medio Detección)</div>
            <div class="kpi-value" style="color:#F59E0B;">{mttd} min</div>
        </div>
    </div>

    <h3>Desglose de Cumplimiento por Objetivo Monitoreado</h3>
    <table>
        <thead>
            <tr>
                <th>Servicio / Target</th>
                <th>Endpoint / Recurso</th>
                <th>Verificaciones</th>
                <th>SLA Cumplido (%)</th>
            </tr>
        </thead>
        <tbody>
            {rows_html if rows_html else '<tr><td colspan="4" style="padding:15px; text-align:center;">No hay objetivos registrados en el período.</td></tr>'}
        </tbody>
    </table>

    <div class="footer">
        Este documento es un informe ejecutivo oficial generado automáticamente por la Plataforma de Observabilidad Sentinela.
    </div>
</body>
</html>"""

        filename = f"report_{report.report_type}_{report.id.hex[:8]}.html"
        return html_content, filename