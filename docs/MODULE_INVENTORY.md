# 📦 Inventario Técnico de Módulos de Sentinel

Este documento cataloga la totalidad de módulos de la plataforma, mapeando cada dominio de negocio con sus rutas de frontend, vistas, modelos de backend, endpoints REST y tareas asíncronas de Celery.

---

## 🗺️ Matriz de Módulos y Componentes

| # | Módulo de Negocio | Ruta Frontend | App Backend | Modelos Principales | Endpoints Base REST | Tarea Celery / Motor |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **NOC Dashboard** | `/dashboard` | `monitoring`, `incidents`, `alerts` | *Agregación en memoria / caché* | `/api/v1/monitoring/global-performance/`<br>`/api/v1/incidents/stats/` | Tareas de refresco continuo |
| **2** | **Uptime & Latencia** | `/monitoring` | `monitoring` | `MonitoringTarget`<br>`MonitoringCheck`<br>`AgentProbe` | `/api/v1/monitoring/`<br>`/api/v1/monitoring/{id}/scan/`<br>`/api/v1/monitoring/test-connection/` | `run_monitoring_check`<br>`schedule_all_checks` |
| **3** | **Guardianes Sentinine** | `/monitoring` (Drawer) | `monitoring` | `AgentProbe`<br>`MonitoringTarget` | `/api/v1/agent-probes/`<br>`/api/v1/agent-probes/heartbeat/`<br>`/api/v1/agent-probes/submit-results/` | `check_sentinine_heartbeats` (Watchdog 60s) + Contenedor Docker |
| **4** | **Certificados SSL** | `/ssl` | `ssl_monitor` | `SSLCertificate`<br>`SSLCertificateScan` | `/api/v1/ssl-certificates/`<br>`/api/v1/ssl-certificates/{id}/scan/`<br>`/api/v1/ssl-certificates/test-connection/` | `scan_ssl_certificate`<br>`schedule_all_ssl_scans` |
| **5** | **Registros DNS** | `/dns` | `dns_monitor` | `DNSRecord`<br>`DNSHistory` | `/api/v1/dns-records/`<br>`/api/v1/dns-records/{id}/resolve/`<br>`/api/v1/dns-records/test-resolution/` | `check_dns_record`<br>`schedule_all_dns_checks` |
| **6** | **Dominios & WHOIS** | `/domains` | `domain` | `DomainMonitor`<br>`DomainHistory` | `/api/v1/domains/`<br>`/api/v1/domains/{id}/whois/`<br>`/api/v1/domains/test-whois/` | `check_domain_whois`<br>`schedule_all_domain_checks` |
| **7** | **API Checks Sintéticos** | `/api-checks` | `api_checks` | `APICheckTarget`<br>`APICheckResult` | `/api/v1/api-checks/`<br>`/api/v1/api-checks/{id}/run/`<br>`/api/v1/api-checks/test-request/` | `run_api_check`<br>`schedule_all_api_checks` |
| **8** | **Cabeceras de Seguridad** | `/security-headers` | `security_headers` | `SecurityHeaderScan`<br>`SecurityHeaderTarget` | `/api/v1/security-headers/`<br>`/api/v1/security-headers/{id}/scan/`<br>`/api/v1/security-headers/test-headers/` | `scan_security_headers`<br>`schedule_all_security_scans` |
| **9** | **Centro de Alertas** | `/alerts` | `alerts` | `AlertRule`<br>`Alert` | `/api/v1/alerts/`<br>`/api/v1/alert-rules/`<br>`/api/v1/alert-rules/simulate/`<br>`/api/v1/alerts/{id}/snooze/` | `evaluate_alert_rules` |
| **10** | **Gestión de Incidentes** | `/incidents` | `incidents` | `Incident`<br>`IncidentTimeline`<br>`IncidentAlert` | `/api/v1/incidents/`<br>`/api/v1/incidents/{id}/assign/`<br>`/api/v1/incidents/{id}/rca/`<br>`/api/v1/incidents/stats/` | Notificaciones automáticas por evento |
| **11** | **Reportes & Error Budget** | `/reports` | `reports` | `Report`<br>`ReportExecution` | `/api/v1/reports/`<br>`/api/v1/reports/sla-live/`<br>`/api/v1/reports/{id}/export-csv/`<br>`/api/v1/reports/{id}/export-pdf/` | Generadores programados de SLA |
| **12** | **Status Pages Multi-Tenant** | `/status-page`<br>`/status/:slug` | `status_page` | `StatusPage`<br>`StatusPageComponent`<br>`StatusPageSubscriber`<br>`ScheduledMaintenance` | `/api/v1/status-page/`<br>`/api/v1/status-page/public/{slug}/`<br>`/api/v1/status-page/public/{slug}/subscribe/` | Notificaciones a suscriptores por email |
| **13** | **Canales de Notificación** | `/notifications` | `notifications` | `NotificationChannel`<br>`NotificationDelivery` | `/api/v1/notifications/`<br>`/api/v1/notifications/test-connection/`<br>`/api/v1/notifications/{id}/retry/` | `dispatch_notification_task` en cola `high_priority` |
| **14** | **Usuarios y Equipos** | `/users` | `users`, `organizations` | `User`<br>`Team`<br>`OrganizationMember` | `/api/v1/users/`<br>`/api/v1/users/teams/`<br>`/api/v1/organizations/members/`<br>`/api/v1/organizations/members/{id}/resend/` | Despacho de invitaciones SMTP |
| **15** | **Perfil & Credenciales** | `/profile` | `accounts`, `users` | `User`<br>`APIToken`<br>`UserSession` | `/api/v1/accounts/profile/`<br>`/api/v1/accounts/tokens/`<br>`/api/v1/auth/revoke-sessions/` | — |
| **16** | **Ventanas de Mantenimiento** | `/maintenance` | `maintenance` | `MaintenanceWindow`<br>`MaintenanceTarget` | `/api/v1/maintenance/`<br>`/api/v1/maintenance/{id}/start/`<br>`/api/v1/maintenance/{id}/complete/` | `check_maintenance_windows` |
| **17** | **Auditoría Global** | `/audit-logs` | `audit` | `AuditLog` | `/api/v1/audit/logs/` | Registro inmutable en cada mutación |
| **18** | **Administración SaaS Global** | `/admin/platform` | `organizations` | `Organization`<br>`Subscription`<br>`PlanQuota` | `/api/v1/platform/organizations/`<br>`/api/v1/platform/stats/` | `organizations.check_expired_trials` (cada 15 min) |

