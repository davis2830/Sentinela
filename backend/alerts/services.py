import logging
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .models import Alert, AlertRule

logger = logging.getLogger(__name__)


class AlertRuleService:
    """Service for alert rule management.

    Handles CRUD operations for alert rules.
    All business logic lives here, not in views.
    """

    @staticmethod
    def list_rules(organization_id):
        """Return all alert rules for an organization."""
        return AlertRule.objects.filter(
            organization_id=organization_id
        ).order_by("-created_at")

    @staticmethod
    def get_rule(rule_id, organization_id):
        """Return a single alert rule by ID within an organization."""
        return AlertRule.objects.get(id=rule_id, organization_id=organization_id)

    @staticmethod
    @transaction.atomic
    def create_rule(
        organization_id,
        name,
        target_type,
        condition,
        threshold=0,
        severity="warning",
        enabled=True,
        target_id=None,
    ):
        """Create a new alert rule."""
        return AlertRule.objects.create(
            organization_id=organization_id,
            name=name,
            target_type=target_type,
            condition=condition,
            threshold=threshold,
            severity=severity,
            enabled=enabled,
            target_id=target_id,
        )

    @staticmethod
    @transaction.atomic
    def update_rule(rule_id, organization_id, **fields):
        """Update an existing alert rule."""
        rule = AlertRule.objects.get(id=rule_id, organization_id=organization_id)
        for field, value in fields.items():
            if value is not None:
                setattr(rule, field, value)
        rule.save()
        return rule

    @staticmethod
    @transaction.atomic
    def delete_rule(rule_id, organization_id):
        """Delete an alert rule."""
        rule = AlertRule.objects.get(id=rule_id, organization_id=organization_id)
        rule.delete()


