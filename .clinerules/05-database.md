# Database Rules

## Engine

PostgreSQL.

## IDs

Utilizar UUID para entidades públicas.

## Multi Tenant

Toda entidad pertenece a una organización.

Nunca asumir un único cliente.

## Timestamps

Todas las tablas deben incluir:

- created_at
- updated_at

## Relationships

Utilizar Foreign Keys.

Evitar duplicación de datos.

## Metrics

No almacenar métricas históricas en PostgreSQL.

Las métricas viven en Prometheus.

Los logs viven en Loki.