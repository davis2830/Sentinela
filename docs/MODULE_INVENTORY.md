# Inventario verificado de Sentinel

Generado desde modelos, URLs y tareas registradas el 2026-10-03.

## Modelos por aplicación

| Aplicación | Modelos |
| --- | --- |
| accounts | User, APIToken |
| common | ScanLease (reserva persistente de sondeos por organización y recurso) |
| organizations | Organization, InvitationToken |
| users | Permission, Role, UserRole, Team |
| monitoring | AgentProbe, MonitoringTarget, MonitoringCheck, MaintenanceWindow, TargetCoverage |
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

Todos cuelgan de `/api/v1/`: `auth/`, `organizations/`, `platform-admin/`, `users/`, `monitoring/`, `monitoring-targets/`, `agent-probes/`, `ssl-certificates/`, `dns-records/`, `domains/`, `api-checks/`, `security-headers/`, `alert-rules/`, `alerts/`, `notifications/`, `incidents/`, `reports/`, `status-page/`, `maintenance/` y `audit-logs/`.

Los scans individuales de Monitoring, SSL, DNS, WHOIS, API Checks y Security Headers responden `202 Accepted` con `task_id`, `resource_id`, `status` y `submitted_at`.

## Tareas Celery registradas

- `alerts.evaluate_rules`
- `api_checks.run_all`, `api_checks.run_check`
- `dns.scan_all`, `dns.scan_records`
- `domain.scan_all`, `domain.scan_whois`
- `monitoring.check_all`, `monitoring.run_check`, `monitoring.schedule_checks`
- `monitoring.check_sentinine_heartbeats`, `monitoring.register_target_in_submonitors`
- `monitoring.purge_telemetry`; `monitoring.purge_old_telemetry` queda como alias deprecado por una versión
- `notifications.send`, `notifications.send_pending`
- `organizations.check_expired_trials`
- `reports.generate`
- `security_headers.scan`, `security_headers.scan_all`
- `ssl_monitor.scan_certificate`, `ssl_monitor.scan_all`
- `incidents.auto_close_resolved`

La prueba `CeleryScheduleTests` comprueba que cada entrada de Beat esté registrada.

## Incorporación de beta — 2026-10-05

Accounts añade seis modelos: `BetaControl`, `BetaInvitation`, `EmailChallenge`, `IdentityMail`, `AbuseBucket`, `DisposableDomainPolicy`; la verificación y versión de sesión pertenecen a User, y la admisión beta a Organization. Las tareas `accounts.deliver_identity_mail` y `accounts.dispatch_identity_mail` administran el outbox. El inventario de rutas y comandos nuevos está en [Beta y correo](BETA_EMAIL_VERIFICATION.md#api-y-modelos-añadidos). Ninguna de estas tareas modifica la retención de logs.
