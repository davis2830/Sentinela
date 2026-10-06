# Roadmap verificable

Actualizado el 2026-10-03.

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

## Pendiente antes de go-live

- Aplicar migraciones y cuarentena en una ventana respaldada.
- Ejecutar Playwright y auditorías en CI.
- Verificar builds productivos y `nginx -t` en CI.
- Probar TLS externo y health interno.
- Verificar ingestión Loki y persistencia de posiciones Alloy.
- Repetir k6 y designar un benchmark oficial reproducible.

## Futuro

- Migrar React Router a v7 y cerrar los 2 avisos Moderate que requieren cambio mayor.
- Evaluar TimescaleDB solo si la escala y medición justificican la migración.
- Runbooks operativos y aprobaciones de cuatro ojos.
- Dependencias y blast radius.
- Automatización/AIOps con controles de aprobación.
