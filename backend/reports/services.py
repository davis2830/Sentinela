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
    def get_live_sla_metrics(organization_id, target_sla=99.9, days=30):
        """Compute real-time live SLA, error budget, and target breakdown."""
        from monitoring.models import MonitoringTarget

        days = int(days)
        target_sla = float(target_sla)
        period_end = timezone.now()
        period_start = period_end - timedelta(days=days)
        total_period_minutes = days * 24 * 60
        allowed_downtime_minutes = total_period_minutes * (1.0 - (target_sla / 100.0))

        targets = MonitoringTarget.objects.filter(
            organization_id=organization_id, enabled=True
        )

        target_metrics = []
        for target in targets:
            checks = target.checks.filter(
                checked_at__gte=period_start,
                checked_at__lte=period_end,
            )
            total = checks.count()
            up = checks.filter(status="up").count()
            down = checks.filter(status="down").count()
            uptime_pct = (up / total * 100.0) if total > 0 else 100.0
            downtime_ratio = 1.0 - (uptime_pct / 100.0)
            consumed_budget = round(total_period_minutes * downtime_ratio, 1)

            latencies = [c.latency for c in checks if c.latency is not None]
            avg_latency = round(sum(latencies) / len(latencies), 1) if latencies else 0.0

            if consumed_budget > allowed_downtime_minutes:
                burn_rate = "exhausted"
            elif consumed_budget > (allowed_downtime_minutes * 0.75):
                burn_rate = "fast"
            elif consumed_budget > 0:
                burn_rate = "normal"
            else:
                burn_rate = "none"

            target_metrics.append({
                "target_id": str(target.id),
                "target_name": target.name,
                "target_type": target.target_type,
                "endpoint": target.endpoint,
                "uptime_percentage": round(uptime_pct, 2),
                "avg_latency_ms": avg_latency,
                "total_checks": total,
                "up_checks": up,
                "down_checks": down,
                "consumed_budget_minutes": consumed_budget,
                "burn_rate": burn_rate,
                "meets_sla": uptime_pct >= target_sla,
            })

        overall_sla = (
            round(sum(t["uptime_percentage"] for t in target_metrics) / len(target_metrics), 2)
            if target_metrics
            else 100.0
        )
        avg_consumed_downtime = (
            round(sum(t["consumed_budget_minutes"] for t in target_metrics) / len(target_metrics), 1)
            if target_metrics
            else 0.0
        )
        remaining_budget = max(0.0, round(allowed_downtime_minutes - avg_consumed_downtime, 1))
        consumed_pct = (
            round((avg_consumed_downtime / allowed_downtime_minutes * 100.0), 1)
            if allowed_downtime_minutes > 0
            else 0.0
        )

        mttr_mttd = ReportService.calculate_mttr_mttd(organization_id, period_start, period_end)
        meeting_sla = sum(1 for t in target_metrics if t["meets_sla"])
        failing_sla = len(target_metrics) - meeting_sla

        return {
            "period_days": days,
            "target_sla": target_sla,
            "current_sla": overall_sla,
            "total_error_budget_minutes": round(allowed_downtime_minutes, 1),
            "consumed_error_budget_minutes": avg_consumed_downtime,
            "remaining_error_budget_minutes": remaining_budget,
            "consumed_percentage": min(consumed_pct, 100.0),
            "mttr_minutes": mttr_mttd["mttr_minutes"],
            "mttd_minutes": mttr_mttd["mttd_minutes"],
            "total_targets": len(target_metrics),
            "meeting_sla": meeting_sla,
            "failing_sla": failing_sla,
            "targets": target_metrics,
        }

    @staticmethod
    @transaction.atomic
    def bulk_action(organization_id, action, report_ids):
        """Execute bulk operations on reports atomically."""
        if action == "delete":
            deleted_count, _ = Report.objects.filter(
                organization_id=organization_id, id__in=report_ids
            ).delete()
            return {"action": "delete", "affected": deleted_count}
        raise ValueError(f"Acción no soportada: {action}")

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
        if report.parameters and report.parameters.get("target_ids"):
            targets = targets.filter(id__in=report.parameters["target_ids"])

        target_sla = float(report.parameters.get("sla_target", 99.9)) if report.parameters else 99.9
        total_seconds = max((period_end - period_start).total_seconds(), 60.0)
        total_period_minutes = total_seconds / 60.0
        allowed_downtime_minutes = total_period_minutes * (1.0 - (target_sla / 100.0))

        results = []
        for target in targets:
            checks = target.checks.filter(
                checked_at__gte=period_start,
                checked_at__lte=period_end,
            )
            total = checks.count()
            up = checks.filter(status="up").count()
            down = checks.filter(status="down").count()
            sla_percentage = (up / total * 100.0) if total > 0 else 100.0
            downtime_ratio = 1.0 - (sla_percentage / 100.0)
            consumed_downtime = round(total_period_minutes * downtime_ratio, 1)

            results.append({
                "target_id": str(target.id),
                "target_name": target.name,
                "target_type": target.target_type,
                "endpoint": target.endpoint,
                "total_checks": total,
                "up_checks": up,
                "down_checks": down,
                "sla_percentage": round(sla_percentage, 2),
                "consumed_downtime_minutes": consumed_downtime,
                "meets_sla": sla_percentage >= target_sla,
            })

        overall_sla = (
            sum(r["sla_percentage"] for r in results) / len(results)
            if results else 100.0
        )
        avg_consumed = (
            round(sum(r["consumed_downtime_minutes"] for r in results) / len(results), 1)
            if results else 0.0
        )
        remaining_budget = max(0.0, round(allowed_downtime_minutes - avg_consumed, 1))
        budget_pct = (
            round((avg_consumed / allowed_downtime_minutes * 100.0), 1)
            if allowed_downtime_minutes > 0 else 0.0
        )

        mttr_mttd = ReportService.calculate_mttr_mttd(
            report.organization_id, period_start, period_end
        )

        return {
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "target_sla": target_sla,
            "overall_sla": round(overall_sla, 2),
            "allowed_downtime_minutes": round(allowed_downtime_minutes, 1),
            "consumed_downtime_minutes": avg_consumed,
            "remaining_budget_minutes": remaining_budget,
            "budget_consumed_percentage": min(budget_pct, 100.0),
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
        if report.parameters and report.parameters.get("target_ids"):
            targets = targets.filter(id__in=report.parameters["target_ids"])

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
        if report.parameters and report.parameters.get("target_ids"):
            targets = targets.filter(id__in=report.parameters["target_ids"])

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
        """Generate CSV file content for a report with UTF-8 BOM."""
        output = io.StringIO()
        # UTF-8 BOM to prevent character mangling in Excel
        output.write('\ufeff')
        writer = csv.writer(output)

        writer.writerow(["REPORTE", report.title])
        writer.writerow(["TIPO", report.report_type.upper()])
        writer.writerow(["ESTADO", report.status.upper()])
        writer.writerow(["GENERADO", report.generated_at.strftime("%Y-%m-%d %H:%M:%S") if report.generated_at else "N/A"])
        writer.writerow(["PERIODO INICIO", report.period_start.strftime("%Y-%m-%d %H:%M:%S") if report.period_start else "N/A"])
        writer.writerow(["PERIODO FIN", report.period_end.strftime("%Y-%m-%d %H:%M:%S") if report.period_end else "N/A"])
        writer.writerow([])

        data = report.data or {}

        if report.report_type == "sla":
            writer.writerow(["METRICA RESUMEN", "VALOR"])
            writer.writerow(["SLA Global", f"{data.get('overall_sla', 100.0)}%"])
            writer.writerow(["SLA Contractual Objetivo", f"{data.get('target_sla', 99.9)}%"])
            writer.writerow(["Error Budget Total (min)", data.get('allowed_downtime_minutes', 0)])
            writer.writerow(["Error Budget Consumido (min)", data.get('consumed_downtime_minutes', 0)])
            writer.writerow(["Error Budget Restante (min)", data.get('remaining_budget_minutes', 0)])
            writer.writerow(["Presupuesto Consumido (%)", f"{data.get('budget_consumed_percentage', 0)}%"])
            writer.writerow(["MTTR (min)", data.get('mttr_minutes', 0)])
            writer.writerow(["MTTD (min)", data.get('mttd_minutes', 0)])
            writer.writerow(["Total Incidentes", data.get('total_incidents', 0)])
            writer.writerow([])

            targets = data.get("targets", [])
            if targets:
                writer.writerow(["TARGET ID", "NOMBRE", "TIPO", "ENDPOINT", "TOTAL CHECKS", "UP", "DOWN", "SLA (%)", "DOWNTIME (MIN)", "CUMPLE SLA"])
                for t in targets:
                    writer.writerow([
                        t.get("target_id"),
                        t.get("target_name"),
                        t.get("target_type"),
                        t.get("endpoint"),
                        t.get("total_checks", 0),
                        t.get("up_checks", 0),
                        t.get("down_checks", 0),
                        f"{t.get('sla_percentage', 100.0)}%",
                        t.get("consumed_downtime_minutes", 0),
                        "SI" if t.get("meets_sla", True) else "NO",
                    ])
        elif report.report_type == "availability":
            targets = data.get("targets", [])
            if targets:
                writer.writerow(["TARGET ID", "NOMBRE", "ENDPOINT", "TOTAL CHECKS", "UP", "DOWN", "SLOW", "ERROR", "DISPONIBILIDAD (%)", "DOWNTIME (%)"])
                for t in targets:
                    writer.writerow([
                        t.get("target_id"),
                        t.get("target_name"),
                        t.get("endpoint"),
                        t.get("total_checks", 0),
                        t.get("up", 0),
                        t.get("down", 0),
                        t.get("slow", 0),
                        t.get("error", 0),
                        f"{t.get('availability_percentage', 100.0)}%",
                        f"{t.get('downtime_percentage', 0.0)}%",
                    ])
        elif report.report_type == "trends":
            targets = data.get("targets", [])
            if targets:
                writer.writerow(["TARGET ID", "NOMBRE", "TOTAL CHECKS", "LATENCIA PROMEDIO (MS)", "LATENCIA MAXIMA (MS)", "LATENCIA MINIMA (MS)"])
                for t in targets:
                    writer.writerow([
                        t.get("target_id"),
                        t.get("target_name"),
                        t.get("total_checks", 0),
                        t.get("avg_latency_ms", 0),
                        t.get("max_latency_ms", 0),
                        t.get("min_latency_ms", 0),
                    ])
        elif report.report_type == "ssl":
            certs = data.get("certificates", [])
            if certs:
                writer.writerow(["DOMINIO", "EMISOR", "FECHA EXPIRACION", "DIAS RESTANTES", "ESTADO VALIDO", "ULTIMO ESCANEO"])
                for c in certs:
                    writer.writerow([
                        c.get("domain"),
                        c.get("issuer"),
                        c.get("expiration_date", "N/A"),
                        c.get("days_remaining", "N/A"),
                        "SI" if c.get("is_valid") else "NO",
                        c.get("last_scanned_at", "N/A"),
                    ])
        elif report.report_type == "incidents":
            writer.writerow(["METRICA RESUMEN", "VALOR"])
            writer.writerow(["Total Incidentes", data.get("total_incidents", 0)])
            writer.writerow(["MTTR (min)", data.get("mttr_minutes", 0)])
            writer.writerow(["MTTD (min)", data.get("mttd_minutes", 0)])
            writer.writerow([])
            incidents = data.get("incidents", [])
            if incidents:
                writer.writerow(["ID", "TITULO", "ESTADO", "PRIORIDAD", "FECHA APERTURA", "FECHA CIERRE"])
                for i in incidents:
                    writer.writerow([
                        i.get("id"),
                        i.get("title"),
                        i.get("status"),
                        i.get("priority"),
                        i.get("opened_at"),
                        i.get("closed_at", "N/A"),
                    ])
        elif report.report_type == "summary":
            summary = data.get("summary", {})
            writer.writerow(["METRICA RESUMEN EJECUTIVO", "VALOR"])
            writer.writerow(["SLA Global (%)", f"{summary.get('overall_sla_percentage', 100.0)}%"])
            writer.writerow(["MTTR (min)", summary.get("mttr_minutes", 0)])
            writer.writerow(["MTTD (min)", summary.get("mttd_minutes", 0)])
            writer.writerow(["Objetivos de Monitoreo Activos", summary.get("monitoring_targets", 0)])
            writer.writerow(["Certificados SSL", summary.get("ssl_certificates", 0)])
            writer.writerow(["Alertas Activas", summary.get("active_alerts", 0)])
            writer.writerow(["Incidentes Abiertos", summary.get("open_incidents", 0)])

        filename = f"reporte_{report.report_type}_{report.id.hex[:8]}.csv"
        return output.getvalue(), filename

    @staticmethod
    def export_html_pdf(report):
        """Generate executive HTML printable document for PDF export."""
        data = report.data or {}
        gen_at = report.generated_at.strftime("%Y-%m-%d %H:%M:%S") if report.generated_at else "N/A"
        p_start = report.period_start.strftime("%Y-%m-%d %H:%M") if report.period_start else "N/A"
        p_end = report.period_end.strftime("%Y-%m-%d %H:%M") if report.period_end else "N/A"

        targets = data.get("targets", [])
        overall_sla = data.get("overall_sla", data.get("summary", {}).get("overall_sla_percentage", 100.0))
        target_sla = data.get("target_sla", 99.9)
        mttr = data.get("mttr_minutes", data.get("summary", {}).get("mttr_minutes", 0.0))
        mttd = data.get("mttd_minutes", data.get("summary", {}).get("mttd_minutes", 0.0))
        total_incidents = data.get("total_incidents", data.get("summary", {}).get("open_incidents", 0))

        remaining_budget = data.get("remaining_budget_minutes", "N/A")
        allowed_budget = data.get("allowed_downtime_minutes", "N/A")

        rows_html = ""
        for t in targets:
            sla_val = t.get('sla_percentage', 100.0)
            is_pass = sla_val >= float(target_sla)
            badge_bg = "#DCFCE7" if is_pass else "#FEE2E2"
            badge_color = "#15803D" if is_pass else "#B91C1C"
            badge_text = "CUMPLE" if is_pass else "INCUMPLE"

            rows_html += f"""
            <tr>
                <td style="padding:10px 14px; border-bottom:1px solid #E2E8F0; font-weight:600; color:#0F172A;">{t.get('target_name', 'Servicio')}</td>
                <td style="padding:10px 14px; border-bottom:1px solid #E2E8F0; font-family:monospace; color:#475569; font-size:12px;">{t.get('endpoint', '-')}</td>
                <td style="padding:10px 14px; border-bottom:1px solid #E2E8F0; color:#334155;">{t.get('total_checks', 0):,}</td>
                <td style="padding:10px 14px; border-bottom:1px solid #E2E8F0; font-weight:700; color:#0F172A;">{sla_val}%</td>
                <td style="padding:10px 14px; border-bottom:1px solid #E2E8F0; text-align:center;">
                    <span style="display:inline-block; padding:3px 10px; border-radius:9999px; font-size:10px; font-weight:700; background:{badge_bg}; color:{badge_color};">
                        {badge_text}
                    </span>
                </td>
            </tr>
            """

        html_content = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Sentinel NOC - {report.title}</title>
    <style>
        @page {{ size: A4 portrait; margin: 15mm; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #0F172A;
            background: #FFFFFF;
            margin: 0;
            padding: 24px;
            line-height: 1.5;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }}
        .header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 3px solid #10B981;
            padding-bottom: 18px;
            margin-bottom: 24px;
        }}
        .brand {{ font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #0F172A; }}
        .brand span {{ color: #10B981; }}
        .badge-executive {{
            display: inline-block;
            background: #F1F5F9;
            border: 1px solid #CBD5E1;
            border-radius: 9999px;
            padding: 4px 12px;
            font-size: 11px;
            font-weight: 700;
            color: #475569;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .report-title {{ font-size: 22px; font-weight: 700; color: #0F172A; margin: 12px 0 4px 0; }}
        .report-meta {{ font-size: 12px; color: #64748B; }}
        
        .kpi-grid {{
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 14px;
            margin-bottom: 26px;
        }}
        .kpi-card {{
            background: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 12px;
            padding: 14px;
            text-align: left;
        }}
        .kpi-label {{
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            color: #64748B;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }}
        .kpi-value {{
            font-size: 24px;
            font-weight: 800;
            color: #0F172A;
            line-height: 1.1;
        }}
        .kpi-subtext {{ font-size: 11px; color: #94A3B8; margin-top: 4px; }}
        
        .section-title {{
            font-size: 14px;
            font-weight: 700;
            color: #0F172A;
            margin: 20px 0 10px 0;
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        
        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-top: 8px;
        }}
        th {{
            background: #F1F5F9;
            padding: 10px 14px;
            border-bottom: 2px solid #CBD5E1;
            text-transform: uppercase;
            font-size: 11px;
            font-weight: 700;
            color: #475569;
            text-align: left;
        }}
        
        .footer {{
            margin-top: 40px;
            padding-top: 16px;
            border-top: 1px solid #E2E8F0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
            color: #94A3B8;
        }}
        @media print {{
            body {{ padding: 0; }}
            .no-print {{ display: none; }}
        }}
    </style>
</head>
<body>
    <div class="header">
        <div>
            <div class="brand">SENTINEL <span>NOC</span></div>
            <div class="report-title">{report.title}</div>
            <div class="report-meta">
                Período auditado: <strong>{p_start}</strong> &mdash; <strong>{p_end}</strong> | Generado: <strong>{gen_at}</strong>
            </div>
        </div>
        <div>
            <span class="badge-executive">Informe Oficial {report.report_type.upper()}</span>
        </div>
    </div>

    <div class="kpi-grid">
        <div class="kpi-card" style="border-left: 4px solid #10B981;">
            <div class="kpi-label">SLA Global</div>
            <div class="kpi-value" style="color:#10B981;">{overall_sla}%</div>
            <div class="kpi-subtext">Objetivo: &ge; {target_sla}%</div>
        </div>
        <div class="kpi-card" style="border-left: 4px solid #3B82F6;">
            <div class="kpi-label">Error Budget Disp.</div>
            <div class="kpi-value" style="color:#3B82F6;">{remaining_budget}m</div>
            <div class="kpi-subtext">Límite Total: {allowed_budget}m</div>
        </div>
        <div class="kpi-card" style="border-left: 4px solid #F59E0B;">
            <div class="kpi-label">MTTR Promedio</div>
            <div class="kpi-value" style="color:#F59E0B;">{mttr}m</div>
            <div class="kpi-subtext">Tiempo Resolución</div>
        </div>
        <div class="kpi-card" style="border-left: 4px solid #8B5CF6;">
            <div class="kpi-label">Incidentes Período</div>
            <div class="kpi-value" style="color:#8B5CF6;">{total_incidents}</div>
            <div class="kpi-subtext">MTTD: {mttd}m</div>
        </div>
    </div>

    <div class="section-title">Desglose de Disponibilidad y Cumplimiento por Objetivo</div>
    <table>
        <thead>
            <tr>
                <th>Servicio / Target</th>
                <th>Endpoint / Recurso</th>
                <th>Chequeos</th>
                <th>Disponibilidad SLA</th>
                <th style="text-align:center;">Dictamen</th>
            </tr>
        </thead>
        <tbody>
            {rows_html if rows_html else '<tr><td colspan="5" style="padding:16px; text-align:center; color:#94A3B8;">No hay objetivos registrados en el período analizado.</td></tr>'}
        </tbody>
    </table>

    <div class="footer">
        <div>Sentinel Observability &bull; Plataforma Centralizada de Operaciones NOC</div>
        <div>Auditoría Criptográfica e Inmutabilidad de Métricas</div>
    </div>
</body>
</html>"""

        filename = f"reporte_{report.report_type}_{report.id.hex[:8]}.html"
        return html_content, filename