class AlertService:
    """Service for alert management.

    Handles listing, acknowledging, and resolving alerts.
    """

    @staticmethod
    def list_alerts(organization_id, status_filter=None, severity_filter=None):
        """Return alerts for an organization with optional filters.

        Args:
            organization_id: UUID of the organization.
            status_filter: Optional status filter (active, acknowledged, resolved).
            severity_filter: Optional severity filter (critical, warning, info).

        Returns:
            QuerySet of Alert instances.
        """
        qs = Alert.objects.filter(organization_id=organization_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if severity_filter:
            qs = qs.filter(severity=severity_filter)
        return qs.order_by("-triggered_at")

    @staticmethod
    def get_alert(alert_id, organization_id):
        """Return a single alert by ID within an organization."""
        return Alert.objects.get(id=alert_id, organization_id=organization_id)

    @staticmethod
    @transaction.atomic
    def acknowledge_alert(alert_id, organization_id):
        """Mark an alert as acknowledged.

        Args:
            alert_id: UUID of the alert.
            organization_id: UUID of the organization.

        Returns:
            The updated Alert instance.
        """
        alert = Alert.objects.get(id=alert_id, organization_id=organization_id)
        alert.status = Alert.Status.ACKNOWLEDGED
        alert.save(update_fields=["status"])
        return alert

    @staticmethod
    @transaction.atomic
    def resolve_alert(alert_id, organization_id):
        """Mark an alert as resolved."""
        alert = Alert.objects.get(id=alert_id, organization_id=organization_id)
        if alert.status != Alert.Status.RESOLVED:
            alert.status = Alert.Status.RESOLVED
            alert.resolved_at = timezone.now()
            alert.save(update_fields=["status", "resolved_at"])

            try:
                from notifications.services import NotificationService
                rule_name = alert.rule.name if alert.rule else alert.title
                now_str = alert.resolved_at.strftime("%Y-%m-%d %H:%M:%S UTC")
                title = f"✅ [RESOLVED] {alert.title}"
                body = (
                    f"✅ **[RESOLVED] ALERTA RESUELTA**\n\n"
                    f"• **Estado**: `RESOLVED` ✅\n"
                    f"• **Severidad Previa**: `{alert.severity.upper()}`\n"
                    f"• **Origen**: `{alert.target_type.upper() if alert.target_type else 'SISTEMA'}`\n"
                    f"• **Regla**: `{rule_name}`\n"
                    f"• **Detalle**: El servicio u objetivo se ha recuperado y opera dentro de los parámetros normales.\n\n"
                    f"🕒 **Hora de resolución**: `{now_str}`\n"
                    f"🆔 **ID de Alerta**: `{alert.id}`"
                )
                NotificationService.send_to_all_channels(
                    organization_id=organization_id,
                    title=title,
                    message=body,
                    alert_id=alert.id,
                )
            except Exception as exc:
                logger.warning("Failed to dispatch RESOLVED notification: %s", exc)

        return alert

    @staticmethod
    @transaction.atomic
    def auto_resolve_alert(organization_id, rule_id, target_id=None):
        """Auto-resolves active or acknowledged alerts for a rule when the issue is resolved."""
        now = timezone.now()
        qs = Alert.objects.filter(
            organization_id=organization_id,
            rule_id=rule_id,
            status__in=[Alert.Status.ACTIVE, Alert.Status.ACKNOWLEDGED],
        )
        if target_id:
            qs = qs.filter(target_id=target_id)
        
        alerts_to_resolve = list(qs)
        updated_count = 0

        for alert in alerts_to_resolve:
            alert.status = Alert.Status.RESOLVED
            alert.resolved_at = now
            alert.save(update_fields=["status", "resolved_at"])
            updated_count += 1

            try:
                from notifications.services import NotificationService
                rule_name = alert.rule.name if alert.rule else alert.title
                now_str = now.strftime("%Y-%m-%d %H:%M:%S UTC")
                title = f"✅ [RESOLVED] {alert.title}"
                body = (
                    f"✅ **[RESOLVED] ALERTA RESUELTA**\n\n"
                    f"• **Estado**: `RESOLVED` ✅\n"
                    f"• **Severidad Previa**: `{alert.severity.upper()}`\n"
                    f"• **Origen**: `{alert.target_type.upper() if alert.target_type else 'SISTEMA'}`\n"
                    f"• **Regla**: `{rule_name}`\n"
                    f"• **Detalle**: La métrica de monitoreo se ha normalizado y cumple con el umbral configurado.\n\n"
                    f"🕒 **Hora de resolución**: `{now_str}`\n"
                    f"🆔 **ID de Alerta**: `{alert.id}`"
                )
                NotificationService.send_to_all_channels(
                    organization_id=organization_id,
                    title=title,
                    message=body,
                    alert_id=alert.id,
                )
            except Exception as exc:
                logger.warning("Failed to dispatch auto RESOLVED notification: %s", exc)

        return updated_count

    @staticmethod
    @transaction.atomic
    def acknowledge_all(organization_id):
        """Acknowledge all active alerts for an organization."""
        updated = Alert.objects.filter(
            organization_id=organization_id,
            status=Alert.Status.ACTIVE,
        ).update(status=Alert.Status.ACKNOWLEDGED)
        return updated

    @staticmethod
    @transaction.atomic
    def resolve_all(organization_id):
        """Resolve all active or acknowledged alerts for an organization."""
        now = timezone.now()
        updated = Alert.objects.filter(
            organization_id=organization_id,
            status__in=[Alert.Status.ACTIVE, Alert.Status.ACKNOWLEDGED],
        ).update(status=Alert.Status.RESOLVED, resolved_at=now)
        return updated

    @staticmethod
    def get_alert_stats(organization_id):
        """Returns KPI statistics for organization alerts."""
        alerts = Alert.objects.filter(organization_id=organization_id)
        active_critical = alerts.filter(status=Alert.Status.ACTIVE, severity="critical").count()
        active_warning = alerts.filter(status=Alert.Status.ACTIVE, severity="warning").count()
        active_info = alerts.filter(status=Alert.Status.ACTIVE, severity="info").count()
        acknowledged = alerts.filter(status=Alert.Status.ACKNOWLEDGED).count()
        resolved = alerts.filter(status=Alert.Status.RESOLVED).count()

        resolved_alerts = alerts.filter(status=Alert.Status.RESOLVED, resolved_at__isnull=False)
        total_minutes = 0
        count = 0
        for a in resolved_alerts:
            if a.resolved_at and a.triggered_at:
                diff = (a.resolved_at - a.triggered_at).total_seconds() / 60.0
                if diff >= 0:
                    total_minutes += diff
                    count += 1

        avg_mttr_minutes = round(total_minutes / count, 1) if count > 0 else 0

        return {
            "active_critical": active_critical,
            "active_warning": active_warning,
            "active_info": active_info,
            "total_active": active_critical + active_warning + active_info,
            "acknowledged": acknowledged,
            "resolved": resolved,
            "avg_mttr_minutes": avg_mttr_minutes,
        }

    @staticmethod
    @transaction.atomic
    def create_alert(
        organization_id,
        rule_id,
        title,
        message,
        severity,
        target_type="",
        target_id=None,
    ):
        """Create or update active alert from rule evaluation."""
        if rule_id and target_id:
            existing = Alert.objects.filter(
                organization_id=organization_id,
                rule_id=rule_id,
                target_id=target_id,
                status__in=[Alert.Status.ACTIVE, Alert.Status.ACKNOWLEDGED],
            ).first()

            if existing:
                existing.title = title
                existing.message = message
                existing.severity = severity
                existing.triggered_at = timezone.now()
                existing.save(update_fields=["title", "message", "severity", "triggered_at"])

                rule = AlertRule.objects.get(id=rule_id)
                rule.last_triggered_at = timezone.now()
                rule.save(update_fields=["last_triggered_at"])
                return existing

        alert = Alert.objects.create(
            organization_id=organization_id,
            rule_id=rule_id,
            title=title,
            message=message,
            severity=severity,
            target_type=target_type,
            target_id=target_id,
        )

        if rule_id:
            rule = AlertRule.objects.get(id=rule_id)
            rule.last_triggered_at = timezone.now()
            rule.save(update_fields=["last_triggered_at"])

        AlertService.correlate_alert_with_incident(alert)

        # Dispatch automatic Grafana-style FIRING notifications to all enabled channels
        try:
            from notifications.services import NotificationService
            rule_obj = AlertRule.objects.filter(id=rule_id).first() if rule_id else None
            rule_name = rule_obj.name if rule_obj else title
            now_str = timezone.now().strftime("%Y-%m-%d %H:%M:%S UTC")

            notif_title = f"🔥 [FIRING:1] {severity.upper()}: {title}"
            notif_body = (
                f"🔥 **[FIRING:1] ALERTA DE SISTEMA**\n\n"
                f"• **Estado**: `FIRING` 🔥\n"
                f"• **Severidad**: `{severity.upper()}`\n"
                f"• **Origen / Servicio**: `{target_type.upper() if target_type else 'SISTEMA'}`\n"
                f"• **Regla de Alerta**: `{rule_name}`\n"
                f"• **Detalle**: {message}\n\n"
                f"🕒 **Hora de activación**: `{now_str}`\n"
                f"🆔 **ID de Alerta**: `{alert.id}`"
            )

            NotificationService.send_to_all_channels(
                organization_id=organization_id,
                title=notif_title,
                message=notif_body,
                alert_id=alert.id,
            )
        except Exception as notif_err:
            logger.warning("Failed to dispatch alert notification: %s", notif_err)

        return alert

    @staticmethod
    @transaction.atomic
    def correlate_alert_with_incident(alert):
        """Auto-correlates an alert with an active incident or creates a new incident if critical."""
        from incidents.models import Incident, IncidentAlert
        from incidents.services import IncidentService

        open_incidents = Incident.objects.filter(
            organization_id=alert.organization_id,
            status__in=[Incident.Status.OPEN, Incident.Status.INVESTIGATING],
        )

        target_incident = None
        if alert.target_id:
            target_links = IncidentAlert.objects.filter(
                incident__in=open_incidents
            ).values_list("incident_id", flat=True)
            if target_links.exists():
                target_incident = Incident.objects.filter(id__in=target_links).first()

        if not target_incident and open_incidents.exists():
            target_incident = open_incidents.first()

        if target_incident:
            IncidentService.add_alert(target_incident.id, alert.id)
            return target_incident

        if alert.severity == "critical":
            priority = "critical"
            incident = IncidentService.create_incident(
                organization_id=alert.organization_id,
                title=f"Incidente: {alert.title}",
                description=f"Incidente generado automáticamente por alerta de severidad crítica.\n\nMensaje: {alert.message}",
                priority=priority,
            )
            IncidentService.add_alert(incident.id, alert.id)
            return incident

        return None

    @staticmethod
    @transaction.atomic
    def create_incident_for_alert(alert_id, organization_id):
        """Manually creates/links an incident for a given alert."""
        from incidents.models import IncidentAlert
        from incidents.services import IncidentService

        alert = Alert.objects.get(id=alert_id, organization_id=organization_id)

        existing_link = IncidentAlert.objects.filter(alert_id=alert.id).select_related("incident").first()
        if existing_link:
            return existing_link.incident

        priority_map = {
            "critical": "critical",
            "warning": "high",
            "info": "medium",
        }
        priority = priority_map.get(alert.severity, "medium")

        incident = IncidentService.create_incident(
            organization_id=organization_id,
            title=f"Incidente: {alert.title}",
            description=f"Incidente elevado manualmente desde alerta.\n\nMensaje: {alert.message}",
            priority=priority,
        )
        IncidentService.add_alert(incident.id, alert.id)
        return incident


class AlertEvaluatorService:
    """Service for evaluating alert rules against monitoring data.

    Checks each enabled rule against the current state of
    monitoring targets, SSL certificates, DNS records, etc.
    """

    @staticmethod
    @transaction.atomic
    def evaluate_all_rules():
        """Evaluate all enabled alert rules across all organizations.

        Called by the evaluate_alert_rules Celery task.
        Creates alerts for any rules whose conditions are met.
        """
        rules = AlertRule.objects.filter(enabled=True)
        alerts_created = 0

        for rule in rules:
            try:
                if AlertEvaluatorService._evaluate_rule(rule):
                    alerts_created += 1
            except Exception:
                pass

        return alerts_created

    @staticmethod
    def _evaluate_rule(rule):
        """Evaluate a single rule and create an alert if condition is met.

        Returns:
            bool: True if an alert was created, False otherwise.
        """
        condition = rule.condition
        threshold = rule.threshold

        if condition == "ssl_expiring":
            return AlertEvaluatorService._check_ssl_expiring(rule, threshold)
        elif condition == "uptime_below":
            return AlertEvaluatorService._check_uptime_below(rule, threshold)
        elif condition == "status_down":
            return AlertEvaluatorService._check_status_down(rule)
        elif condition == "response_time_above":
            return AlertEvaluatorService._check_response_time(rule, threshold)
        elif condition == "dns_changed":
            return AlertEvaluatorService._check_dns_changed(rule)
        elif condition == "domain_expiring":
            return AlertEvaluatorService._check_domain_expiring(rule, threshold)
        elif condition == "security_score_below":
            return AlertEvaluatorService._check_security_score(rule, threshold)
        elif condition == "api_check_failed":
            return AlertEvaluatorService._check_api_failed(rule)

        return False

    @staticmethod
    def _check_ssl_expiring(rule, threshold):
        """Check if any SSL certificates are expiring within threshold days."""
        from ssl_monitor.models import SSLCertificate

        certs = SSLCertificate.objects.filter(
            organization_id=rule.organization_id,
            is_valid=True,
        )
        if rule.target_id:
            certs = certs.filter(id=rule.target_id)

        now = timezone.now()
        threshold_date = now + timedelta(days=int(threshold))

        for cert in certs:
            if cert.expiration_date and cert.expiration_date <= threshold_date:
                days_left = (cert.expiration_date - now).days
                AlertService.create_alert(
                    organization_id=rule.organization_id,
                    rule_id=rule.id,
                    title=f"SSL certificate expiring: {cert.domain}",
                    message=f"Certificate for {cert.domain} expires in {days_left} days.",
                    severity=rule.severity,
                    target_type="ssl",
                    target_id=cert.id,
                )
                return True
        return False

    @staticmethod
    def _check_uptime_below(rule, threshold):
        """Check if any monitoring targets have uptime below threshold."""
        from monitoring.models import MonitoringTarget

        targets = MonitoringTarget.objects.filter(
            organization_id=rule.organization_id,
            enabled=True,
        )
        if rule.target_id:
            targets = targets.filter(id=rule.target_id)

        since = timezone.now() - timedelta(hours=24)
        triggered = False

        for target in targets:
            checks = target.checks.filter(checked_at__gte=since)
            total = checks.count()
            if total == 0:
                continue
            up = checks.filter(status="up").count()
            uptime_pct = (up / total) * 100

            if uptime_pct < threshold:
                AlertService.create_alert(
                    organization_id=rule.organization_id,
                    rule_id=rule.id,
                    title=f"Uptime below threshold: {target.name}",
                    message=f"Target {target.name} has {uptime_pct:.1f}% uptime (threshold: {threshold}%).",
                    severity=rule.severity,
                    target_type="monitoring",
                    target_id=target.id,
                )
                triggered = True
        return triggered

    @staticmethod
    def _check_status_down(rule):
        """Check if any monitoring targets are currently down. Auto-resolves if recovered."""
        from monitoring.models import MonitoringTarget

        all_targets = MonitoringTarget.objects.filter(
            organization_id=rule.organization_id,
            enabled=True,
        )
        if rule.target_id:
            all_targets = all_targets.filter(id=rule.target_id)

        triggered = False

        for target in all_targets:
            if target.last_status == "down":
                AlertService.create_alert(
                    organization_id=rule.organization_id,
                    rule_id=rule.id,
                    title=f"Target is down: {target.name}",
                    message=f"Monitoring target {target.name} ({target.endpoint}) is currently down.",
                    severity=rule.severity,
                    target_type="monitoring",
                    target_id=target.id,
                )
                triggered = True
            elif target.last_status == "up":
                AlertService.auto_resolve_alert(
                    organization_id=rule.organization_id,
                    rule_id=rule.id,
                    target_id=target.id,
                )

        return triggered

    @staticmethod
    def _check_response_time(rule, threshold):
        """Check if any monitoring targets have response time above threshold. Auto-resolves if normal."""
        from monitoring.models import MonitoringTarget

        targets = MonitoringTarget.objects.filter(
            organization_id=rule.organization_id,
            enabled=True,
        )
        if rule.target_id:
            targets = targets.filter(id=rule.target_id)

        triggered = False

        for target in targets:
            if target.last_latency and target.last_latency > threshold:
                AlertService.create_alert(
                    organization_id=rule.organization_id,
                    rule_id=rule.id,
                    title=f"Slow response time: {target.name}",
                    message=f"Target {target.name} has {target.last_latency:.0f}ms response time (threshold: {threshold}ms).",
                    severity=rule.severity,
                    target_type="monitoring",
                    target_id=target.id,
                )
                triggered = True
            elif target.last_latency and target.last_latency <= threshold:
                AlertService.auto_resolve_alert(
                    organization_id=rule.organization_id,
                    rule_id=rule.id,
                    target_id=target.id,
                )

        return triggered

    @staticmethod
    def _check_dns_changed(rule):
        """Check if any DNS records have changed recently."""
        from dns_monitor.models import DNSRecord

        now = timezone.now()
        recent = now - timedelta(hours=1)

        records = DNSRecord.objects.filter(
            organization_id=rule.organization_id,
            last_change_at__gte=recent,
        )
        triggered = False

        for record in records:
            AlertService.create_alert(
                organization_id=rule.organization_id,
                rule_id=rule.id,
                title=f"DNS record changed: {record.domain} {record.record_type}",
                message=f"DNS {record.record_type} record for {record.domain} has changed.",
                severity=rule.severity,
                target_type="dns",
                target_id=record.id,
            )
            triggered = True
        return triggered

    @staticmethod
    def _check_domain_expiring(rule, threshold):
        """Check if any domains are expiring within threshold days."""
        from domain.models import DomainInfo

        domains = DomainInfo.objects.filter(
            organization_id=rule.organization_id,
        )
        now = timezone.now()
        threshold_date = now + timedelta(days=int(threshold))

        for domain in domains:
            if domain.expiration_date and domain.expiration_date <= threshold_date:
                days_left = (domain.expiration_date - now).days
                AlertService.create_alert(
                    organization_id=rule.organization_id,
                    rule_id=rule.id,
                    title=f"Domain expiring: {domain.domain}",
                    message=f"Domain {domain.domain} expires in {days_left} days.",
                    severity=rule.severity,
                    target_type="domain",
                    target_id=domain.id,
                )
                return True
        return False

    @staticmethod
    def _check_security_score(rule, threshold):
        """Check if any security header targets have score below threshold."""
        from security_headers.models import SecurityHeaderTarget

        targets = SecurityHeaderTarget.objects.filter(
            organization_id=rule.organization_id,
            enabled=True,
        )
        triggered = False

        for target in targets:
            if target.last_score is not None and target.last_score < threshold:
                AlertService.create_alert(
                    organization_id=rule.organization_id,
                    rule_id=rule.id,
                    title=f"Low security score: {target.name}",
                    message=f"Security headers score for {target.name} is {target.last_score} (threshold: {threshold}).",
                    severity=rule.severity,
                    target_type="security_headers",
                    target_id=target.id,
                )
                triggered = True
        return triggered

    @staticmethod
    def _check_api_failed(rule):
        """Check if any API check targets have failed."""
        from api_checks.models import APICheckTarget

        targets = APICheckTarget.objects.filter(
            organization_id=rule.organization_id,
            enabled=True,
            last_status="fail",
        )
        triggered = False

        for target in targets:
            AlertService.create_alert(
                organization_id=rule.organization_id,
                rule_id=rule.id,
                title=f"API check failed: {target.name}",
                message=f"API check for {target.name} ({target.url}) has failed.",
                severity=rule.severity,
                target_type="api_check",
                target_id=target.id,
            )
            triggered = True
        return triggered
