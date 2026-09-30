# 📝 Bitácora Técnica de Implementaciones (Changelog de Ingeniería)

Este documento registra cronológicamente cada cambio, refactorización, optimización y nueva funcionalidad implementada en Sentinel, detallando los archivos afectados, decisiones técnicas y validaciones realizadas.

---

## 📌 Plantilla de Registro para Nuevas Implementaciones

```markdown
### [AAAA-MM-DD] - Título Breve de la Implementación
- **Módulo / Componente:** (ej. Monitoring / Alerts / Incidents / UI)
- **Motivación / Requerimiento:** Contexto de la necesidad de negocio o técnica.
- **Cambios en Backend:**
  - `ruta/archivo.py`: Breve descripción de la lógica, modelo o endpoint añadido/modificado.
- **Cambios en Frontend:**
  - `ruta/Componente.tsx`: Componentes creados o modificados, hooks o estados.
- **Base de Datos / Migraciones:** Nuevas tablas, índices o migraciones aplicadas.
- **Validaciones & Pruebas:** Comprobaciones realizadas (k6, pytest, validación visual en navegador).
```

---

## 📅 Registro Histórico de Implementaciones

### [2026-09-30] - Rebranding a Sentinine & Consolidación al 100% de Probes LAN
- **Módulo:** `monitoring`, `sentinine`, `alerts`, Celery Beat.
- **Motivación:** Renombrar la arquitectura de sondas privadas a **Sentinine** (Sentinel Watchdog), agregar detección de desconexión en Celery, soporte de intranet SSL autofirmada y selector amigable en `TargetForm`.
- **Cambios en Backend:**
  - `backend/monitoring/tasks.py`: Tarea Celery Beat `check_sentinine_heartbeats` (cada 60s) que transiciona agentes inactivos (>45s) a `offline` y dispara alertas críticas operativas.
  - `backend/config/settings/base.py`: Registrada tarea periódica `check-sentinine-heartbeats-every-60s` en `CELERY_BEAT_SCHEDULE`.
  - `backend/monitoring/models.py`: Generador de tokens con prefijo oficial `snt_live_...`.
  - `backend/monitoring/services.py`: Soporte dual para tokens `snt_live_...` y retrocompatibilidad con `prb_live_...`.
  - `backend/monitoring/serializers.py`: Expuestos `agent_probe_status` y `agent_probe_online` en `MonitoringTargetSerializer`.
  - `backend/monitoring/views.py`: Comando docker oficial `sentinel/sentinine:latest` y descripción de auditoría para Sentinine.
  - `backend/test_probe_e2e.py`: Test E2E validando ciclo completo, token `snt_live_`, reporte de checks y watchdog de desconexión.
- **Cambios en Agente (`sentinine/`):**
  - `sentinine/agent.py`: Agente v1.1.0 con soporte para `SENTININE_INSECURE_SKIP_VERIFY`, resolución DNS, conexiones TCP a bases de datos y User-Agent oficial `Sentinine/1.1.0`.
  - `sentinine/Dockerfile`, `sentinine/docker-compose.yml`, `sentinine/install.sh` y `sentinine/install.ps1`.
- **Cambios en Frontend:**
  - `frontend/src/components/monitoring/CreateProbeModal.tsx`: Rebrand completo a "Guardián Sentinine", comando Docker y pasos de despliegue.
  - `frontend/src/components/monitoring/ProbeDirectoryDrawer.tsx`: Rebrand a "Guardianes Sentinine", telemetría en vivo y badges de estado.
  - `frontend/src/pages/MonitoringPage.tsx`: Botón superior "Sentinine ({count})".
  - `frontend/src/components/monitoring/TargetForm.tsx`: Selector interactivo de ejecutor (Nube Sentinel vs Sentinine LAN) con auto-detección de IPs privadas.
  - `frontend/src/components/monitoring/TargetCard.tsx`, `TargetTableView.tsx` y `TargetDetailDrawer.tsx`: Badges semánticos morados y alerta roja cuando el Sentinine asignado está offline.
