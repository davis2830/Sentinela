# Project: Sentinel (GC_OPS_OBS) — Master Agent Context & Rules

> **Ubicación Física Exclusiva:** `C:\Users\feshernandez\GC_OPS_OBS\`  
> **Tipo de Plataforma:** SaaS Enterprise de Observabilidad y Operaciones NOC / SRE  
> **Última Actualización:** Octubre 2026 | **Versión:** 1.0.0-RELEASE  
> **Centro de Documentación Viva:** [`docs/`](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/README.md)

---

## 📌 1. Visión General del Proyecto
**Sentinel** es una plataforma de observabilidad operativa y centro de operaciones de red (NOC / SRE) orientada a la monitorización continua, diagnóstico en tiempo real y automatización de infraestructura y servicios críticos. 

Permite vigilar servicios web públicos, APIs sintéticas, certificados SSL, resoluciones DNS, dominios WHOIS e infraestructura privada (on-premise / LAN) mediante agentes autónomos satélites (**Guardianes Sentinine**).

---

## 🛠️ 2. Stack Tecnológico Real y Activo
- **Backend:** Python 3.13 / Django 5.x / Django REST Framework.
- **Asincronía & Background Jobs:** Celery 5.x con Celery Beat para tareas periódicas y 3 colas de prioridad (`high_priority`, `monitoring`, `background`).
- **Base de Datos & Time-Series:** PostgreSQL 16 con extensión **TimescaleDB** (hypertables con compresión y retención automática de 90 días).
- **Caché & Message Broker:** Redis 7 (DB 0: Celery Broker, DB 1: Celery Results con TTL, DB 2: Caché distribuido de telemetría NOC en < 2ms).
- **Frontend:** React 18 + TypeScript + Vite, TailwindCSS (design system NOC estricto), Recharts para telemetría multieje, Lucide React para iconografía vectorial.
- **Agentes LAN / On-Premise:** **Guardián Sentinine** (`sentinine/`) — Agente autónomo Python v1.1.0 en Docker con soporte para certificados autofirmados, DNS y TCP.
- **Observabilidad / Logs:** Grafana Loki 3.0 (`sentinel_loki:3100`) y Promtail integrados en `docker-compose.yml`.
- **Rendimiento & Calidad:** Grafana k6 (`tests_perf/`), Pytest DRF (`backend/tests/`), GitHub Actions CI/CD (`.github/workflows/`).
- **Contenedores:** Docker & Docker Compose (`docker-compose.yml` y `docker-compose.prod.yml`).

---

## 📁 3. Centro de Documentación Viva (`docs/`)
Toda la documentación técnica del proyecto se encuentra centralizada y clasificada en [`docs/`](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/README.md):

| Documento | Propósito | Enlace Directo |
| :--- | :--- | :--- |
| **`ROADMAP_TRACKER.md`** | **Única fuente de verdad del Roadmap:** Fases 1 (100%), Fase 2 (30%), Fase 3 y backlog priorizado. | [`docs/ROADMAP_TRACKER.md`](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/ROADMAP_TRACKER.md) |
| **`MODULE_INVENTORY.md`** | **Catálogo de los 18 Módulos:** Mapeo de rutas frontend, apps backend, modelos, endpoints REST y Celery. | [`docs/MODULE_INVENTORY.md`](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/MODULE_INVENTORY.md) |
| **`IMPLEMENTATION_LOG.md`** | **Bitácora Cronológica de Ingeniería:** Histórico de cambios técnicos, decisiones de arquitectura y archivos. | [`docs/IMPLEMENTATION_LOG.md`](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/IMPLEMENTATION_LOG.md) |
| **`DEV_WORKFLOW.md`** | **Convenciones & Diseño NOC:** Comandos Docker, tokens semánticos de color, normas de ORM N+1 y pre-commit. | [`docs/DEV_WORKFLOW.md`](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/DEV_WORKFLOW.md) |
| **`TESTING_STRATEGY.md`** | **Estrategia Integral de Pruebas:** Pirámide de automatización (Pytest DRF, k6 rendimiento y Playwright E2E). | [`docs/TESTING_STRATEGY.md`](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/TESTING_STRATEGY.md) |
| **`PRODUCTION_READINESS.md`** | **Plan Maestro de Producción:** Scorecard ejecutivo 100%, 6 pilares de seguridad AppSec y hardening. | [`docs/PRODUCTION_READINESS.md`](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/PRODUCTION_READINESS.md) |
| **`PRODUCTION_SECURITY.md`** | **Hardening de Variables & TLS:** Directrices de configuración segura de producción (`settings.prod`). | [`docs/PRODUCTION_SECURITY.md`](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/PRODUCTION_SECURITY.md) |
| **`GO_LIVE_CHECKLIST.md`** | **Manual Operativo & Runbook Go-Live:** Verificaciones pre-vuelo (T-48h a T-0), Día-2 y protocolo rollback. | [`docs/GO_LIVE_CHECKLIST.md`](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/GO_LIVE_CHECKLIST.md) |
| **`tests_perf/README.md`** | **Suite k6 de Rendimiento:** 5 escenarios de carga, runners interactivos y reportes HTML. | [`tests_perf/README.md`](file:///c:/Users/feshernandez/GC_OPS_OBS/tests_perf/README.md) |

---

## 🚀 4. Estado de Implementación: Qué Llevamos vs Qué Falta

### ✅ A. Implementado al 100% (Producción Ready)

1. **Erradicación Total de Consultas N+1 & Benchmark k6:**
   - Optimización de serializadores con `Prefetch()` acotado por ventana temporal (`checked_at__gte=since_1h`).
   - DRF `AlertListSerializer` con precarga en lote en memoria O(1) (`alert_id IN (...)`).
   - Conteo anotado `.annotate(alerts_count_annotated=Count('incident_alerts'))`.
   - Connection Pooling en PostgreSQL (`CONN_MAX_AGE=60`, `CONN_HEALTH_CHECKS=True`).
   - Caché Redis DB 2 con TTL de 15s en telemetría global NOC y estadísticas de incidentes/MTTR (< 2ms).
   - **Récord Benchmark k6:** Latencia promedio reducida a **22.36 ms** y **p95 a 38.81 ms** bajo 40 VUs concurrentes con 0% de errores.
2. **Los 18 Módulos de la Plataforma (Backend + Frontend Completados):**
   - **1. NOC Executive Dashboard** ([`DashboardPage.tsx`](file:///frontend/src/pages/DashboardPage.tsx)): Matriz multieje Recharts, dona SVG de salud, feed cronológico, KPIs ejecutivas y selector temporal (1h, 6h, 24h, 7d).
   - **2. Uptime & Latencia** ([`MonitoringPage.tsx`](file:///frontend/src/pages/MonitoringPage.tsx)): Sondeos HTTP/S, TCP, Ping, DNS, gráfica histórica de latencia, radar pulsante, cálculo de SLA y test de conexión en vivo.
   - **3. Guardianes Sentinine (Private Probes)** (`sentinine/` & [`ProbeDirectoryDrawer.tsx`](file:///frontend/src/components/monitoring/ProbeDirectoryDrawer.tsx)): Agente autónomo v1.1.0 para LAN/on-premise, bypass SSL autofirmado, watchdog Celery Beat (`check_sentinine_heartbeats`) cada 60s y auto-detección de IPs privadas en formulario.
   - **4. Certificados SSL** ([`SSLCertificatesPage.tsx`](file:///frontend/src/pages/SSLCertificatesPage.tsx)): Soporte multi-puerto (:443, :8443, :636, :993), evaluación criptográfica A+ a F, barra de vida útil, test TLS en vivo y exportación ISO 27001 CSV.
   - **5. Registros DNS** ([`DNSRecordsPage.tsx`](file:///frontend/src/pages/DNSRecordsPage.tsx)): 9 tipos de registros (A, AAAA, CNAME, MX, TXT, NS, SOA, PTR, CAA), medición de latencia en ms, detección SPF/DMARC y diff visual (+/-) de mutaciones.
   - **6. Dominios & WHOIS** ([`DomainsPage.tsx`](file:///frontend/src/pages/DomainsPage.tsx)): Detección de candado anti-secuestro EPP (`clientTransferProhibited`), semáforo de expiración y auditoría de nameservers delegados.
   - **7. API Checks Sintéticos** ([`APIChecksPage.tsx`](file:///frontend/src/pages/APIChecksPage.tsx)): Métodos HTTP completos, auth, test interactivo en vivo, auto-generador de JSON Schema en 1-clic y exportación cURL.
   - **8. Cabeceras de Seguridad** ([`SecurityHeadersPage.tsx`](file:///frontend/src/pages/SecurityHeadersPage.tsx)): Auditoría HSTS/CSP, detección de fugas de stack de servidor CWE-200 y generador de snippets (Nginx, Apache, Caddy, Cloudflare, IIS).
   - **9. Smart Alerts Engine** ([`AlertsPage.tsx`](file:///frontend/src/pages/AlertsPage.tsx)): 14 condiciones soportadas, 6 reglas auto-aprovisionadas por defecto, deduplicación `xN`, anti-flapping ($\ge 3$ en 15m), Smart Snooze y simulador dry-run.
   - **10. Hub de Incidentes (ITIL/SRE)** ([`IncidentsPage.tsx`](file:///frontend/src/pages/IncidentsPage.tsx)): Trazabilidad de hitos MTTA/MTTR, asignación de operador y squad (`assigned_team`), RCA post-mortem estructurado y timeline colaborativo.
   - **11. Reportes & Presupuesto de Error SRE** ([`ReportsPage.tsx`](file:///frontend/src/pages/ReportsPage.tsx)): Telemetría de Error Budget en vivo con tasa de consumo (burn rate), selector granular de targets, exportación PDF y CSV con UTF-8 BOM.
   - **12. Status Pages Multi-Empresa** ([`StatusPageAdmin.tsx`](file:///frontend/src/pages/StatusPageAdmin.tsx) & [`PublicStatusPage.tsx`](file:///frontend/src/pages/PublicStatusPage.tsx)): Aislamiento multi-tenant por empresa (`/status/:slug`), selector granular de componentes, suscriptores por email y barra histórica de 90 días con latencia 24h.
   - **13. Canales de Notificación** ([`NotificationsPage.tsx`](file:///frontend/src/pages/NotificationsPage.tsx)): Slack, Teams, Telegram, Discord, Email y Webhooks. Ventanas de silencio (*Quiet Hours*), bypass crítico, rate limit y reintento en 1-clic.
   - **14. Usuarios y Equipos** ([`UsersPage.tsx`](file:///frontend/src/pages/UsersPage.tsx)): Gestión de cuadrillas operativas (`Team`), Team Leads, RBAC, invitaciones SMTP con reenvío en 1-clic y exportación CSV.
   - **15. Perfil & Seguridad Operativa** ([`ProfilePage.tsx`](file:///frontend/src/pages/ProfilePage.tsx)): Alarma acústica del NOC mediante Web Audio API dual-tone (587Hz + 880Hz), tokens de API personales revocables y cierre remoto de sesiones.
   - **16. Ventanas de Mantenimiento Programadas** ([`MaintenancePage.tsx`](file:///frontend/src/pages/MaintenancePage.tsx)): Sincronización automática en vivo con Status Page pública, supresión inteligente de alertas externas y exclusión de penalización de SLA mensual.
   - **17. Auditoría Global** (`backend/audit/`): Registro inmutable en cada mutación de recurso (`AuditLog`).
   - **18. Plataforma SaaS & Cuotas** (`backend/organizations/`): Separación Superadmin (`/admin/platform`) vs Tenant Admin, enforcement de cuotas en 10 recursos con HTTP 403 `QUOTA_EXCEEDED`, y tarea Celery Beat (`check_expired_trials`) cada 15 min.
3. **Hardening AppSec & Producción Certificada:**
   - Módulo Anti-SSRF (`backend/common/security.py`) bloqueando rangos privados, loopback y metadata cloud.
   - Cifrado en reposo Fernet AES-128 (`backend/common/crypto.py`) para cabeceras y secretos TOTP.
   - SimpleJWT con rotación obligatoria de refresh tokens, invalidación y expiración a 15 min.
   - MFA / 2FA TOTP reforzado con códigos de respaldo cifrados.
   - Healthcheck activo `/health/` sondeando BD, Redis y Celery con latencias en tiempo real.
   - Filtro de sanitización automática de logs enmascarando credenciales, JWTs y tokens.
   - CI/CD completo en `.github/workflows/ci.yml` y `cd.yml` con escaneo DevSecOps (pip-audit, Trivy).

---

### ⏳ B. Backlog Activo: Lo que Falta por Implementar

#### 🟡 Fase 2: Asistencia Operativa (En Curso - 30%)
1. **Visor de Logs Centralizado con Loki (`sentinel_loki`):**
   - *Infraestructura:* Contenedores `sentinel_loki:3100` y `promtail` listos en Docker.
   - *Falta Backend:* Endpoint autenticado tipo proxy para consultas LogQL filtradas por organización y objetivo (`/api/v1/monitoring/{id}/logs/`).
   - *Falta Frontend:* Componente **Log Stream Viewer** (consola con auto-scroll, filtros de severidad `INFO`, `WARN`, `ERROR` y buscador en tiempo real) dentro del drawer de objetivos e incidentes.
2. **Telemetría de Host con Grafana Alloy:**
   - *Infraestructura:* Script de relabeling `scripts_alloy/extract_metrics.py` listo.
   - *Falta Backend:* Ingesta periódica de métricas de CPU, Memoria y Disco de servidores en Sentinel.
   - *Falta Frontend:* Micro-gauges visuales de consumo de hardware en el drawer técnico de objetivos.
3. **Runbooks Operativos (SOPs):**
   - *Falta Backend:* Modelos `Runbook` y `RunbookStep` vinculados a reglas de alerta e incidentes.
   - *Falta Frontend:* Editor interactivo de pasos tipo checklist (markdown) y botón *"Abrir Runbook de Mitigación"* en el Drawer con trazabilidad de ejecución por operador.
4. **Acciones Sugeridas & Aprobaciones:**
   - *Falta:* Motor determinístico de recomendaciones ante fallas y flujo de aprobación de 4 ojos para cambios críticos.

#### 🧪 Calidad & Pruebas
5. **Pruebas End-to-End con Playwright (Nivel 5):**
   - *Falta:* Flujo sintético en navegador real: Registro &rarr; Wizard &rarr; Creación de Target &rarr; Alerta disparada &rarr; Elevación a Incidente &rarr; Resolución.

#### 🟣 Fase 3: Automatización y AI Ops (Planificada)
6. **Integración con AWX / Ansible:** Despacho automatizado de playbooks de remediación.
7. **Grafo de Dependencias & Blast Radius:** Mapa topológico de dependencias entre microservicios.
8. **ChatOps Bidireccional:** Bots interactivos en Slack, Teams y Telegram con comandos de reconocimiento y mitigación.
9. **AI Ops & Generador de RCA:** Asistente LLM para redacción automática del Post-Mortem y análisis causal.
10. **Módulo de Compliance Continuo:** Recolección automatizada de evidencias para ISO 27001 y SOC 2.

---

## 🎨 5. Sentinel NOC Design System & Reglas Estéticas Estrictas

Para mantener la rigurosidad operativa de un centro de control (NOC/SRE), todo componente frontend DEBE cumplir estas reglas inmutables:

### Superficies y Fondos
- `bg-dark` / `bg-main`: `#090D11` — Fondo base global ultra oscuro.
- `bg-card`: `#111720` — Tarjetas KPI, contenedores elevados, drawers y modales.
- `bg-card-hover`: `#17202C` — Estado hover sobre filas y botones secundarios.
- `border-base`: `#1E293B` — Delimitador sutil estándar.
- `border-accent`: `#263345` — Borde de contraste / elementos en foco.

