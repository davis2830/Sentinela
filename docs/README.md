# Centro de documentación de Sentinel

Índice actualizado con la corrección local del 2026-10-13; la evidencia histórica se conserva por fecha.

- [Inventario de módulos, modelos, rutas y tareas](MODULE_INVENTORY.md)
- [Flujo de desarrollo](DEV_WORKFLOW.md)
- [Estrategia y evidencia de pruebas](TESTING_STRATEGY.md)
- [Auditoría integral de módulos y pendientes beta](BETA_MODULE_AUDIT.md)
- [Auditoría por módulo del 2026-10-12 y hallazgos priorizados](SYSTEM_AUDIT_2026-10-12.md)
- [Corrección de los 19 hallazgos, evidencia local y gates externos](AUDIT_REMEDIATION_2026-10-13.md)
- [Seguimiento de pendientes y baseline de capacidad](BETA_VALIDATION_FOLLOWUP.md)
- [Dashboards por área y módulos compactos](DASHBOARD.md)
- [Ficha integral de endpoints HTTP/HTTPS](ENDPOINT_DOSSIER.md)
- [Suscripciones, onboarding y cobertura por protocolo](SUBSCRIPTIONS_ONBOARDING.md)
- [Beta privada y verificación de correo](BETA_EMAIL_VERIFICATION.md)
- [Seguridad de producción](PRODUCTION_SECURITY.md)
- [Readiness de producción](PRODUCTION_READINESS.md)
- [Checklist de go-live](GO_LIVE_CHECKLIST.md)
- [Roadmap](ROADMAP_TRACKER.md)
- [Bitácora de implementación](IMPLEMENTATION_LOG.md)
- [Benchmarks k6](../tests_perf/README.md)

Arquitectura oficial: PostgreSQL 16, Redis 7, Celery, Nginx TLS, Grafana Alloy y Loki. TimescaleDB está en evaluación futura y Promtail no forma parte del despliegue.
