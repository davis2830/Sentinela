# Database

## Principios

Toda entidad pertenece a una organización.

Toda entidad utiliza UUID.

Toda tabla incluye:

- created_at
- updated_at

Evitar duplicación de datos.

Normalizar cuando aporte valor.

Indexar consultas frecuentes.

Nunca almacenar métricas históricas en PostgreSQL.

# Database Schema

## Objetivo

Este documento define las entidades principales del dominio de Sentinel.

No representa el esquema SQL definitivo, sino el modelo de negocio sobre el cual se construirá la base de datos.

Toda entidad deberá diseñarse pensando en escalabilidad, multi-tenancy y mantenibilidad.

---

# Principios

- PostgreSQL será la base de datos principal.
- Todas las entidades utilizarán UUID.
- Toda entidad pertenece a una Organization.
- Todas las tablas incluirán auditoría básica.
- Evitar duplicación de información.
- Mantener integridad referencial.
- Diseñar pensando en futuras funcionalidades.

---

# Auditoría

Todas las entidades deberán incluir:

- id (UUID)
- created_at
- updated_at
- created_by (cuando aplique)
- updated_by (cuando aplique)

---

# Organization

Representa un cliente de Sentinel.

Campos principales

- id
- name
- slug
- status
- plan_id
- timezone
- locale

Relaciones

- Users
- Monitoring Targets
- Alerts
- Incidents
- Billing

---

# User

Representa un usuario perteneciente a una organización.

Campos

- id
- organization_id
- first_name
- last_name
- email
- password
- is_active
- last_login

Relaciones

- Roles
- Notifications
- Audit Logs

---

# Role

Define permisos dentro de la organización.

Ejemplos

- Administrator
- Operator
- Auditor
- Viewer

---

# Permission

Permisos individuales del sistema.

Ejemplos

- monitoring.create
- monitoring.update
- monitoring.delete

- alerts.manage

- users.manage

---

# Monitoring Target

Representa un recurso monitoreado.

Puede ser:

- Dominio
- IP
- API
- Servicio
- Puerto

Campos

- id
- organization_id
- name
- type
- endpoint
- interval
- enabled

---

# Monitoring Check

Representa una ejecución del monitoreo.

Campos

- monitoring_target_id
- status
- latency
- checked_at
- details

No almacenar millones de registros en PostgreSQL.

Definir políticas de retención.

---

# SSL Certificate

Información del certificado.

Campos

- issuer
- subject
- expiration_date
- algorithm
- fingerprint

---

# DNS Record

Representa un registro DNS monitoreado.

Campos

- type
- value
- ttl
- last_change

---

# Alert Rule

Regla que determina cuándo generar una alerta.

Ejemplos

- SSL < 15 días

- HTTP > 2 segundos

- DNS cambia

---

# Alert

Evento generado por una regla.

Campos

- severity
- title
- message
- status
- created_at

---

# Notification

Entrega de una alerta.

Canales

- Email
- Slack
- Teams
- Webhook

Registrar:

- estado
- fecha
- respuesta

---

# Incident

Agrupa múltiples alertas relacionadas.

Campos

- title
- status
- priority
- opened_at
- closed_at

---

# Report

Representa un reporte generado.

Tipos

- SLA
- Disponibilidad
- SSL
- Incidentes

---

# Audit Log

Registro de auditoría.

Debe almacenar:

- usuario
- acción
- fecha
- IP
- módulo
- resultado

Nunca eliminar registros.

---

# Subscription

Plan contratado.

Campos

- plan
- status
- renewal_date
- limits

---

# Relaciones

Organization

↓

Users

↓

Monitoring Targets

↓

Monitoring Checks

↓

Alert Rules

↓

Alerts

↓

Notifications

↓

Incidents

---

# Multi-Tenancy

Todas las consultas deberán filtrar por Organization.

Nunca exponer información entre organizaciones.

La separación lógica es obligatoria.

---

# Escalabilidad

Las tablas de alto crecimiento deberán implementar:

- índices
- particionamiento (cuando sea necesario)
- políticas de retención

---

# Regla Final

El modelo de datos debe representar el negocio y no la implementación técnica.

Las relaciones deben ser claras, simples y fáciles de extender.