### Acentos Semánticos Estrictos
| Color Token | Código Hex | Semántica Operativa | Uso en Interfaz |
| :--- | :---: | :--- | :--- |
| `accent-green` | `#10B981` | **Healthy / Online / SLA Óptimo** | Servidor UP, SLA >= 99.9%, HTTP 200, SSL > 30d. |
| `accent-green-glow`| `#34D399` | **Pulsante en Vivo** | Halos de radar activos y auto-refresco en tiempo real. |
| `accent-yellow` | `#F59E0B` | **Warning / Degraded / Atención** | Latencia alta, SSL <= 30d, flapping, mitigación en curso. |
| `accent-red` | `#EF4444` | **Critical / Down / Falla Activa** | Servidor DOWN, HTTP 5xx, incidentes abiertos, certificados expirados. |
| `accent-cyan` | `#06B6D4` | **Telemetría / Métricas** | Latencia en ms, gráficos, throughput req/s, consultas DNS. |
| `accent-purple` | `#8B5CF6` | **Automatización / Agentes / Privado** | Guardianes Sentinine LAN, webhooks, llaves API y 2FA. |
| `text-dim` | `#64748B` | **Neutral / Pausado** | Servicios en mantenimiento o desactivados. |

### Reglas de Diseño Obligatorias:
1. **CERO Emojis en Componentes de Interfaz:** Usar exclusivamente iconos vectoriales de `lucide-react`.
2. **CERO Mayúsculas Sostenidas (Uppercase):** Mantener capitalización natural tipo oración (Sentence case).
3. **Geometría Suavizada:** Contenedores `rounded-2xl`, modales `rounded-2xl` o `rounded-3xl` y badges en cápsula `rounded-full`.
4. **Tipografía Dual:** Fuente `Outfit` para textos, títulos y navegación; `JetBrains Mono` exclusivamente para datos técnicos (IPs, latencias ms, timestamps, códigos HTTP, hashes).

