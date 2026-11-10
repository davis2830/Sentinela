"""Condition evaluators and allowlisted dispatch; scheduling stays in services."""

from dataclasses import dataclass
from datetime import timedelta
from typing import Callable

from django.utils import timezone

from .models import AlertRule
from .services import AlertService


@dataclass(frozen=True)
class EvaluationResult:
    condition: str
    triggered: bool


class MetricEvaluators:
    @staticmethod
    def _check_ssl_expiring(rule, threshold):
        """Check if any SSL certificates are expiring within threshold days."""
        from ssl_monitor.models import SSLCertificate

        certs = SSLCertificate.objects.filter(organization_id=rule.organization_id, is_valid=True)
        if rule.target_id:
            certs = certs.filter(id=rule.target_id)

        now = timezone.now()
        threshold_date = now + timedelta(days=int(threshold))
        triggered = False

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
                    metadata={"days_left": days_left, "domain": cert.domain},
                )
                triggered = True
        return triggered

    @staticmethod
    def _check_ssl_grade(rule, threshold):
        """Check if SSL certificate grade has dropped below A."""
        from ssl_monitor.models import SSLCertificate

        certs = SSLCertificate.objects.filter(organization_id=rule.organization_id)
        if rule.target_id:
            certs = certs.filter(id=rule.target_id)

        grade_order = {"A+": 5, "A": 4, "B": 3, "C": 2, "D": 1, "F": 0}
        triggered = False

        for cert in certs:
            val = grade_order.get(cert.crypto_grade, 0)
            if val < 4 and cert.crypto_grade:  # Below A
                AlertService.create_alert(
                    organization_id=rule.organization_id,
                    rule_id=rule.id,
                    title=f"Baja calificación TLS: {cert.domain}",
                    message=f"El certificado para {cert.domain} tiene calificación criptográfica '{cert.crypto_grade}' (esperada A o A+).",
                    severity=rule.severity,
                    target_type="ssl",
                    target_id=cert.id,
                    metadata={"grade": cert.crypto_grade, "domain": cert.domain},
                )
                triggered = True
        return triggered

    @staticmethod
    def _check_ssl_invalid(rule):
        """Check if SSL certificate is invalid, untrusted, or has handshake error."""
        from ssl_monitor.models import SSLCertificate

        certs = SSLCertificate.objects.filter(organization_id=rule.organization_id)
        if rule.target_id:
            certs = certs.filter(id=rule.target_id)

        triggered = False
        for cert in certs:
            if not cert.is_valid or cert.handshake_error:
                err = cert.handshake_error or "Certificado no válido o expirado"
                AlertService.create_alert(
                    organization_id=rule.organization_id,
                    rule_id=rule.id,
                    title=f"Certificado SSL Inválido: {cert.domain}",
                    message=f"Fallo en la negociación TLS para {cert.domain}: {err}.",
                    severity=rule.severity,
                    target_type="ssl",
                    target_id=cert.id,
                    metadata={"error": err, "domain": cert.domain},
                )
                triggered = True
        return triggered

    @staticmethod
    def _is_target_in_maintenance(target):
        """Check if target is currently within an active or in-progress maintenance window."""
        now_time = timezone.now()
        try:
            from maintenance.models import MaintenanceWindowTarget

            if MaintenanceWindowTarget.objects.filter(
                target_id=target.id,
                window__status="in_progress",
                window__scheduled_start__lte=now_time,
                window__scheduled_end__gte=now_time,
            ).exists():
                return True
        except Exception:
            pass

        try:
            from monitoring.models import MaintenanceWindow

            if MaintenanceWindow.objects.filter(
                target=target,
                start_time__lte=now_time,
                end_time__gte=now_time,
                active=True,
            ).exists():
                return True
        except Exception:
            pass

        return False

    @staticmethod
    def _check_status_down(rule):
        """Check if any monitoring targets are currently down. Auto-resolves if recovered or in maintenance."""
        from monitoring.models import MonitoringTarget

        all_targets = MonitoringTarget.objects.filter(organization_id=rule.organization_id, enabled=True)
        if rule.target_id:
            all_targets = all_targets.filter(id=rule.target_id)

        triggered = False

        for target in all_targets:
            if MetricEvaluators._is_target_in_maintenance(target):
                AlertService.auto_resolve_alert(
                    organization_id=rule.organization_id,
                    rule_id=rule.id,
                    target_id=target.id,
                )
                continue

            if target.last_status == "down":
                AlertService.create_alert(
                    organization_id=rule.organization_id,
                    rule_id=rule.id,
                    title=f"Target is down: {target.name}",
                    message=f"Monitoring target {target.name} ({target.endpoint}) is currently down.",
                    severity=rule.severity,
                    target_type="monitoring",
                    target_id=target.id,
                    metadata={"target_name": target.name, "endpoint": target.endpoint},
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
        """Check if any monitoring targets have response time above threshold. Auto-resolves if normal or in maintenance."""
        from monitoring.models import MonitoringTarget

        targets = MonitoringTarget.objects.filter(organization_id=rule.organization_id, enabled=True)
        if rule.target_id:
            targets = targets.filter(id=rule.target_id)

        triggered = False

        for target in targets:
            if MetricEvaluators._is_target_in_maintenance(target):
                AlertService.auto_resolve_alert(
                    organization_id=rule.organization_id,
                    rule_id=rule.id,
                    target_id=target.id,
                )
                continue

            if target.last_latency and target.last_latency > threshold:
                AlertService.create_alert(
                    organization_id=rule.organization_id,
                    rule_id=rule.id,
                    title=f"Slow response time: {target.name}",
                    message=f"Target {target.name} has {target.last_latency:.0f}ms response time (threshold: {threshold}ms).",
                    severity=rule.severity,
                    target_type="monitoring",
                    target_id=target.id,
                    metadata={"latency_ms": target.last_latency, "threshold_ms": threshold},
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
    def _check_uptime_below(rule, threshold):
        """Check if any monitoring targets have uptime SLA below threshold."""
        from monitoring.models import MonitoringTarget

        targets = MonitoringTarget.objects.filter(organization_id=rule.organization_id, enabled=True)
        if rule.target_id:
            targets = targets.filter(id=rule.target_id)

        since = timezone.now() - timedelta(hours=24)
        triggered = False

        for target in targets:
            if MetricEvaluators._is_target_in_maintenance(target):
                AlertService.auto_resolve_alert(
                    organization_id=rule.organization_id,
                    rule_id=rule.id,
                    target_id=target.id,
                )
                continue

            results = target.checks.filter(checked_at__gte=since)
            tot = results.count()
            if tot > 0:
                up_cnt = results.filter(status="up").count()
                sla = (up_cnt / tot) * 100
                if sla < threshold:
                    AlertService.create_alert(
                        organization_id=rule.organization_id,
                        rule_id=rule.id,
                        title=f"Bajo Uptime SLA: {target.name}",
                        message=f"El objetivo {target.name} tiene un SLA de {sla:.1f}% en las últimas 24h (umbral: {threshold}%).",
                        severity=rule.severity,
                        target_type="monitoring",
                        target_id=target.id,
                        metadata={"sla": sla, "threshold": threshold},
                    )
                    triggered = True
        return triggered

    @staticmethod
    def _check_dns_changed(rule):
        """Check if any DNS records have changed recently."""
        from dns_monitor.models import DNSRecord

        now = timezone.now()
        recent = now - timedelta(hours=24)

        records = DNSRecord.objects.filter(
            organization_id=rule.organization_id,
            last_change_at__gte=recent,
        )
        if rule.target_id:
            records = records.filter(id=rule.target_id)

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
                metadata={"domain": record.domain, "record_type": record.record_type},
            )
            triggered = True
        return triggered

    @staticmethod
    def _check_dns_latency(rule, threshold):
        """Check if DNS resolution latency is above threshold."""
        from dns_monitor.models import DNSRecord

        records = DNSRecord.objects.filter(organization_id=rule.organization_id)
        if rule.target_id:
            records = records.filter(id=rule.target_id)

        triggered = False
        for rec in records:
            if rec.response_time_ms and rec.response_time_ms > threshold:
                AlertService.create_alert(
                    organization_id=rule.organization_id,
                    rule_id=rule.id,
                    title=f"Alta latencia DNS: {rec.domain}",
                    message=f"La resolución de {rec.domain} tardó {rec.response_time_ms}ms (umbral: {threshold}ms).",
                    severity=rule.severity,
                    target_type="dns",
                    target_id=rec.id,
                    metadata={"latency_ms": rec.response_time_ms, "domain": rec.domain},
                )
                triggered = True
        return triggered

    @staticmethod
    def _check_domain_expiring(rule, threshold):
        """Check if any domains are expiring within threshold days."""
        from domain.models import DomainInfo

        domains = DomainInfo.objects.filter(organization_id=rule.organization_id)
        if rule.target_id:
            domains = domains.filter(id=rule.target_id)

        now = timezone.now()
        threshold_date = now + timedelta(days=int(threshold))
        triggered = False

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
                    metadata={"days_left": days_left, "domain": domain.domain},
                )
                triggered = True
        return triggered

    @staticmethod
    def _check_domain_unlocked(rule):
        """Check if domain anti-theft EPP lock is disabled."""
        from domain.models import DomainInfo

        domains = DomainInfo.objects.filter(organization_id=rule.organization_id)
        if rule.target_id:
            domains = domains.filter(id=rule.target_id)

        triggered = False
        for dom in domains:
            if dom.is_locked is False:
                AlertService.create_alert(
                    organization_id=rule.organization_id,
                    rule_id=rule.id,
                    title=f"Candado de Dominio Desactivado: {dom.domain}",
                    message=f"El dominio {dom.domain} no tiene candado de transferencia EPP activo (riesgo de Domain Hijacking).",
                    severity=rule.severity,
                    target_type="domain",
                    target_id=dom.id,
                    metadata={"domain": dom.domain},
                )
                triggered = True
        return triggered

    @staticmethod
    def _check_security_score(rule, threshold):
        """Check if any security header targets have score below threshold."""
        from security_headers.models import SecurityHeaderTarget

        targets = SecurityHeaderTarget.objects.filter(organization_id=rule.organization_id, enabled=True)
        if rule.target_id:
            targets = targets.filter(id=rule.target_id)

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
                    metadata={"score": target.last_score, "threshold": threshold},
                )
                triggered = True
        return triggered

    @staticmethod
    def _check_security_leak(rule):
        """Check if any security header targets are leaking server versions."""
        from security_headers.models import SecurityHeaderTarget

        targets = SecurityHeaderTarget.objects.filter(organization_id=rule.organization_id, enabled=True)
        if rule.target_id:
            targets = targets.filter(id=rule.target_id)

        triggered = False
        for target in targets:
            if target.info_leak_detected:
                leak = target.server_header or target.powered_by_header or "Software expuesto"
                AlertService.create_alert(
                    organization_id=rule.organization_id,
                    rule_id=rule.id,
                    title=f"Fuga de Servidor Detectada: {target.name}",
                    message=f"El endpoint {target.name} está divulgando software/versión ({leak}) en cabeceras HTTP.",
                    severity=rule.severity,
                    target_type="security_headers",
                    target_id=target.id,
                    metadata={"leak": leak, "target_name": target.name},
                )
                triggered = True
        return triggered

    @staticmethod
    def _check_api_failed(rule):
        """Check if any API check targets have failed."""
        from api_checks.models import APICheckTarget

        targets = APICheckTarget.objects.filter(organization_id=rule.organization_id, enabled=True, last_status="fail")
        if rule.target_id:
            targets = targets.filter(id=rule.target_id)

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
                metadata={"url": target.url, "http_status": target.last_http_status},
            )
            triggered = True
        return triggered

    @staticmethod
    def _check_api_latency(rule, threshold):
        """Check if API check response latency exceeds threshold."""
        from api_checks.models import APICheckTarget

        targets = APICheckTarget.objects.filter(organization_id=rule.organization_id, enabled=True)
        if rule.target_id:
            targets = targets.filter(id=rule.target_id)

        triggered = False
        for target in targets:
            if target.last_response_time_ms and target.last_response_time_ms > threshold:
                AlertService.create_alert(
                    organization_id=rule.organization_id,
                    rule_id=rule.id,
                    title=f"Alta latencia API: {target.name}",
                    message=f"Petición a {target.name} tardó {target.last_response_time_ms}ms (umbral: {threshold}ms).",
                    severity=rule.severity,
                    target_type="api_check",
                    target_id=target.id,
                    metadata={"latency_ms": target.last_response_time_ms, "threshold": threshold},
                )
                triggered = True
        return triggered