---

## 🧩 Toolkit Central Compartido (`frontend/src/components/common/noc/`)

Para mantener el principio DRY y consistencia estética, todas las vistas operativas reutilizan:

1. **`NOCPageHeader`:** Cabecera con título semántico, badge de módulo, radar pulsante de auto-refresco y slot de botones primarios.
2. **`useAutoRefresh` (`hooks/useAutoRefresh.ts`):** Hook con temporizador (15s/30s), pausa/reanudación interactiva e integración con React Query.
3. **`NOCKpiGrid` y `NOCKpiCard`:** Rejilla y tarjetas con barras visuales de salud (gauges) y sparklines.
4. **`NOCToolbar`:** Barra de búsqueda Omnibar, selector de vista (Cards vs Tabla compacta) y chips de filtrado reactivo.
5. **`NOCBulkActionBar`:** Barra inferior adhesiva flotante (`backdrop-blur-md`) para acciones masivas (escaneo, eliminación o reintento).
6. **`NOCDrawer`:** Slide-Over lateral derecho para inspección profunda con pestañas especializadas y atajo de teclado `ESC`.
7. **`usePersistentViewMode` (`hooks/usePersistentViewMode.ts`):** Hook que almacena en `localStorage` la preferencia de vista (tabla vs grid) individualmente por módulo.