---

## 🧩 6. Arquitectura Frontend: Sentinel NOC Layout Toolkit (`frontend/src/components/common/noc/`)

Para mantener el principio DRY y consistencia estética, todas las vistas operativas reutilizan este toolkit:
- **`NOCPageHeader`:** Encabezado unificado con título, badge de módulo, radar pulsante de auto-refresco y slot de botones de acción rápida.
- **`useAutoRefresh` (`hooks/useAutoRefresh.ts`):** Hook estándar de cuenta regresiva (15s/30s), pausa/reanudación interactiva y compatibilidad nativa con React Query.
- **`NOCKpiGrid` y `NOCKpiCard`:** Rejilla y tarjetas KPI de nivel superior con barras visuales de salud (gauges) y micro-bloques de estado.
- **`NOCToolbar`:** Barra de control con buscador Omnibar en tiempo real, selector de vista (Cards vs Tabla compacta) y chips de filtrado reactivo con conteo en vivo.
- **`NOCBulkActionBar`:** Barra inferior flotante adhesiva (`backdrop-blur-md`) para acciones por lote (escaneo, pausa o eliminación masiva).
- **`NOCDrawer`:** Slide-Over lateral desplegable por la derecha con soporte para atajo de teclado `ESC`, navegación por pestañas e inspección técnica profunda.
- **`usePersistentViewMode` (`hooks/usePersistentViewMode.ts`):** Hook que almacena en `localStorage` la preferencia de vista (tabla vs cuadrícula) de forma individual por módulo.

