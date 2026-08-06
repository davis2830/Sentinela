from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .models import Alert, AlertRule


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
    ):
        """Create a new alert rule.

        Args:
            organization_id: UUID of the organization.
            name: Display name for the rule.
            target_type: One of ssl, monitoring, dns, domain, api_check, security_headers.
            condition: Condition type (e.g. ssl_expiring, uptime_below).
            threshold: Threshold value for the condition.
            severity: Alert severity (critical, warning, info).
            enabled: Whether the rule is active (default True).

        Returns:
            The created AlertRule instance.
        """
        return AlertRule.objects.create(
            organization_id=organization_id,
            name=name,
            target_type=target_type,
            condition=condition,
            threshold=threshold,
            severity=severity,
            enabled=enabled,
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
        """Mark an alert as resolved.

        Args:
            alert_id: UUID of the alert.
            organization_id: UUID of the organization.

        Returns:
            The updated Alert instance.
        """
        alert = Alert.objects.get(id=alert_id, organization_id=organization_id)
        alert.status = Alert.Status.RESOLVED
        alert.resolved_at = timezone.now()
        alert.save(update_fields=["status", "resolved_at"])
        return alert

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
        """Create a new alert from a rule evaluation.

        Called by the AlertEvaluatorService when a rule condition is met.

        Args:
            organization_id: UUID of the organization.
            rule_id: UUID of the rule that triggered (or None).
            title: Alert title.
            message: Alert message with details.
            severity: Alert severity (critical, warning, info).
            target_type: Type of the target that triggered.
            target_id: UUID of the target that triggered.

        Returns:
            The created Alert instance.
        """
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

        return alert


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
        """Check if any monitoring targets are currently down."""
        from monitoring.models import MonitoringTarget

        targets = MonitoringTarget.objects.filter(
            organization_id=rule.organization_id,
            enabled=True,
            last_status="down",
        )
        triggered = False

        for target in targets:
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
        return triggered

    @staticmethod
    def _check_response_time(rule, threshold):
        """Check if any monitoring targets have response time above threshold."""
        from monitoring.models import MonitoringTarget

        targets = MonitoringTarget.objects.filter(
            organization_id=rule.organization_id,
            enabled=True,
        )
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
