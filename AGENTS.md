# Project: Sentinel (GC_OPS_OBS)

## 📌 Contexto General del Proyecto
**Sentinel** es una plataforma de observabilidad y operaciones (NOC / Observabilidad operativa) orientada a la monitorización y automatización de infraestructura y servicios críticos.

## 🛠️ Stack Tecnológico
- **Backend:** Python 3.13 / Django REST Framework, Celery para tareas asíncronas / background workers.
- **Base de Datos:** PostgreSQL con extensión TimescaleDB para métricas de series de tiempo.
- **Cache / Message Broker:** Redis.
- **Observabilidad / Agentes:** Grafana Alloy, Prometheus relabeling / exporters.
- **Frontend:** React + TypeScript con Vite, componentes de UI para dashboards de monitorización de infraestructura.
- **Contenedores:** Docker & Docker Compose (`docker-compose.yml`).

## 📁 Reglas del Proyecto
Este proyecto contiene especificaciones y estándares detallados en la carpeta [`.clinerules/`](file:///.clinerules/):
- `00-sentinel-master.md`: Reglas maestras del proyecto.
- `01-architecture.md`: Arquitectura del sistema.
- `02-tech-stack.md`: Stack tecnológico y dependencias.
- `03-backend.md`: Estándares de backend y endpoints.
- `04-frontend.md`: Estándares de frontend y componentes.
- `05-database.md`: Modelado y base de datos TimescaleDB.
- `06-coding-standards.md`: Estándares de código y buenas prácticas.
- `07-roadmap.md`: Fases y roadmap de producto.

## 🚀 Estado de Avances Realizados
- **Slice 4 (SSL + DNS + Domain / Uptime & Latencia):** Implementado al 100% (6 fases completadas):
  1. *Fase 1:* Escaneo Manual bajo Demanda (`POST /api/v1/monitoring/{id}/scan/`).
  2. *Fase 2:* Gráfica Histórica de Latencia ([`LatencyChart.tsx`](file:///frontend/src/components/monitoring/LatencyChart.tsx)).
  3. *Fase 3:* Nivel de Servicio SLA & Disponibilidad ([`SLACard.tsx`](file:///frontend/src/components/monitoring/SLACard.tsx)).
  4. *Fase 4:* Buscador & Filtros Rápidos por Estado.
  5. *Fase 5:* Configuración HTTP Avanzada & Encabezados Custom ([`TargetForm.tsx`](file:///frontend/src/components/monitoring/TargetForm.tsx)).
  6. *Fase 6:* Botón directo "Vincular Alerta" (1-Clic hacia `/alerts`).
- **Modernización NOC Uptime & Latencia (UI, UX & Funcionalidades):**
  - KPI Cards de Nivel Superior (Disponibilidad Global SLA, Latencia Promedio, Salud y Auto-refresco en vivo).
  - Rediseño de [`TargetCard.tsx`](file:///frontend/src/components/monitoring/TargetCard.tsx) con radar pulsante y micro-bloques de disponibilidad (sparklines).
  - Vista de Tabla Compacta ([`TargetTableView.tsx`](file:///frontend/src/components/monitoring/TargetTableView.tsx)) con selector de vista (Grid vs Tabla).
  - Slide-Over Drawer lateral ([`TargetDetailDrawer.tsx`](file:///frontend/src/components/monitoring/TargetDetailDrawer.tsx)) para inspección de métricas sin salir de la lista.
  - Test de Conexión en Vivo en [`TargetForm.tsx`](file:///frontend/src/components/monitoring/TargetForm.tsx) con endpoint `POST /api/v1/monitoring/test-connection/`.
  - Acciones en Lote (Bulk Actions) para escanear, pausar, reanudar o eliminar targets en masa (`POST /api/v1/monitoring/bulk-action/`).
- **Correcciones de entorno Docker:** Configuración de Celery en `backend/config/settings/base.py` optimizada para workers y broker Redis.
- **Scripts de Alloy:** `extract_metrics.py` en `scripts_alloy/` para parseo de métricas de Windows y generación de regex relabeling para Grafana Alloy.
