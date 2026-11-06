# Readiness de producción

Para decidir un despliegue, usa el [checklist de go-live](GO_LIVE_CHECKLIST.md) y
evidencia del mismo SHA en CI y en el entorno objetivo. Los resultados fechados
de esta página son evidencia de cada revisión, incluida la secuencia de diagnóstico
y corrección del 2026-11-04.

Corrección UX posterior del **2026-11-04**: **301/301 Django, 210/210 Chromium** y
TypeScript/build aprobados localmente. Incluye recuperación de acceso, accesibilidad
y corrección de los doce hallazgos UX. [Evidencia y límites](UX_REMEDIATION_2026-11-04.md).
No cambia los pendientes externos ni autoriza producción.

Corrección de hardening anterior del **2026-11-04**: **291/291 Django, 58/58 Senti9 Linux,
204/204 Chromium**, build, npm/pip y tres imágenes sin High/Critical. Smoke sobre
Compose productivo aislado con Redis autenticado y restauración de backup ficticio
aprobados. [Matriz por módulo, cambios y límites](AUDIT_HARDENING_2026-11-04.md).
Cambios sin publicar: CI remoto, credenciales/integraciones reales, historial de
secretos y aprobación de preproducción siguen pendientes. No se autoriza producción.

La revisión inicial de ese día, conservada a continuación, precede a las correcciones:

Estado revisado el **2026-11-04**, SHA `33942ba`: build frontend y pruebas rápidas
locales aprobados, pero CI falla en Senti9, npm y Trivy; Chromium remoto omitido.
Se identificaron además incompatibilidades estáticas de la fixture E2E y del probe
interno productivo, y falta de dependencia entre CD y CI satisfactorio.
[Evidencia nueva y orden de corrección](PROJECT_REVALIDATION_2026-11-04.md).
Docker local no disponible; no se repitieron Django ni Chromium completos.

Corrección posterior del **2026-10-21** sobre `c856e4a`: aislamiento del mantenimiento legacy y ejecutor HTTP/TCP corregidos; **244/244 Django**, **178/178 Chromium**, migraciones y build aprobados localmente. npm de producción y pip-audit del runtime sin hallazgos; Trivy frontend sin High/Critical. Continúan pendientes seguridad de imagen backend, herramientas de desarrollo, CI y configuración de integraciones reales. Véase [evidencia y prioridades actuales](AUDIT_REMEDIATION_2026-10-21.md) y la [revalidación inicial](PROJECT_REVALIDATION_2026-10-21.md). No se aprueba beta ni producción.

La tabla siguiente conserva la evidencia histórica del 2026-10-07; no representa una nueva aprobación de sus gates.

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