---

## ⚡ 7. Estándares de Backend, ORM y Rendimiento de Base de Datos

1. **Erradicación Total de Consultas N+1:**
   - **`select_related` obligatorio** para claves foráneas directas (`ForeignKey`, `OneToOne`).
   - **`prefetch_related` obligatorio** con `Prefetch()` acotado por condiciones o ventana temporal para relaciones Many-to-Many o consultas inversas a TimescaleDB.
   - **Serialización en Lote:** Si un serializador requiere datos relacionados complejos, implementar `list_serializer_class` para precargar en lote en memoria O(1) en lugar de consultar dentro de `to_representation`.
2. **Caché Distribuido en Redis (DB 2):**
   - Endpoints de alta concurrencia que alimentan dashboards globales deben usar `cache.get()` con TTL de 15 segundos para soportar decenas de operadores concurrentes en < 2ms sin saturar PostgreSQL.
3. **Task Routing y Despacho en Celery:**
   - Colas dedicadas: `high_priority` (alertas y notificaciones), `monitoring` (sondeos periódicos), `background` (WHOIS, SSL, reportes pesados).
   - Siempre activar `CELERY_TASK_ACKS_LATE=True`, `CELERY_WORKER_PREFETCH_MULTIPLIER=1`, `-O fair`.
   - Limpieza en Redis DB 1: `CELERY_TASK_IGNORE_RESULT=True` en tareas periódicas y `CELERY_RESULT_EXPIRES=1800`.
