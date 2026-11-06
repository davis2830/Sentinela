# Roadmap verificable

Actualizado el 2026-11-04. Evidencia y límites en la
[auditoría vigente](AUDIT_HARDENING_2026-11-04.md); los informes anteriores se conservan.

## Completado en código

- Corrección de tareas periódicas SSL, DNS y WHOIS.
- Confianza explícita del proxy y XFF sobrescrito en Nginx.
- Cliente HTTP saliente seguro, sin redirects ni atajos localhost.
- Cuarentena dry-run/apply auditable.
- Revocación transaccional de otras sesiones.
- API tokens con hash y revelado único.
- Contrato 202 para scans y polling de UI.
- Retención PostgreSQL tenant-aware.
- Topología productiva TLS con imágenes GHCR.
- Configuración Grafana Alloy → Loki.
- CI endurecido y suite Playwright configurada.
- Dashboard NOC Fase 1 con filtros interactivos, bandeja normalizada, drawer y actividad auditada.
- React Router 7; dependencias frontend actualizadas y auditoría npm completa sin hallazgos en esta revisión.
- Backend Alpine y gateway propio parcheado; usuarios sin privilegios y smoke TLS/recuperación reproducible.
- Despliegue manual con CI obligatorio del mismo SHA y rollback con backup custom.
- Entornos de auditoría separados, regresiones por módulo y escenario de lectura k6 sin secretos en resultados.
- Inventario Python fijado por constraints y validación de dependencias durante el build.

## Pendiente antes de go-live

- Aplicar migraciones y cuarentena en una ventana respaldada.
- Ejecutar Playwright y auditorías en CI.
- Verificar builds productivos y `nginx -t` en CI.
- Probar TLS externo y health interno.
- Verificar ingestión Loki y persistencia de posiciones Alloy.
- Repetir k6 y designar un benchmark oficial reproducible.

## Futuro

- Completar hashes de distribución y fijación de imágenes base por digest con un proceso de renovación y auditoría.
- Evaluar TimescaleDB solo si la escala y medición justificican la migración.
- Runbooks operativos y aprobaciones de cuatro ojos.
- Dependencias y blast radius.
- Automatización/AIOps con controles de aprobación.
