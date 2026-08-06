# Sentinel Master Rules

## Project

Sentinel es una plataforma SaaS de observabilidad y automatización de infraestructura.

La evolución del producto será:

Observability → Smart Alerts → Runbooks → Automation → Enterprise Operations

Toda decisión debe permitir esa evolución.

---

## Engineering Principles

- Diseñar pensando en las siguientes fases.
- Evitar deuda técnica.
- Favorecer componentes reutilizables.
- Mantener bajo acoplamiento.
- Alta cohesión entre módulos.
- Priorizar mantenibilidad sobre rapidez.

---

## Core Principles

- API First
- Multi Tenant
- Cloud Native
- Security First
- Docker First
- Modular Architecture

---

## Technology Decisions

Backend

- Django
- Django REST Framework
- Celery
- Redis
- PostgreSQL

Frontend

- React
- TypeScript
- TailwindCSS

Monitoring

- Prometheus
- Blackbox Exporter
- Loki

Infrastructure

- Docker Compose

---

## What We Build

Sentinel no desarrolla motores de monitoreo.

Sentinel construye valor sobre herramientas Open Source.

Usaremos:

- Prometheus para métricas
- Blackbox Exporter para probes
- Loki para logs

El valor del producto está en:

- Dashboard
- Multi-tenancy
- Alertas inteligentes
- Incidentes
- Runbooks
- Automatización
- Auditoría
- Billing

---

## Development Rules

Siempre:

- Escribir código limpio.
- Crear módulos pequeños.
- Separar lógica de negocio.
- Documentar código complejo.
- Pensar en escalabilidad.

Nunca:

- Lógica de negocio en Views.
- Secrets en código.
- Código duplicado.
- Consultas SQL innecesarias.
- Hacks temporales.

---

## Future Vision

La arquitectura deberá soportar:

- Runbooks
- Automatización
- Integración con AWX
- Dependency Graph
- ChatOps
- IA
- Compliance

No implementar soluciones que impidan esa evolución.