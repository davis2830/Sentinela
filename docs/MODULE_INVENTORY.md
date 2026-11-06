# Inventario verificado de Sentinel

Mapa de referencia. Las declaraciones vigentes están en los modelos de cada aplicación, [api_urls.py](../backend/config/api_urls.py) y los módulos `tasks.py`. Los prefijos y nombres de tareas se cotejaron con el árbol de trabajo el 2026-11-05.

## Modelos por aplicación

| Aplicación | Modelos |
| --- | --- |
| accounts | User, APIToken, BetaControl, BetaInvitation, EmailChallenge, IdentityMail, AbuseBucket, DisposableDomainPolicy |
| common | ScanLease (reserva persistente de sondeos por organización y recurso) |
| organizations | Organization, InvitationToken |
| users | Permission, Role, UserRole, Team |
| monitoring | AgentProbe, AgentExecution, MonitoringTarget, MonitoringCheck, MaintenanceWindow, TargetCoverage |
| ssl_monitor | SSLCertificate |
| dns_monitor | DNSRecord, DNSChangeHistory |
| domain | DomainInfo |
| api_checks | APICheckTarget, APICheckResult |
| security_headers | SecurityHeaderTarget, SecurityHeaderResult |
| alerts | AlertRule, Alert |
| notifications | NotificationChannel, Notification |
| incidents | Incident, IncidentAlert, IncidentTimelineEvent |
| reports | Report |
| status_page | StatusPageConfig, ScheduledMaintenance, MaintenanceUpdate, StatusPageSubscriber |
| maintenance | MaintenanceWindow, MaintenanceWindowTarget, MaintenanceWindowUpdate |
| audit | AuditLog |

## Prefijos REST activos

La ampliación de ficha integral del 2026-10-05 añade `/monitoring/:targetId` en frontend y `GET/PATCH monitoring/:targetId/coverage/` en backend (también bajo el alias `monitoring-targets/`). `TargetCoverage` y la migración `monitoring.0006_targetcoverage` almacenan asociaciones explícitas. Véase [contratos y reglas de correspondencia](ENDPOINT_DOSSIER.md).

Las rutas frontend `/dashboard` (Centro de Conectividad) y `/gestion` (Resumen de gestión) reutilizan estos GET. Monitoring, API Checks, SSL, DNS, dominios y Security Headers exponen `scan_availability` en lista y detalle: `ready`, `cooldown`, `pending`, `subscription_required`, `disabled`, `agent_managed` o `read_only`. No se añadieron endpoints ni migraciones para los dashboards por área.

Todos cuelgan de `/api/v1/`: `auth/`, `organizations/`, `platform-admin/`, `users/`, `monitoring/`, `monitoring-targets/`, `agent-probes/`, `ssl-certificates/`, `dns-records/`, `domains/`, `api-checks/`, `security-headers/`, `alert-rules/`, `alerts/`, `notifications/`, `incidents/`, `reports/`, `status-page/`, `maintenance/` y `audit-logs/`. Readiness está disponible en `/health/` y `/api/v1/health/`.

La consola SaaS usa `/admin/login` y `/admin/platform`. El API administrativo incluye sesión con TOTP, organizaciones, usuarios y sus acciones auditadas, beta, auditoría global, estadísticas y exportación CSV. [Rutas administrativas](../backend/organizations/urls_admin.py) · [Acceso y publicación](PLATFORM_ACCESS.md).

Recuperación de acceso añadida el 2026-11-04: POST `auth/password/recovery/`
(solicitud genérica 202 con presupuesto y Turnstile) y POST `auth/password/reset/`
(confirmación explícita de un enlace de una hora/uso único, sin login automático).
Frontend: `/forgot-password` y `/reset-password`. Se reutiliza el outbox cifrado;
ver [controles y pruebas](UX_REMEDIATION_2026-11-04.md).

Los scans individuales de Monitoring, SSL, DNS, WHOIS, API Checks y Security Headers responden `202 Accepted` con `task_id`, `resource_id`, `status` y `submitted_at`.

## Tareas Celery declaradas

- `accounts.deliver_identity_mail`, `accounts.dispatch_identity_mail`
- `alerts.evaluate_rules`
- `api_checks.run_all`, `api_checks.run_check`
- `dns.scan_all`, `dns.scan_records`
- `domain.scan_all`, `domain.scan_whois`
- `monitoring.check_all`, `monitoring.run_check`, `monitoring.schedule_checks`
- `monitoring.check_sentinine_heartbeats`, `monitoring.register_target_in_submonitors`
- `monitoring.purge_telemetry`; `monitoring.purge_old_telemetry` queda como alias deprecado por una versión
- `monitoring.purge_old_checks_by_retention`
- `notifications.send`, `notifications.send_pending`
- `organizations.check_expired_trials`
- `reports.generate`
- `security_headers.scan`, `security_headers.scan_all`
- `ssl_monitor.scan_certificate`, `ssl_monitor.scan_all`
- `incidents.auto_close_resolved`

La prueba `CeleryScheduleTests` comprueba que cada entrada de Beat esté registrada.

## Incorporación de beta — 2026-10-05

La verificación y versión de sesión pertenecen a User y la admisión beta a Organization. El inventario de rutas y comandos de beta está en [Beta y correo](BETA_EMAIL_VERIFICATION.md#api-y-modelos-añadidos).