4. **Connection Pooling:**
   - Mantener `CONN_MAX_AGE=60` y `CONN_HEALTH_CHECKS=True` en `settings/base.py` para reutilización de sockets TCP.

---

## 💻 8. Convenciones de Entorno y Directorio Único

- **Directorio Raíz Único del Proyecto:** `C:\Users\feshernandez\GC_OPS_OBS\`
- **Regla Estricta:** Todo el código, configuración de Docker, frontend, backend y documentación reside y se ejecuta EXCLUSIVAMENTE en `C:\Users\feshernandez\GC_OPS_OBS\`. No se debe consultar ni sincronizar con ninguna otra carpeta externa.
- **Comandos de Reinicio de Contenedores:**
  ```powershell
  # Backend y Workers
  docker restart sentinel_backend
  docker restart sentinel_celery_worker
  docker restart sentinel_celery_beat

  # Frontend
  docker restart sentinel_frontend
  ```
- **Verificaciones Previas al Commit:**
  ```powershell
  # 1. Frontend: TypeScript debe compilar con 0 errores
  cd frontend; npm run build; cd ..

  # 2. Backend: Pruebas unitarias y migraciones
  docker exec -it sentinel_backend python manage.py check
  docker exec -it sentinel_backend python manage.py test accounts common monitoring
  ```
