# 🗺️ Sentinel Roadmap & Tracker de Tareas

> **Estado:** Documento vivo de seguimiento del proyecto Sentinel.  
> **Última actualización:** 30 de Septiembre de 2026.

---

## 📊 Resumen General del Progreso

```
[████████████████████] Fase 1: Plataforma de Observabilidad (100% Completada)
[██████░░░░░░░░░░░░░░] Fase 2: Asistencia Operativa (30% En Progreso)
[░░░░░░░░░░░░░░░░░░░░] Fase 3: Automatización y AI Ops (Planificada)
```

---

## 🟢 Fase 1: Plataforma de Observabilidad (MVP Completado al 100%)

Objetivo: *Construir una plataforma enterprise de observabilidad, monitorización continua y detección temprana de fallas.*

| Módulo / Iniciativa | Estado | Descripción & Entregables |
| :--- | :---: | :--- |
| **NOC Executive Dashboard** | ✅ Completado | Dashboard interactivo con Recharts multieje, KPIs ejecutivas, matriz de microservicios, dona SVG de salud y feed cronológico en vivo. |
| **Monitoreo Uptime & Latencia** | ✅ Completado | Sondeo HTTP/S, TCP, Ping, DNS. Gráfica histórica de latencia, medidor de SLA, test de conexión en vivo y slide-over drawer de inspección. |
| **Monitoreo SSL Criptográfico** | ✅ Completado | Inspección multi-puerto (:443, :8443, :636, :993), evaluación de seguridad A+ a F, barra de vida útil, test TLS en vivo y exportación ISO 27001 CSV. |
| **Registros DNS & Mutaciones** | ✅ Completado | Tipos A, AAAA, MX, TXT, NS, CNAME, SOA, PTR, CAA. Detección de SPF/DMARC, medición de latencia en ms y diff visual de mutaciones (+/-). |
| **Dominios & WHOIS** | ✅ Completado | Alerta de candado anti-secuestro EPP (`clientTransferProhibited`), semáforo de expiración ICANN y auditoría de nameservers. |
| **API Checks Sintéticos** | ✅ Completado | Pruebas HTTP avanzadas (POST, PUT, DELETE, etc.), headers, auth, inferencia de Schema JSON en 1-clic y exportación cURL. |
| **Cabeceras de Seguridad** | ✅ Completado | Análisis HSTS, CSP, XFO, detección de fugas CWE-200 (Server banner leaks) y generador de snippets (Nginx, Apache, Caddy, Cloudflare, IIS). |
| **Smart Alerts Engine** | ✅ Completado | 14 condiciones, 6 reglas auto-aprovisionadas, deduplicación `xN`, anti-flapping ($\ge 3$ en 15m), Smart Snooze y dry-run simulador. |
| **Gestión de Incidentes (ITIL)** | ✅ Completado | Hitos SRE (MTTA/MTTR), asignación de operador y squad (`assigned_team`), RCA post-mortem estructurado y bitácora en vivo. |
| **Reportes & Error Budget** | ✅ Completado | Presupuesto de error SRE en vivo con burn rate, selector granular de servicios, exportación PDF ejecutivo y CSV con UTF-8 BOM. |
| **Status Pages Multi-Empresa** | ✅ Completado | Aislamiento multi-tenant para portales de clientes, componente picker con nombres amigables, suscriptores email y barra de 90 días con latencia 24h. |
| **Canales de Notificación** | ✅ Completado | Email, Slack, Teams, Telegram, Discord, Webhook. Quiet hours, bypass crítico, límite de tasa, test en vivo y retry en 1-clic. |
| **Usuarios, Equipos & Perfil** | ✅ Completado | Squads (`Team`) con Team Lead, RBAC, API tokens personales con revocación, alarma acústica dual-tone y logs individuales. |
| **Arquitectura Multi-Tenant & SaaS** | ✅ Completado | Separación Superadmin vs Tenant Admin, cuotas en 10 recursos (HTTP 403 `QUOTA_EXCEEDED`) y Celery Beat para trials vencidos. |
| **Rendimiento & Erradicación N+1** | ✅ Completado | TimescaleDB hypertable query slicing, DRF ListSerializer batching, Redis DB 2 caching (latencia k6 reducida a 22.36 ms). |

---

## 🟡 Fase 2: Asistencia Operativa (En Progreso)

Objetivo: *Proveer herramientas de contexto, procedimientos estandarizados y diagnóstico en vivo para acelerar la resolución de incidentes por el operador.*

