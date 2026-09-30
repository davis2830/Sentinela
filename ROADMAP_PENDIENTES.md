# 🛡️ Sentinel (GC_OPS_OBS) - Tracker de Tareas y Roadmap Pendiente

> **Ubicación del Proyecto:** `C:\Users\feshernandez\GC_OPS_OBS`  
> **Última actualización:** 30 de Septiembre de 2026  
> **Tracker Principal Unificado:** [docs/ROADMAP_TRACKER.md](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/ROADMAP_TRACKER.md)  
> **Estado:** Documento vivo de seguimiento y avance continuo.

---

## 📊 Resumen Ejecutivo de Estado

| Módulo / Iniciativa | Estado | Prioridad | Progreso |
| :--- | :---: | :---: | :---: |
| **1. Guardianes Sentinine (LAN & Private Probes)** | 🟢 Completado (100%) | Alta | Rebranding a Sentinine, Celery watchdog, bypass SSL y TargetForm integrados |
| **2. Planes, Suscripciones y Cuotas** | 🟢 Completado (100%) | Alta | Enforcement en 10 módulos (HTTP 403 `QUOTA_EXCEEDED`) y Celery Beat trials |
| **3. Automatización de Pruebas (Pytest / Playwright)** | 🟡 En Progreso (50%) | Alta | k6 al 100%; falta Pytest (Lógica de negocio) y Playwright (E2E) |
| **4. Visor de Logs con Loki (`sentinel_loki`)** | ⚪ Pendiente (Fase 2) | Media | Infraestructura en Docker lista; falta UI Log Stream Viewer |
| **5. Telemetría de Host (`scripts_alloy`)** | ⚪ Pendiente (Fase 2) | Media | Scripts listos; falta visualización en targets |
| **6. Runbooks Operativos (SOPs)** | ⚪ Pendiente (Fase 2) | Media | Definido en Roadmap; por diseñar e implementar |
| **7. Ventanas de Mantenimiento Programadas** | 🟢 Completado (100%) | Alta | Implementado al 100% en backend y frontend con auto-sync a Status Page |

---

## 🐕 1. Guardianes Sentinine (Sentinel Watchdogs & Private Probes)

Permite a Sentinel auditar infraestructura privada, bases de datos locales y servicios en redes internas (on-premise o VPCs) sin abrir puertos hacia internet.

### Componentes Oficiales:
- **Agente Ligero:** `sentinine/agent.py` (Script Python autónomo con soporte SSL autofirmado, DNS y TCP), `sentinine/Dockerfile`, `sentinine/docker-compose.yml`, `sentinine/install.sh` y `sentinine/install.ps1`.
- **Backend API:** `backend/monitoring/views.py` (`AgentProbeListView`, `AgentProbeDetailView`, `AgentProbeHeartbeatView`, `AgentProbeSubmitResultsView`).
- **Watchdog Celery:** Tarea periódica `check_sentinine_heartbeats` en Celery Beat para detección de desconexión y alerta crítica.
- **Frontend:** `frontend/src/components/monitoring/CreateProbeModal.tsx` con comando docker `sentinel/sentinine:latest`, `ProbeDirectoryDrawer.tsx` con telemetría en vivo, `TargetForm.tsx` con auto-detección de IPs privadas, y badges reactivos en `TargetCard.tsx` y `TargetDetailDrawer.tsx`.

---

## 💳 2. Sistema de Suscripciones, Planes y Límites (Billing & Quotas)

Garantiza la monetización y el control de consumo de recursos por organización según su plan (Free, Pro, Business, Enterprise).

### Componentes Actuales:
- **Definición de Cuotas:** `backend/organizations/services.py` (`QuotaService`, `PLAN_LIMITS`).
- **Frontend:** `frontend/src/components/organizations/UpgradePlanModal.tsx` y `TrialStatusBanner.tsx`.

### 📋 Tareas por Realizar:
- [ ] **Enforcement Estricto en Backend:**
  - [ ] Targets de monitoreo: Máximo 5 en plan Free (el 6to debe responder `403 QUOTA_EXCEEDED`).
  - [ ] Frecuencia de sondeo: Mínimo 5 min en Free, 1 min en Pro, 30s en Enterprise.
  - [ ] Certificados SSL y API Checks: Bloqueo al superar cuota del plan.
  - [ ] Agentes Satélite: 0 en Free, 2 en Pro, ilimitados en Business/Enterprise.
- [ ] **Intercepción Reactiva en Frontend:** Disparar automáticamente el `UpgradePlanModal` cuando cualquier llamada devuelva error de cuota.
- [ ] **Flujo de Auto-Servicio de Plan:** Permitir a los administradores solicitar o cambiar de plan desde la página de Organización/Facturación.

