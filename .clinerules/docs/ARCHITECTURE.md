# Architecture

Sentinel utilizará una arquitectura modular.

## Objetivos

- Escalable
- Multi Tenant
- Cloud Native
- API First
- Fácil de mantener

---

## Arquitectura

Frontend

↓

REST API

↓

Services

↓

Repositories

↓

Database

---

## Responsabilidades

React

- Presentación

DRF

- API

Services

- Negocio

Repositories

- Acceso a datos

Infrastructure

- Docker
- Prometheus
- Loki
- Redis

---

## Modularidad

Cada dominio deberá ser independiente.

Ejemplos

- Accounts
- Organizations
- Monitoring
- Alerts
- Incidents
- Billing

No crear módulos gigantes.