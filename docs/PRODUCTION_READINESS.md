# Readiness de producción

Estado al 2026-10-07: auditoría local con correcciones y suites aprobadas; aún existen pendientes beta e integraciones por verificar. Go-live requiere gates del entorno objetivo. No se declara 100% production-ready. Véase [auditoría y pendientes](BETA_MODULE_AUDIT.md).

| Gate | Evidencia requerida | Estado |
| --- | --- | --- |
| Migraciones | respaldo, `migrate --check`, revocación comunicada | Pendiente en preproducción |
| Backend | suite Django completa | 155/155 pruebas locales; repetir en CI |
| Frontend | TypeScript y bundle | build local aprobado; repetir en CI |
| Playwright | Chromium: dashboards, módulos, filtros, GET-only refresh, roles, fallo parcial, escritorio/móvil, onboarding y sondeos | 91/91 local; pendiente de CI |
| Contenedores | Compose prod, builds y `nginx -t` | Aprobado localmente; repetir en CI |
| Seguridad | auditorías npm/pip y Trivy High/Critical | pip-audit del inventario instalado sin hallazgos el 2026-10-07; npm High aprobado con 2 avisos Moderate de React Router. Trivy fs frontend sin High/Critical; Trivy de imágenes/OS y CI pendientes |
| SSRF | redirects y destinos restringidos rechazados | Pruebas unitarias aprobadas |
| Proxy | XFF solo desde gateway fijo | Pruebas unitarias aprobadas |
| Celery | Beat sin tareas no registradas | Prueba de registro aprobada |
| Datos | cuarentena revisada y aplicada con operador | Dry-run: 8 hallazgos; aplicación pendiente |
| Logs | Alloy entrega a Loki y conserva posiciones | Smoke local aprobado; repetir en preproducción |
| HTTPS | redirect, TLS externo y health interno | Pendiente en entorno productivo |

TimescaleDB queda como evaluación futura. Promtail fue sustituido por Grafana Alloy.
