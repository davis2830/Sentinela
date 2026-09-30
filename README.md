# 🛡️ Sentinel — Operational Observability & NOC Platform

[![Python](https://img.shields.io/badge/Python-3.13-blue.svg)](https://www.python.org/)
[![Django](https://img.shields.io/badge/Django-5.x-darkgreen.svg)](https://www.djangoproject.com/)
[![React](https://img.shields.io/badge/React-18_TypeScript-61dafb.svg)](https://react.dev/)
[![TimescaleDB](https://img.shields.io/badge/TimescaleDB-PostgreSQL_16-orange.svg)](https://www.timescale.com/)
[![Redis](https://img.shields.io/badge/Redis-7_Alpine-red.svg)](https://redis.io/)
[![Celery](https://img.shields.io/badge/Celery-Distributed_Tasks-37814A.svg)](https://docs.celeryq.dev/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](https://www.docker.com/)

**Sentinel** es una plataforma SaaS de observabilidad, monitorización continua y automatización de operaciones (NOC / SRE) diseñada para vigilar infraestructura crítica, endpoints web y servicios privados con telemetría de ultra-baja latencia y diseño de alta densidad.

---

## 📌 Documentación Central y Estado del Proyecto

Para mantener el contexto técnico vivo y el seguimiento de lo que se implementa sesión a sesión:

- 🗺️ **[Roadmap y Tracker de Tareas (`docs/ROADMAP_TRACKER.md`)](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/ROADMAP_TRACKER.md):** Estado de avance de Fase 1 (100% completada), Fase 2 (En curso) y Fase 3.
- 📝 **[Bitácora Técnica / Changelog (`docs/IMPLEMENTATION_LOG.md`)](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/IMPLEMENTATION_LOG.md):** Registro cronológico de implementaciones, decisiones de arquitectura y archivos modificados.
- 📦 **[Inventario Técnico de Módulos (`docs/MODULE_INVENTORY.md`)](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/MODULE_INVENTORY.md):** Mapeo de vistas frontend, apps de backend, endpoints REST y tareas de Celery.
- 🛠️ **[Guía de Desarrollo y Convenciones (`docs/DEV_WORKFLOW.md`)](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/DEV_WORKFLOW.md):** Convenciones de entorno, sincronización con Docker y sistema de diseño NOC.
- 📂 **[Índice Completo de Documentación (`docs/README.md`)](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/README.md):** Acceso a todas las especificaciones y manuales.

---

## 🚀 Arquitectura y Capacidades Clave

### 1. Observabilidad Integral (Slice 4 Multi-Módulo)
- **Uptime & Latencia:** Sondeos HTTP/S, TCP, Ping, DNS con histórico y pruebas en vivo.
- **Agentes Satélite (Private Probes):** Monitoreo de LAN y VPCs privadas mediante agente autónomo de cero dependencias en Docker.
- **Certificados SSL:** Auditoría criptográfica (A+ a F), multi-puerto (:443, :8443, :636, :993) y reporte ISO 27001 CSV.
- **Registros DNS:** Soporte de 9 tipos de registros, latencia en ms, detección SPF/DMARC y diff visual de mutaciones.
- **Dominios & WHOIS:** Detección de candado anti-robo EPP (`clientTransferProhibited`) y semáforo de expiración.
- **API Checks Sintéticos:** Test interactivo tipo Postman con validación de Schemas JSON auto-inferidos y exportación cURL.
- **Cabeceras de Seguridad:** Análisis de HSTS/CSP, detección de fugas CWE-200 y generador de snippets de remediación (Nginx, Apache, Caddy, Cloudflare, IIS).

### 2. Gestión Operativa e Incidentes ITIL
- **Smart Alerts Engine:** 14 condiciones, deduplicación continua, anti-flapping ($\ge 3$ transiciones en 15m), Smart Snooze y simulador *dry-run*.
- **Hub de Incidentes:** Hitos ITIL/SRE (MTTA/MTTR), asignación de cuadrillas (`Team`), RCA post-mortem estructurado y bitácora en vivo.
- **Reportes & Error Budget:** Telemetría de SLA y burn rate de presupuesto de error SRE con exportación a PDF y CSV con UTF-8 BOM.
- **Status Pages:** Páginas públicas/privadas multi-empresa, suscriptores por email y barras históricas de 90 días.
- **Canales de Notificación:** Despacho hacia Slack, Teams, Telegram, Discord, Email y Webhooks con horarios de silencio (*Quiet Hours*).

### 3. Rendimiento de Grado Enterprise
- **Erradicación de N+1:** DRF `ListSerializer` por lotes y `select_related`/`prefetch_related` optimizados en TimescaleDB.
- **Caché en Redis (DB 2):** Respuestas de telemetría global en < 2 ms.
- **Benchmark k6:** Latencia promedio reducida a **22.36 ms** (p95 de **38.81 ms**) bajo 40 usuarios concurrentes sin errores.

---

## 💻 Inicio Rápido con Docker

```powershell
# 1. Clonar el repositorio
git clone <repo-url>
cd GC_OPS_OBS

# 2. Levantar la plataforma completa
docker compose up -d

# 3. Acceder a los servicios
# Frontend:  http://localhost:3000
# Backend:   http://localhost:8000/api/v1
# Mailpit:   http://localhost:8025
# Loki:      http://localhost:3100
```