| Iniciativa / Funcionalidad | Prioridad | Estado | Tareas Técnicas Pendientes |
| :--- | :---: | :---: | :--- |
| **1. Guardianes Sentinine (LAN & On-Premise Probes)** | Alta | ✅ 100% | - [x] Rebranding oficial a **Sentinine** (Sentinel Watchdog).<br>- [x] Agente autónomo en `sentinine/agent.py` con bypass SSL autofirmado (`INSECURE_SKIP_VERIFY`), DNS y TCP.<br>- [x] Contenedor Docker oficial `sentinel/sentinine:latest` y `docker-compose.yml`.<br>- [x] Scripts de instalación rápida (`install.sh` y `install.ps1`).<br>- [x] Watchdog en Celery Beat (`check_sentinine_heartbeats`) para transición a `offline` y alerta crítica.<br>- [x] Manejo visual de targets huérfanos con badge offline en `TargetCard`, `TargetTableView` y `TargetDetailDrawer`.<br>- [x] Selector interactivo con auto-detección de IPs privadas en `TargetForm.tsx`.<br>- [x] Pruebas E2E de ciclo de vida completo validadas en `backend/test_probe_e2e.py`. |
| **2. Ventanas de Mantenimiento Programadas** | Alta | ✅ 100% | - [x] CRUD en `MaintenancePage.tsx` y `backend/maintenance/`.<br>- [x] Sincronización automática con Status Page de clientes.<br>- [x] Supresión inteligente de alertas externas durante ventanas activas.<br>- [x] Exclusión de penalización de downtime en cálculo de SLA mensual. |
| **3. Visor de Logs con Loki (`sentinel_loki`)** | Media | ⚪ 15% | - [x] Contenedor `sentinel_loki` (puerto 3100) y `promtail` en `docker-compose.yml`.<br>- [ ] Endpoint backend autenticado tipo proxy para consultas LogQL filtradas por organización y objetivo.<br>- [ ] Componente UI *Log Stream Viewer* (consola con auto-scroll, filtros por severidad `INFO`, `WARN`, `ERROR` y buscador de texto) dentro del drawer de targets e incidentes. |
| **4. Runbooks Operativos (SOPs)** | Media | ⚪ Pendiente | - [ ] Modelos de datos `Runbook` y `RunbookStep` en backend.<br>- [ ] Editor interactivo de procedimientos en markdown / checklist.<br>- [ ] Botón *"Abrir Runbook de Mitigación"* en el Drawer de Alertas e Incidentes.<br>- [ ] Trazabilidad de ejecución con marca de tiempo y operador que marcó cada paso. |
| **5. Telemetría de Servidores (Grafana Alloy)** | Media | ⚪ 20% | - [x] Script de extracción y relabeling de métricas de host en `scripts_alloy/extract_metrics.py`.<br>- [ ] Ingesta periódica de métricas de CPU, Memoria y Disco de servidores en Sentinel.<br>- [ ] Micro-gauges de consumo de hardware en el drawer técnico de objetivos. |
| **6. Acciones Sugeridas & Aprobaciones** | Baja | ⚪ Pendiente | - [ ] Reglas determinísticas de recomendación de acciones ante incidentes.<br>- [ ] Flujo de aprobación de 4 ojos antes de ejecutar cambios operativos críticos. |

---

## 🟣 Fase 3: Automatización y AI Ops (Planificada)

Objetivo: *Automatizar operaciones de remediación de forma segura y aplicar inteligencia artificial para optimizar el MTTR.*

| Iniciativa | Estado | Descripción |
| :--- | :---: | :--- |
| **Integración con AWX / Ansible** | ⚪ Planificado | Despacho de playbooks de remediación (reinicio de servicios, escalado, purga de caché) con control de acceso y bitácora. |
| **Grafo de Dependencias & Blast Radius** | ⚪ Planificado | Mapa topológico interactivo que visualice relaciones entre microservicios, bases de datos y APIs para calcular el impacto de una falla. |
| **ChatOps Bidireccional** | ⚪ Planificado | Bots interactivos para Slack, Discord y Telegram con comandos para reconocer incidentes, consultar estado y ejecutar runbooks. |
| **AI Ops & Generador de RCA** | ⚪ Planificado | Asistente de IA para explicación de incidentes, detección de anomalías y redacción automática del reporte Post-Mortem. |
| **Módulo de Compliance Continuo** | ⚪ Planificado | Recolección automatizada de evidencias para auditorías SOC 2, ISO 27001 y PCI-DSS. |

---

## 🧪 Estrategia de Pruebas & Calidad Continua

- [x] **Nivel 1 (Unitarias & Negocio en Django):** Pruebas unitarias de cuentas, permisos multi-tenant, seguridad y monitoreo (`python manage.py test accounts common monitoring`) integradas en CI con 0 fallos.
- [x] **Nivel 2 (Rendimiento & Carga con k6):** 5 escenarios en [`tests_perf/`](file:///c:/Users/feshernandez/GC_OPS_OBS/tests_perf/) con benchmark verificado: 2,017 peticiones procesadas a 40 VUs, latencia media de 29.22 ms y p95 de 48.84 ms (0% errores).
- [x] **Nivel 3 (CI/CD & DevSecOps Automatizado):** Pipelines GitHub Actions ([`.github/workflows/ci.yml`](file:///c:/Users/feshernandez/GC_OPS_OBS/.github/workflows/ci.yml) y [`.github/workflows/cd.yml`](file:///c:/Users/feshernandez/GC_OPS_OBS/.github/workflows/cd.yml)) con escaneo de vulnerabilidades (`pip-audit`, Trivy), build Vite en TypeScript y despliegue Zero-Downtime.
- [x] **Nivel 4 (Production Readiness & AppSec):** Plan Maestro y Checklist Go-Live ([`docs/PRODUCTION_READINESS.md`](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/PRODUCTION_READINESS.md) y [`docs/GO_LIVE_CHECKLIST.md`](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/GO_LIVE_CHECKLIST.md)) completados al 100% en sus 4 fases.
- [ ] **Nivel 5 (E2E con Playwright):**
  - [ ] Flujo sintético de navegador: Registro &rarr; Wizard &rarr; Creación de Target &rarr; Alerta &rarr; Incidente.
