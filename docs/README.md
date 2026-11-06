# Centro de documentación de Sentinel

Empieza por [AGENTS.md](../AGENTS.md) para conocer las reglas de trabajo y el mapa del código. Usa las guías vigentes según la tarea. Las auditorías fechadas describen el estado de su revisión y deben leerse junto con sus correcciones posteriores.

## Cómo funciona Sentinel

- **Portal web.** React, TypeScript y Vite. Las rutas en [App.tsx](../frontend/src/App.tsx) conectan pantallas y componentes con el API Django. La consola SaaS tiene sesión administrativa propia. Los dashboards presentan resultados guardados y la recarga consulta esos datos.
- **API y datos.** Django REST Framework expone `/api/v1/`. PostgreSQL 16 almacena configuración, históricos y auditoría. La organización delimita el acceso a recursos y el plan controla cuotas y frecuencia.
- **Sondeos.** Celery Beat programa trabajos y Redis los entrega a los workers. Los sondeos individuales aceptados devuelven 202. Sentinine ejecuta las comprobaciones asignadas en redes privadas.
- **Producción.** Nginx termina TLS y enruta frontend y API. El listener de administración se publica en loopback. Alloy recolecta logs de contenedores y los entrega a Loki. Las topologías se definen en [Compose local](../docker-compose.yml) y [Compose productivo](../docker-compose.prod.yml).

## Guías vigentes

| Para trabajar en | Leer |
| --- | --- |
| Instalar, configurar o probar en local | [Flujo de desarrollo](DEV_WORKFLOW.md) · [Laboratorio Sentinel y Senti9](SENTI9_PERSONAL_LAB.md) |
| Backend, datos y contratos | [Referencia técnica, OpenAPI y PostgreSQL](TECHNICAL_REFERENCE.md) · [Inventario por módulo](MODULE_INVENTORY.md) · [Planes y onboarding](SUBSCRIPTIONS_ONBOARDING.md) · [Beta y verificación de correo](BETA_EMAIL_VERIFICATION.md) |
| Frontend, componentes y gráficas | [Estándar UI/UX](UI_STANDARD.md) · [Dashboards](DASHBOARD.md) · [Ficha de endpoints](ENDPOINT_DOSSIER.md) |
| Administración SaaS | [Acceso y operación de la consola](PLATFORM_ACCESS.md) |
| Agente privado | [Sentinine / Senti9](../sentinine/README.md) · [Operaciones de distribución](../sentinine/release/OPERATIONS.md) |
| Validación y rendimiento | [Estrategia y evidencia de pruebas](TESTING_STRATEGY.md) · [Benchmarks k6](../tests_perf/README.md) |
| Seguridad y despliegue | [Controles productivos](PRODUCTION_SECURITY.md) · [Readiness y evidencias](PRODUCTION_READINESS.md) · [Checklist de go-live](GO_LIVE_CHECKLIST.md) |
| Prioridades y cambios | [Roadmap](ROADMAP_TRACKER.md) · [Bitácora](IMPLEMENTATION_LOG.md) |

La configuración del entorno objetivo y los resultados de CI deben verificarse para la revisión que se va a desplegar. Los informes locales documentan ejecuciones concretas.

## Evidencia histórica

Los documentos siguientes conservan hallazgos, decisiones y resultados fechados. Para el comportamiento vigente, usa la guía del área y verifica el código.

- [Auditoría por módulos y corrección operativa — 2026-11-04](AUDIT_HARDENING_2026-11-04.md)
- [Revalidación y prioridades — 2026-11-04](PROJECT_REVALIDATION_2026-11-04.md)
- [Auditoría UX local — 2026-11-04](UX_AUDIT_2026-11-04.md)
- [Plan y ejecución de correcciones UX — 2026-11-04](UX_REMEDIATION_2026-11-04.md)
- [Disponibilidad — UI del 22 de octubre de 2026](AVAILABILITY_UI_2026-10-22.md)
- [Dashboard: alcances y jerarquía — 2026-10-22](DASHBOARD_SCOPES_UI_2026-10-22.md)
- [Panel rápido de endpoint — 2026-10-22](ENDPOINT_QUICK_PANEL_2026-10-22.md)
- [Pestañas de la ficha — UI del 2026-10-22](ENDPOINT_TABS_UI_2026-10-22.md)
- [Aplicación de criterios unificados — 2026-10-22](MEASUREMENT_CRITERIA_IMPLEMENTATION_2026-10-22.md)
- [Revisión de criterios de medición — 2026-10-22](MEASUREMENT_CRITERIA_REVIEW_2026-10-22.md)
- [Paleta de mediciones — 2026-10-22](MEASUREMENT_PALETTE_2026-10-22.md)
- [Límites y diagnóstico breve de monitoreo — 2026-10-22](MONITORING_DIAGNOSTICS_2026-10-22.md)
- [Senti9 1.4.0: entrega persistente y heartbeat independiente](SENTI9_DELIVERY_2026-10-22.md)
- [Senti9 1.6.0: DNS acotado e IPv6](SENTI9_DNS_IPV6_2026-10-22.md)
- [Senti9: visibilidad operativa — 2026-10-22](SENTI9_OPERATIONS_2026-10-22.md)
- [Senti9 1.7.0 — preparación de distribución](SENTI9_RELEASE_2026-10-22.md)
- [Senti9 1.5.0: conexión, secretos y ejecución sin privilegios](SENTI9_SECURITY_2026-10-22.md)
- [Senti9 1.7.0 — telemetría interna](SENTI9_TELEMETRY_2026-10-22.md)
- [Sentinine: revisión de preparación para producción](SENTININE_PRODUCTION_REVIEW_2026-10-22.md)
- [Corrección de hallazgos — 2026-10-21](AUDIT_REMEDIATION_2026-10-21.md)
- [Revalidación de Sentinel — 2026-10-21](PROJECT_REVALIDATION_2026-10-21.md)
- [Aplicación del estándar UI — 2026-10-21](UI_STANDARD_IMPLEMENTATION_2026-10-21.md)
- [Corrección de la auditoría de Sentinel — 2026-10-13](AUDIT_REMEDIATION_2026-10-13.md)
- [Auditoría integral de Sentinel — 2026-10-12](SYSTEM_AUDIT_2026-10-12.md)
- [Auditoría integral de módulos — 2026-10-07](BETA_MODULE_AUDIT.md)
- [Cierre local de pendientes beta — 2026-10-07](BETA_VALIDATION_FOLLOWUP.md)