- **Validaciones:**
  - `backend/test_probe_e2e.py` ejecutado con éxito (0 errores).
  - TypeScript compilado con `npm run build` sin errores.

---

### [2026-09-30] - Sistema Centralizado de Documentación y Contexto Vivo
- **Módulo:** Documentación del Proyecto / Arquitectura.
- **Motivación:** Mantener una fuente única de verdad para el contexto técnico, avances del roadmap y registro de decisiones de ingeniería.
- **Archivos Creados:**
  - [`docs/README.md`](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/README.md): Índice principal de documentación.
  - [`docs/ROADMAP_TRACKER.md`](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/ROADMAP_TRACKER.md): Matriz de avance por fases (Fase 1 completada, Fase 2 en curso, Fase 3 futura).
  - [`docs/IMPLEMENTATION_LOG.md`](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/IMPLEMENTATION_LOG.md): Bitácora técnica estructurada.
  - [`docs/MODULE_INVENTORY.md`](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/MODULE_INVENTORY.md): Mapeo completo de modelos, endpoints y vistas frontend.
  - [`docs/DEV_WORKFLOW.md`](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/DEV_WORKFLOW.md): Guía de desarrollo, sincronización con Docker y diseño UI.
  - [`README.md`](file:///c:/Users/feshernandez/GC_OPS_OBS/README.md): Portada del repositorio con visión general y accesos rápidos.

---

### [2026-09-29] - Motor de Agentes Satélite (Private Probes para Redes Internas)
- **Módulo:** `monitoring` & `sentinel_probe`
- **Motivación:** Permitir el monitoreo de endpoints LAN, bases de datos locales y VPCs privadas sin requerir apertura de puertos de entrada hacia internet.
- **Cambios en Backend:**
  - `backend/monitoring/models.py`: Modelos `AgentProbe` con token seguro hasheado y campo `runner_type` (`cloud` vs `agent`) en `MonitoringTarget`.
  - `backend/monitoring/services.py`: `AgentProbeService` para creación de tokens (`prb_live_...`), procesamiento de heartbeats y recepción de resultados.
  - `backend/monitoring/views.py`: Vistas REST `AgentProbeListView`, `AgentProbeDetailView`, `AgentProbeHeartbeatView` y `AgentProbeSubmitResultsView`.
  - `backend/monitoring/tasks.py`: Modificada la tarea `schedule_all_checks` para excluir targets asignados a probes (`runner_type="agent"`).
  - `sentinel_probe/agent.py`: Script Python autónomo ligero para ejecución en contenedor Docker o binario directo.
- **Cambios en Frontend:**
  - `frontend/src/components/monitoring/CreateProbeModal.tsx`: Modal para registrar agente satélite con comando Docker listo para copiar.
  - `frontend/src/components/monitoring/ProbeDirectoryDrawer.tsx`: Drawer de administración de sondas activas, métricas de host y estado.
  - `frontend/src/components/monitoring/TargetDetailDrawer.tsx` y `TargetCard.tsx`: Badges semánticos púrpura identificando objetivos sondeados por agente LAN.
- **Validaciones:**
  - Ejecutado script end-to-end [`backend/test_probe_e2e.py`](file:///c:/Users/feshernandez/GC_OPS_OBS/backend/test_probe_e2e.py) validando registro, despacho de tareas en heartbeat y actualización de latencia en base de datos.

---

### [2026-09-28] - Erradicación de N+1 Queries & Optimización de Base de Datos
- **Módulo:** `monitoring`, `alerts`, `incidents`, `config`
- **Motivación:** Resolver cuellos de botella severos bajo concurrencia en TimescaleDB y reducir la latencia p95.
- **Cambios en Backend:**
  - `backend/monitoring/serializers.py`: Prefetch optimizado con ventana de tiempo de 1 hora (`checked_at__gte=since_1h`) más `select_related('owner_team', 'agent_probe')`, reduciendo de 11 queries a 0 queries en serialización.
  - `backend/alerts/serializers.py`: Implementado `AlertListSerializer` con precarga en lote (`alert_id IN (...)`) y resolución en memoria O(1), reduciendo 40 queries a 1 sola query.
  - `backend/incidents/views.py`: Implementado `.annotate(alerts_count_annotated=Count('incident_alerts'))` suprimiendo queries COUNT(*) repetitivas.
  - `backend/config/settings/base.py`: Activado connection pooling `CONN_MAX_AGE=60` y `CONN_HEALTH_CHECKS=True`.
  - `backend/monitoring/views.py` & `backend/incidents/views.py`: Activada caché en Redis (DB 2) con TTL de 15 segundos para `/global-performance/` y `/incidents/stats/`.
- **Base de Datos:**
  - Creado índice B-Tree `incidents_incidentalert_alert_id_idx` sobre `alert_id` en `incidents_incident_alert`.
- **Validaciones:**
  - Benchmark con Grafana k6: Latencia promedio reducida a **22.36 ms** y p95 a **38.81 ms** (40.7% de mejora con 0% de errores).

---

### [2026-09-25] - Modernización Visual y Operativa del Dashboard NOC
- **Módulo:** `frontend/src/components/dashboard/` & `DashboardPage.tsx`
- **Motivación:** Estandarizar la interfaz según la paleta estricta Dark Mode (#090D11, #111720) y proporcionar máxima densidad operativa.
- **Cambios en Frontend:**
  - Creada arquitectura modular de 7 widgets bajo `frontend/src/components/dashboard/`:
    - `NOCDashboardHeader.tsx`: Reloj con segundero, selector de ventana temporal y contador dinámico.
    - `NOCExecutiveKpis.tsx`: 5 tarjetas KPI ejecutivas con sparklines SVG y donut gauge de seguridad.
    - `NOCPerformanceSection.tsx`: Gráfica de área Recharts multieje (Disponibilidad, Latencia, RPS) y barra de microservicios.
    - `NOCInfraHealthDonut.tsx`: Donut chart SVG proporcional de salud de infraestructura.
    - `NOCRecentActivityFeed.tsx`: Feed cronológico reactivo con badges por estado.
    - `NOCCriticalTargetsTable.tsx`: Tabla de servicios críticos priorizada por severidad.
    - `NOCLiveAlertsList.tsx`: Lista unificada de alarmas con enlace directo a incidentes.
- **Validaciones:**
  - Compilación limpia con Vite (0 errores TypeScript) y verificación visual en navegador.

---

### [2026-09-20] - Módulo de Ventanas de Mantenimiento Programadas (Fase 2)
- **Módulo:** `maintenance`, `status_page`, `alerts`
- **Motivación:** Evitar falsos positivos y proteger el SLA mensual durante labores de mantenimiento programadas en infraestructura.
- **Cambios en Backend:**
  - `backend/maintenance/models.py`: Modelo `MaintenanceWindow` con soporte de recurrencia (semanal, mensual) y alcance por organización o targets específicos.
  - `backend/maintenance/services.py`: Sincronización automática con `ScheduledMaintenance` de la Status Page pública.
  - `backend/alerts/services.py`: Supresión de notificaciones externas en `AlertService.create_alert` si el target está dentro de una ventana de mantenimiento activa.
  - `backend/reports/services.py`: Exclusión de minutos caídos en cálculo de disponibilidad para targets bajo mantenimiento.
- **Cambios en Frontend:**
  - `frontend/src/pages/MaintenancePage.tsx`: Vista completa con `NOCPageHeader`, 4 KPIs, `NOCToolbar`, persistencia de vista (Cards vs Tabla) y `MaintenanceDetailDrawer.tsx`.