def evaluate(rule: AlertRule) -> EvaluationResult:
    evaluators: dict[str, Callable[[AlertRule], bool]] = {
        "ssl_expiring": lambda r: MetricEvaluators._check_ssl_expiring(r, r.threshold),
        "ssl_grade_below": lambda r: MetricEvaluators._check_ssl_grade(r, r.threshold),
        "ssl_invalid": lambda r: MetricEvaluators._check_ssl_invalid(r),
        "uptime_below": lambda r: MetricEvaluators._check_uptime_below(r, r.threshold),
        "status_down": lambda r: MetricEvaluators._check_status_down(r),
        "response_time_above": lambda r: MetricEvaluators._check_response_time(r, r.threshold),
        "dns_changed": lambda r: MetricEvaluators._check_dns_changed(r),
        "dns_latency_above": lambda r: MetricEvaluators._check_dns_latency(r, r.threshold),
        "domain_expiring": lambda r: MetricEvaluators._check_domain_expiring(r, r.threshold),
        "domain_unlocked": lambda r: MetricEvaluators._check_domain_unlocked(r),
        "security_score_below": lambda r: MetricEvaluators._check_security_score(r, r.threshold),
        "security_leak_detected": lambda r: MetricEvaluators._check_security_leak(r),
        "api_check_failed": lambda r: MetricEvaluators._check_api_failed(r),
        "api_latency_above": lambda r: MetricEvaluators._check_api_latency(r, r.threshold),
    }
    evaluator = evaluators.get(rule.condition)
    if evaluator is None:
        raise ValueError("Condición de alerta no soportada.")
    return EvaluationResult(rule.condition, bool(evaluator(rule)))