---

## 🧪 3. Automatización Integral de Pruebas

Garantizar la estabilidad de Sentinel ante cada cambio y despliegue continuo.

### Componentes Actuales:
- **Nivel 2 (Rendimiento k6):** `tests_perf/` con 5 escenarios listos, runners interactivos y reportes HTML dark mode (**100% Completado**).

### 📋 Tareas por Realizar:
- [ ] **Nivel 1: Pruebas Unitarias y de Lógica de Negocio (Pytest DRF):**
  - [ ] Crear `backend/tests/test_plan_limits.py` para validar cuotas de suscripciones.
  - [ ] Crear `backend/tests/test_multi_tenant.py` para aislar datos entre organizaciones (evitar fugas IDOR).
  - [ ] Validar roles RBAC (`Viewer`, `Operator`, `Admin`).
  - [ ] Validar motor de deduplicación y anti-flapping de alertas.
- [ ] **Nivel 3: Pruebas E2E de Usuario Real (Playwright):**
  - [ ] Flujo completo de registro y alta de organización (`/register` -> `/dashboard`).
  - [ ] Creación de objetivo con test de conexión en vivo TLS.
  - [ ] Verificación de despliegue del modal de upgrade al superar cuota.

---

## 📜 4. Visor Centralizado de Logs con Loki (`sentinel_loki`)

Permite a los operadores diagnosticar incidentes inspeccionando los logs de los servicios directamente desde la plataforma.

### Componentes Actuales:
- Contenedores de infraestructura `loki` (`grafana/loki:3.0.0`) y `promtail` definidos en `docker-compose.yml`.

### 📋 Tareas por Realizar:
- [ ] **Endpoint Backend de Consulta Loki:** Proxy autenticado para consultar trazas y logs vía LogQL hacia `http://sentinel_loki:3100`.
- [ ] **Log Stream Viewer en Frontend:** Componente de consola/terminal en tiempo real dentro del Drawer de objetivos e incidentes con filtro por nivel (`INFO`, `WARN`, `ERROR`).

---

## 📈 5. Telemetría de Servidores y Host con Grafana Alloy

Supervisión integral de rendimiento de hardware en servidores y máquinas virtuales.

### Componentes Actuales:
- Script de extracción y relabeling en `scripts_alloy/extract_metrics.py`.

### 📋 Tareas por Realizar:
- [ ] Conectar la ingesta de métricas de CPU, Memoria y Disco hacia Sentinel.
- [ ] Mostrar micro-gauges de uso de recursos en las tarjetas técnicas de monitoreo.

---

## 🛠️ 6. Fase 2: Runbooks Operativos (SOPs)

Manuales de procedimiento estandarizados para contingencias operativas.

### 📋 Tareas por Realizar:
- [ ] Modelo de datos en backend para `Runbook` y `RunbookStep`.
- [ ] Editor interactivo de pasos tipo checklist (markdown / enriquecido).
- [ ] Vinculación directa con Reglas de Alerta e Incidentes (botón *"Abrir Runbook de Mitigación"* en el Drawer).
- [ ] Trazabilidad de ejecución: Registro del operador que completó cada paso de contingencia.

---

## 📅 7. Fase 2: Ventanas de Mantenimiento Programadas

Gestión de periodos de parada programada para evitar falsos positivos y proteger el SLA reportado.

### 📋 Tareas por Realizar:
- [ ] CRUD de ventanas de mantenimiento en `MaintenancePage.tsx`.
- [ ] Supresión inteligente de notificaciones y marcado especial en la gráfica de disponibilidad sin penalizar el SLA del mes.

---

## 🚀 Registro de Avances Recientes (Completados al 100%)

- [x] **Optimización de Rendimiento y Erradicación N+1:** Latencia promedio reducida a 22.36 ms (TimescaleDB + Redis DB 2).
- [x] **Modernización Visual del Dashboard NOC:** Rediseño estético Dark Mode, integración de Recharts PieChart para la dona de infraestructura y exclusión mutua estricta de estados.
- [x] **Suite de Pruebas k6:** 5 escenarios de carga y estrés con reportes visuales en `tests_perf/`.
- [x] **Persistencia de Vistas (Tabla vs Cuadros):** Implementado en los 10 módulos principales mediante `usePersistentViewMode`.
- [x] **Slice 4 Integral:** Módulos de Uptime, SSL Multi-puerto, DNS Extendido, WHOIS con Anti-Hijacking, API Checks Sintéticos y Cabeceras de Seguridad con generación de snippets y detección de Server Leaks.
