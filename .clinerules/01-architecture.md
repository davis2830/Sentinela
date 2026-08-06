# Architecture Rules

## Architecture Style

Sentinel seguirá una arquitectura modular (Modular Monolith) durante la Fase 1.

Cada módulo debe ser independiente y representar un dominio del negocio.

Ejemplos:

- Accounts
- Organizations
- Monitoring
- Alerts
- Notifications
- Billing
- Incidents

## Principles

- Alta cohesión.
- Bajo acoplamiento.
- API First.
- Multi Tenant.
- Cloud Native.

## Business Logic

La lógica del negocio nunca debe vivir en:

- Views
- Controllers
- Serializers

Debe implementarse en Services.

## Data Sources

Cada herramienta tiene una responsabilidad específica.

- PostgreSQL → Datos del negocio.
- Prometheus → Métricas.
- Loki → Logs.
- Redis → Cache y colas.

No mezclar responsabilidades.

## Frontend

React consume únicamente la API del backend.

Nunca acceder directamente a Prometheus, Loki o Grafana.

## Evolution

La arquitectura debe permitir incorporar sin reescrituras:

- Runbooks
- Automatización
- AWX
- IA
- ChatOps
- Compliance