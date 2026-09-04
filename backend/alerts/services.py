import logging
from datetime import timedelta

from django.db import models, transaction
from django.utils import timezone

from .models import Alert, AlertRule

logger = logging.getLogger(__name__)


class AlertRuleService:
    """Service for alert rule management.

    Handles CRUD operations, simulation, and defaults for alert rules.
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
        cooldown_minutes=15,
        auto_resolve=True,
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
            cooldown_minutes=cooldown_minutes,
            auto_resolve=auto_resolve,
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

    @staticmethod
    @transaction.atomic
    def snooze_rule(rule_id, organization_id, minutes=60):
        """Temporarily mute/snooze an alert rule for N minutes."""
        rule = AlertRule.objects.get(id=rule_id, organization_id=organization_id)
        rule.snoozed_until = timezone.now() + timedelta(minutes=int(minutes))
        rule.save(update_fields=["snoozed_until"])
        return rule

    @staticmethod
    def simulate_rule(organization_id, target_type, condition, threshold, target_id=None):
        """Simulate rule evaluation in memory against current organization targets.

        Returns matching targets and measured values without creating alerts.
        """
        now = timezone.now()
        threshold = float(threshold) if threshold is not None else 0.0
        matching_targets = []
        targets_evaluated = 0

        if target_type == "monitoring":
            from monitoring.models import MonitoringTarget
            qs = MonitoringTarget.objects.filter(organization_id=organization_id, enabled=True)
            if target_id:
                qs = qs.filter(id=target_id)
            targets_evaluated = qs.count()

            for t in qs:
                if condition == "status_down" and t.last_status == "down":
                    matching_targets.append({
                        "name": t.name,
                        "endpoint": t.endpoint,
                        "current_value": "Estado: Caído (Down)",
                        "threshold": "Status: Down",
                        "severity": "critical",
                    })
                elif condition == "response_time_above" and t.last_latency and t.last_latency > threshold:
                    matching_targets.append({
                        "name": t.name,
                        "endpoint": t.endpoint,
                        "current_value": f"{t.last_latency:.0f} ms",
                        "threshold": f"> {threshold:.0f} ms",
                        "severity": "warning",
                    })
                elif condition == "uptime_below":
                    since = now - timedelta(hours=24)
                    results = t.results.filter(checked_at__gte=since)
                    tot = results.count()
                    if tot > 0:
                        up_cnt = results.filter(status="up").count()
                        sla = (up_cnt / tot) * 100
                        if sla < threshold:
                            matching_targets.append({
                                "name": t.name,
                                "endpoint": t.endpoint,
                                "current_value": f"{sla:.1f}% SLA",
                                "threshold": f"< {threshold:.1f}%",
                                "severity": "critical",
                            })

        elif target_type == "ssl":
            from ssl_monitor.models import SSLCertificate
            qs = SSLCertificate.objects.filter(organization_id=organization_id)
            if target_id:
                qs = qs.filter(id=target_id)
            targets_evaluated = qs.count()

            for cert in qs:
                if condition == "ssl_expiring" and cert.expiration_date:
                    days_left = (cert.expiration_date - now).days
                    if days_left <= threshold:
                        matching_targets.append({
                            "name": cert.domain,
                            "endpoint": f"{cert.domain}:{cert.port or 443}",
                            "current_value": f"{days_left} días restantes",
                            "threshold": f"<= {int(threshold)} días",
                            "severity": "warning",
                        })
                elif condition == "ssl_invalid" and (not cert.is_valid or cert.handshake_error):
                    matching_targets.append({
                        "name": cert.domain,
                        "endpoint": f"{cert.domain}:{cert.port or 443}",
                        "current_value": "Certificado inválido o error TLS",
                        "threshold": "Válido = Sí",
                        "severity": "critical",
                    })
                elif condition == "ssl_grade_below":
                    grade_order = {"A+": 5, "A": 4, "B": 3, "C": 2, "D": 1, "F": 0}
                    # Default comparison: grade below A
                    target_val = grade_order.get(cert.crypto_grade, 0)
                    if target_val < 4:
                        matching_targets.append({
                            "name": cert.domain,
                            "endpoint": f"{cert.domain}:{cert.port or 443}",
                            "current_value": f"Grado {cert.crypto_grade or 'Sin nota'}",
                            "threshold": "< Grado A",
                            "severity": "warning",
                        })

        elif target_type == "dns":
            from dns_monitor.models import DNSRecord
            qs = DNSRecord.objects.filter(organization_id=organization_id)
            if target_id:
                qs = qs.filter(id=target_id)
            targets_evaluated = qs.count()

            for rec in qs:
                if condition == "dns_latency_above" and rec.response_time_ms and rec.response_time_ms > threshold:
                    matching_targets.append({
                        "name": f"{rec.domain} ({rec.record_type})",
                        "endpoint": rec.domain,
                        "current_value": f"{rec.response_time_ms} ms",
                        "threshold": f"> {int(threshold)} ms",
                        "severity": "warning",
                    })
                elif condition == "dns_changed" and rec.last_change_at:
                    recent = now - timedelta(hours=24)
                    if rec.last_change_at >= recent:
                        matching_targets.append({
                            "name": f"{rec.domain} ({rec.record_type})",
                            "endpoint": rec.domain,
                            "current_value": f"Modificado hace {(now - rec.last_change_at).seconds // 60}m",
                            "threshold": "Mutación en 24h",
                            "severity": "info",
                        })

        elif target_type == "domain":
            from domain.models import DomainInfo
            qs = DomainInfo.objects.filter(organization_id=organization_id)
            if target_id:
                qs = qs.filter(id=target_id)
            targets_evaluated = qs.count()

            for dom in qs:
                if condition == "domain_expiring" and dom.expiration_date:
                    days_left = (dom.expiration_date - now).days
                    if days_left <= threshold:
                        matching_targets.append({
                            "name": dom.domain,
                            "endpoint": dom.domain,
                            "current_value": f"{days_left} días restantes",
                            "threshold": f"<= {int(threshold)} días",
                            "severity": "warning",
                        })
                elif condition == "domain_unlocked" and dom.is_locked is False:
                    matching_targets.append({
                        "name": dom.domain,
                        "endpoint": dom.domain,
                        "current_value": "Candado EPP desprotegido",
                        "threshold": "Domain Lock = Desactivado",
                        "severity": "warning",
                    })

        elif target_type == "api_check":
            from api_checks.models import APICheckTarget
            qs = APICheckTarget.objects.filter(organization_id=organization_id, enabled=True)
            if target_id:
                qs = qs.filter(id=target_id)
            targets_evaluated = qs.count()

            for api_t in qs:
                if condition == "api_check_failed" and api_t.last_status == "fail":
                    matching_targets.append({
                        "name": api_t.name,
                        "endpoint": api_t.url,
                        "current_value": f"Status HTTP {api_t.last_http_status or 'Error'}",
                        "threshold": "API Check Falló",
                        "severity": "critical",
                    })
                elif condition == "api_latency_above" and api_t.last_response_time_ms and api_t.last_response_time_ms > threshold:
                    matching_targets.append({
                        "name": api_t.name,
                        "endpoint": api_t.url,
                        "current_value": f"{api_t.last_response_time_ms} ms",
                        "threshold": f"> {int(threshold)} ms",
                        "severity": "warning",
                    })

        elif target_type == "security_headers":
            from security_headers.models import SecurityHeaderTarget
            qs = SecurityHeaderTarget.objects.filter(organization_id=organization_id, enabled=True)
            if target_id:
                qs = qs.filter(id=target_id)
            targets_evaluated = qs.count()

            for sec in qs:
                if condition == "security_score_below" and sec.last_score is not None and sec.last_score < threshold:
                    matching_targets.append({
                        "name": sec.name,
                        "endpoint": sec.url,
                        "current_value": f"{sec.last_score} pts",
                        "threshold": f"< {int(threshold)} pts",
                        "severity": "warning",
                    })
                elif condition == "security_leak_detected" and sec.info_leak_detected:
                    matching_targets.append({
                        "name": sec.name,
                        "endpoint": sec.url,
                        "current_value": f"Fuga: {sec.server_header or sec.powered_by_header or 'Detectada'}",
                        "threshold": "Fuga de Stack detectada",
                        "severity": "warning",
                    })

        return {
            "targets_evaluated": targets_evaluated,
            "would_trigger_count": len(matching_targets),
            "matching_targets": matching_targets,
        }

    @staticmethod
    def ensure_default_rules(organization_id):
        """Create baseline default alert rules if none exist for the organization."""
        if AlertRule.objects.filter(organization_id=organization_id).exists():
            return 0

        default_rules = [
            {
                "name": "Objetivo de Monitoreo Caído",
                "target_type": AlertRule.TargetType.MONITORING,
                "condition": AlertRule.ConditionType.STATUS_DOWN,
                "severity": AlertRule.Severity.CRITICAL,
                "threshold": 0,
            },
            {
                "name": "Latencia Alta de Respuesta (>1000ms)",
                "target_type": AlertRule.TargetType.MONITORING,
                "condition": AlertRule.ConditionType.RESPONSE_TIME_ABOVE,
                "severity": AlertRule.Severity.WARNING,
                "threshold": 1000,
            },
            {
                "name": "Certificado SSL por Expirar (<= 30 días)",
                "target_type": AlertRule.TargetType.SSL,
                "condition": AlertRule.ConditionType.SSL_EXPIRING,
                "severity": AlertRule.Severity.WARNING,
                "threshold": 30,
            },
            {
                "name": "Fallo en API Check Sintético",
                "target_type": AlertRule.TargetType.API_CHECK,
                "condition": AlertRule.ConditionType.API_CHECK_FAILED,
                "severity": AlertRule.Severity.CRITICAL,
                "threshold": 0,
            },
            {
                "name": "Dominio WHOIS por Expirar (<= 30 días)",
                "target_type": AlertRule.TargetType.DOMAIN,
                "condition": AlertRule.ConditionType.DOMAIN_EXPIRING,
                "severity": AlertRule.Severity.WARNING,
                "threshold": 30,
            },
            {
                "name": "Puntuación de Seguridad Baja (< 70)",
                "target_type": AlertRule.TargetType.SECURITY_HEADERS,
                "condition": AlertRule.ConditionType.SECURITY_SCORE_BELOW,
                "severity": AlertRule.Severity.WARNING,
                "threshold": 70,
            },
        ]
        created = 0
        for r in default_rules:
            AlertRule.objects.create(
                organization_id=organization_id,
                enabled=True,
                **r,
            )
            created += 1
        return created


class AlertService:
    """Service for smart alert management.

    Handles deduplication, flapping detection, snoozing, and lifecycle.
    """

    @staticmethod
    def list_alerts(organization_id, status_filter=None, severity_filter=None):
        """Return alerts for an organization with optional filters."""
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
        """Mark an alert as acknowledged."""
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
                title = f"[RESOLVED] {alert.title}"
                body = (
                    f"**[RESOLVED] ALERTA RESUELTA**\n\n"
                    f"• **Estado**: `RESOLVED`\n"
                    f"• **Severidad Previa**: `{alert.severity.upper()}`\n"
                    f"• **Origen**: `{alert.target_type.upper() if alert.target_type else 'SISTEMA'}`\n"
                    f"• **Regla**: `{rule_name}`\n"
                    f"• **Detalle**: {alert.message}\n"
                    f"• **Hora de resolución**: `{now_str}`\n"
                    f"• **ID de Alerta**: `{alert.id}`"
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
    def snooze_alert(alert_id, organization_id, minutes=60):
        """Temporarily mute a specific alert for N minutes."""
        alert = Alert.objects.get(id=alert_id, organization_id=organization_id)
        alert.snoozed_until = timezone.now() + timedelta(minutes=int(minutes))
        alert.save(update_fields=["snoozed_until"])
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
            alert.auto_resolved = True
            alert.save(update_fields=["status", "resolved_at", "auto_resolved"])
            updated_count += 1

            try:
                from notifications.services import NotificationService
                rule_name = alert.rule.name if alert.rule else alert.title
                now_str = now.strftime("%Y-%m-%d %H:%M:%S UTC")
                title = f"[RESOLVED] {alert.title}"
                body = (
                    f"**[RESOLVED] ALERTA RESUELTA AUTOMÁTICAMENTE**\n\n"
                    f"• **Estado**: `RESOLVED`\n"
                    f"• **Severidad Previa**: `{alert.severity.upper()}`\n"
                    f"• **Origen**: `{alert.target_type.upper() if alert.target_type else 'SISTEMA'}`\n"
                    f"• **Regla**: `{rule_name}`\n"
                    f"• **Detalle**: La métrica de monitoreo se ha normalizado y cumple con el umbral configurado.\n\n"
                    f"• **Hora de resolución**: `{now_str}`\n"
                    f"• **ID de Alerta**: `{alert.id}`"
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
        return Alert.objects.filter(
            organization_id=organization_id,
            status=Alert.Status.ACTIVE,
        ).update(status=Alert.Status.ACKNOWLEDGED)

    @staticmethod
    @transaction.atomic
    def resolve_all(organization_id):
        """Resolve all active or acknowledged alerts for an organization."""
        now = timezone.now()
        return Alert.objects.filter(
            organization_id=organization_id,
            status__in=[Alert.Status.ACTIVE, Alert.Status.ACKNOWLEDGED],
        ).update(status=Alert.Status.RESOLVED, resolved_at=now)

    @staticmethod
    def bulk_action(organization_id, action, alert_ids, minutes=60):
        """Execute a bulk action on selected alerts."""
        alerts = Alert.objects.filter(id__in=alert_ids, organization_id=organization_id)
        count = alerts.count()
        if count == 0:
            return {"count": 0, "message": "No se encontraron alertas válidas."}

        now = timezone.now()

        if action == "acknowledge":
            alerts.filter(status=Alert.Status.ACTIVE).update(status=Alert.Status.ACKNOWLEDGED)
            return {"count": count, "action": "acknowledge", "message": f"{count} alertas reconocidas."}

        elif action == "resolve":
            alerts.filter(status__in=[Alert.Status.ACTIVE, Alert.Status.ACKNOWLEDGED]).update(
                status=Alert.Status.RESOLVED, resolved_at=now
            )
            return {"count": count, "action": "resolve", "message": f"{count} alertas resueltas."}

        elif action == "snooze":
            until = now + timedelta(minutes=int(minutes))
            alerts.update(snoozed_until=until)
            return {"count": count, "action": "snooze", "message": f"{count} alertas silenciadas por {minutes}m."}

        elif action == "delete":
            with transaction.atomic():
                alerts.delete()
            return {"count": count, "action": "delete", "message": f"{count} alertas eliminadas."}

        else:
            raise ValueError(f"Acción desconocida: {action}")

    @staticmethod
    def get_alert_stats(organization_id):
        """Returns KPI statistics for organization alerts."""
        alerts = Alert.objects.filter(organization_id=organization_id)
        now = timezone.now()

        active_critical = alerts.filter(status=Alert.Status.ACTIVE, severity="critical").count()
        active_warning = alerts.filter(status=Alert.Status.ACTIVE, severity="warning").count()
        active_info = alerts.filter(status=Alert.Status.ACTIVE, severity="info").count()
        acknowledged = alerts.filter(status=Alert.Status.ACKNOWLEDGED).count()
        resolved = alerts.filter(status=Alert.Status.RESOLVED).count()

        # Flapping & Snoozed counts
        flapping_count = alerts.filter(
            status__in=[Alert.Status.ACTIVE, Alert.Status.ACKNOWLEDGED], is_flapping=True
        ).count()
        snoozed_count = alerts.filter(
            status__in=[Alert.Status.ACTIVE, Alert.Status.ACKNOWLEDGED], snoozed_until__gt=now
        ).count()

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
            "flapping_count": flapping_count,
            "snoozed_count": snoozed_count,
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
        metadata=None,
    ):
        """Create or update active alert with deduplication, flapping detection, and RCA telemetry."""
        now = timezone.now()
        metadata = metadata or {}

        # 1. Check if the parent rule is currently snoozed
        rule_obj = AlertRule.objects.filter(id=rule_id).first() if rule_id else None
        rule_snoozed = bool(rule_obj and rule_obj.snoozed_until and rule_obj.snoozed_until > now)

        # 2. Smart Deduplication: Check if there's already an active or acknowledged alert for this target & rule
        if rule_id and target_id:
            existing = Alert.objects.filter(
                organization_id=organization_id,
                rule_id=rule_id,
                target_id=target_id,
                status__in=[Alert.Status.ACTIVE, Alert.Status.ACKNOWLEDGED],
            ).first()

            if existing:
                # Update existing alert without clobbering triggered_at (preserves true MTTR)
                existing.occurrence_count += 1
                existing.last_seen_at = now
                existing.title = title
                existing.message = message
                existing.severity = severity
                existing.metadata = {**existing.metadata, **metadata}
                existing.save(update_fields=["occurrence_count", "last_seen_at", "title", "message", "severity", "metadata"])

                if rule_obj:
                    rule_obj.last_triggered_at = now
                    rule_obj.save(update_fields=["last_triggered_at"])

                # If alert is specifically snoozed or rule is snoozed, suppress notifications
                alert_snoozed = bool(existing.snoozed_until and existing.snoozed_until > now)
                if alert_snoozed or rule_snoozed:
                    return existing

                return existing

        # 3. Flapping Detection: check recent resolved alerts for same target & rule within 15 mins
        is_flapping = False
        flapping_cnt = 0
        if rule_id and target_id:
            fifteen_mins_ago = now - timedelta(minutes=15)
            recent_resolved = Alert.objects.filter(
                organization_id=organization_id,
                rule_id=rule_id,
                target_id=target_id,
                status=Alert.Status.RESOLVED,
                resolved_at__gte=fifteen_mins_ago,
            ).count()

            if recent_resolved >= 2:
                is_flapping = True
                flapping_cnt = recent_resolved + 1
                severity = "critical"
                title = f"[FLAPPING] {title}"
                message = f"{message} (Detectada inestabilidad recurrente: {flapping_cnt} transiciones en 15 minutos)."

        # 4. Create new alert instance
        alert = Alert.objects.create(
            organization_id=organization_id,
            rule_id=rule_id,
            title=title,
            message=message,
            severity=severity,
            target_type=target_type,
            target_id=target_id,
            occurrence_count=1,
            is_flapping=is_flapping,
            flapping_count=flapping_cnt,
            metadata=metadata,
        )

        if rule_obj:
            rule_obj.last_triggered_at = now
            rule_obj.save(update_fields=["last_triggered_at"])

        AlertService.correlate_alert_with_incident(alert)

        # 5. Dispatch notifications if not snoozed
        if not rule_snoozed:
            try:
                from notifications.services import NotificationService
                rule_name = rule_obj.name if rule_obj else title
                now_str = now.strftime("%Y-%m-%d %H:%M:%S UTC")

                notif_title = f"[FIRING:1] {severity.upper()}: {title}"
                notif_body = (
                    f"**[FIRING:1] ALERTA DE SISTEMA**\n\n"
                    f"• **Estado**: `FIRING`\n"
                    f"• **Severidad**: `{severity.upper()}`\n"
                    f"• **Origen / Servicio**: `{target_type.upper() if target_type else 'SISTEMA'}`\n"
                    f"• **Regla de Alerta**: `{rule_name}`\n"
                    f"• **Detalle**: {message}\n"
                    f"{'• **Inestabilidad**: `ALERTA EN FLAPPING`\n' if is_flapping else ''}\n"
                    f"• **Hora de activación**: `{now_str}`\n"
                    f"• **ID de Alerta**: `{alert.id}`"
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
    """Service for evaluating alert rules against system metrics."""

    @staticmethod
    @transaction.atomic
    def evaluate_all_rules(org_id=None):
        """Evaluate all enabled alert rules."""
        rules = AlertRule.objects.filter(enabled=True)
        if org_id:
            rules = rules.filter(organization_id=org_id)
        alerts_created = 0

        for rule in rules:
            try:
                if AlertEvaluatorService._evaluate_rule(rule):
                    alerts_created += 1
            except Exception as exc:
                logger.error("Error evaluating alert rule %s: %s", rule.id, exc)

        return alerts_created

    @staticmethod
    def _evaluate_rule(rule):
        """Evaluate a single rule and create an alert if condition is met."""
        condition = rule.condition
        threshold = rule.threshold

        if condition == "ssl_expiring":
            return AlertEvaluatorService._check_ssl_expiring(rule, threshold)
        elif condition == "ssl_grade_below":
            return AlertEvaluatorService._check_ssl_grade(rule, threshold)
        elif condition == "ssl_invalid":
            return AlertEvaluatorService._check_ssl_invalid(rule)
        elif condition == "uptime_below":
            return AlertEvaluatorService._check_uptime_below(rule, threshold)
        elif condition == "status_down":
            return AlertEvaluatorService._check_status_down(rule)
        elif condition == "response_time_above":
            return AlertEvaluatorService._check_response_time(rule, threshold)
        elif condition == "dns_changed":
            return AlertEvaluatorService._check_dns_changed(rule)
        elif condition == "dns_latency_above":
            return AlertEvaluatorService._check_dns_latency(rule, threshold)
        elif condition == "domain_expiring":
            return AlertEvaluatorService._check_domain_expiring(rule, threshold)
        elif condition == "domain_unlocked":
            return AlertEvaluatorService._check_domain_unlocked(rule)
        elif condition == "security_score_below":
            return AlertEvaluatorService._check_security_score(rule, threshold)
        elif condition == "security_leak_detected":
            return AlertEvaluatorService._check_security_leak(rule)
        elif condition == "api_check_failed":
            return AlertEvaluatorService._check_api_failed(rule)
        elif condition == "api_latency_above":
            return AlertEvaluatorService._check_api_latency(rule, threshold)

        return False

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
    def _check_status_down(rule):
        """Check if any monitoring targets are currently down. Auto-resolves if recovered."""
        from monitoring.models import MonitoringTarget

        all_targets = MonitoringTarget.objects.filter(organization_id=rule.organization_id, enabled=True)
        if rule.target_id:
            all_targets = all_targets.filter(id=rule.target_id)

        triggered = False

        for target in all_targets:
            from monitoring.models import MaintenanceWindow
            now_time = timezone.now()
            if MaintenanceWindow.objects.filter(target=target, start_time__lte=now_time, end_time__gte=now_time, active=True).exists():
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
        """Check if any monitoring targets have response time above threshold. Auto-resolves if normal."""
        from monitoring.models import MonitoringTarget

        targets = MonitoringTarget.objects.filter(organization_id=rule.organization_id, enabled=True)
        if rule.target_id:
            targets = targets.filter(id=rule.target_id)

        triggered = False

        for target in targets:
            from monitoring.models import MaintenanceWindow
            now_time = timezone.now()
            if MaintenanceWindow.objects.filter(target=target, start_time__lte=now_time, end_time__gte=now_time, active=True).exists():
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
            results = target.results.filter(checked_at__gte=since)
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
