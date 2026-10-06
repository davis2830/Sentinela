# Readiness de producción

Estado al 2026-10-03: implementación completada en la rama; aprobación de go-live pendiente de ejecutar los gates en el entorno objetivo. No se declara 100% production-ready.

| Gate | Evidencia requerida | Estado |
| --- | --- | --- |
| Migraciones | respaldo, `migrate --check`, revocación comunicada | Pendiente en preproducción |
| Backend | suite Django completa | 65/65 pruebas locales; repetir en CI |
| Frontend | TypeScript y bundle | build local aprobado; repetir en CI |
| Playwright | Chromium: dashboards por área, doce módulos compactos, filtros, GET-only refresh, acciones admin, Viewer, fallo parcial, escritorio/móvil, alta de target, onboarding, sesión y disponibilidad de sondeo | 56/56 local; pendiente de CI |
| Contenedores | Compose prod, builds y `nginx -t` | Aprobado localmente; repetir en CI |
| Seguridad | auditorías npm/pip y Trivy High/Critical | `pip-audit` sin hallazgos y gate npm High aprobado localmente; quedan 2 avisos Moderate de React Router para una migración mayor; Trivy y repetición en CI pendientes |
| SSRF | redirects y destinos restringidos rechazados | Pruebas unitarias aprobadas |
| Proxy | XFF solo desde gateway fijo | Pruebas unitarias aprobadas |
| Celery | Beat sin tareas no registradas | Prueba de registro aprobada |
| Datos | cuarentena revisada y aplicada con operador | Dry-run: 8 hallazgos; aplicación pendiente |
| Logs | Alloy entrega a Loki y conserva posiciones | Smoke local aprobado; repetir en preproducción |
| HTTPS | redirect, TLS externo y health interno | Pendiente en entorno productivo |

TimescaleDB queda como evaluación futura. Promtail fue sustituido por Grafana Alloy.
