# 🧭 Índice del Centro de Documentación de Sentinel

> **Ubicación del Proyecto:** `C:\Users\feshernandez\GC_OPS_OBS`  
> **Plataforma:** Sentinel NOC / Observabilidad Operativa SaaS  
> **Stack:** Python 3.13, Django REST Framework, TimescaleDB (PostgreSQL 16), Celery, Redis, React 18, Vite, TypeScript, Docker.  
> **Documento Maestro Central:** [`AGENTS.md`](file:///c:/Users/feshernandez/GC_OPS_OBS/AGENTS.md)

Este directorio constituye la **documentación viva y técnica** de Sentinel. Los agentes y desarrolladores deben apoyarse en estos documentos para profundizar en cualquier área técnica o de arquitectura.

---

## 📚 Catálogo de Documentación Viva (`docs/`)

| Documento | Propósito | Enlace |
| :--- | :--- | :--- |
| **`ROADMAP_TRACKER.md`** | **Única fuente de verdad del Roadmap:** Fases 1 (100%), Fase 2 (30%), Fase 3 y backlog priorizado. | [Ver Roadmap](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/ROADMAP_TRACKER.md) |
| **`MODULE_INVENTORY.md`** | **Catálogo de los 18 Módulos:** Mapeo de rutas frontend, apps backend, modelos, endpoints REST y Celery. | [Ver Inventario](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/MODULE_INVENTORY.md) |
| **`IMPLEMENTATION_LOG.md`** | **Bitácora Cronológica de Ingeniería:** Registro detallado de cambios, decisiones técnicas y validaciones. | [Ver Bitácora](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/IMPLEMENTATION_LOG.md) |
| **`DEV_WORKFLOW.md`** | **Convenciones & Diseño NOC:** Comandos Docker, tokens semánticos de color, normas de ORM N+1 y pre-commit. | [Ver Flujo de Trabajo](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/DEV_WORKFLOW.md) |
| **`TESTING_STRATEGY.md`** | **Estrategia Integral de Pruebas:** Pirámide de automatización (Pytest DRF, k6 rendimiento y Playwright E2E). | [Ver Estrategia de Pruebas](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/TESTING_STRATEGY.md) |
| **`PRODUCTION_READINESS.md`** | **Plan Maestro de Producción:** Scorecard ejecutivo 100%, 6 pilares de seguridad AppSec y hardening. | [Ver Plan a Producción](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/PRODUCTION_READINESS.md) |
| **`PRODUCTION_SECURITY.md`** | **Hardening de Variables & TLS:** Directrices de configuración segura de producción (`settings.prod`). | [Ver Seguridad en Prod](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/PRODUCTION_SECURITY.md) |
| **`GO_LIVE_CHECKLIST.md`** | **Manual Operativo & Runbook Go-Live:** Verificaciones pre-vuelo (T-48h a T-0), Día-2 y protocolo rollback. | [Ver Runbook Go-Live](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/GO_LIVE_CHECKLIST.md) |

---

## 🔗 Referencias Cruzadas del Repositorio

- **Documento Maestro Central para Agentes:** [`AGENTS.md`](file:///c:/Users/feshernandez/GC_OPS_OBS/AGENTS.md)
- **Suite de Rendimiento y Estrés:** [`tests_perf/README.md`](file:///c:/Users/feshernandez/GC_OPS_OBS/tests_perf/README.md)
- **Agentes Satélite Privados:** [`sentinine/agent.py`](file:///c:/Users/feshernandez/GC_OPS_OBS/sentinine/agent.py) y [`sentinine/Dockerfile`](file:///c:/Users/feshernandez/GC_OPS_OBS/sentinine/Dockerfile)
- **Repositorio General:** [`README.md`](file:///c:/Users/feshernandez/GC_OPS_OBS/README.md)
