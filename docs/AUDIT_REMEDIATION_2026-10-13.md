# Corrección de la auditoría de Sentinel — 2026-10-13

## Alcance y límites

Implementación local del plan de 19 hallazgos sobre `main`, HEAD `8b118fb85dd75140a0b0ee9942137a605a386dde`, con cambios sin commit. La [auditoría original](SYSTEM_AUDIT_2026-10-12.md) conserva sus reproducciones y resultados históricos: no se sustituyen por esta reevaluación.

Se mantienen Free por defecto, verificación explícita, beta y onboarding; mínimos Free 300 s / Pro 60 s e intervalos más lentos; suscripciones vencidas bloqueadas; GET sin sondeos ni reinicio del reloj; diagnósticos opcionales independientes; ScanLease/202/429; permisos existentes, aislamiento, tokens con hash, SSRF sin redirecciones, Sentinine para destinos privados y WHOIS explícito. Sin migraciones, cambios de precios comerciales, dependencias nuevas, limpieza de datos reales, commit, push ni despliegue.

**La corrección local no autoriza abrir la beta ni producción:** siguen pendientes los gates externos de secretos y retención, además de CI remoto y despliegue.

## Trazabilidad por hallazgo

Los estados siguientes se limitan a los caminos probados, no constituyen una garantía general de ausencia de bugs.

| ID | Corrección y ubicación | Regresión/evidencia | Estado |
| --- | --- | --- | --- |
| SENT-AUD-001 | Plantillas `.env.example` y `.env.production.example` con placeholders. Guard de archivos versionables en `frontend/scripts/check-secrets.mjs` y CI, sin imprimir valores. El `.env` operativo no se modificó. | `check:secrets`, self-test positivo/negativo. | Mitigado localmente; rotación SMTP y revisión histórica/remota pendientes. |
| SENT-AUD-002 | Auditoría tenant filtrada por organización exacta; entradas globales conservadas y listadas exclusivamente por administración de plataforma. `audit/services.py`, `audit/views.py`, `organizations/urls_admin.py`. | Probes 006/022; prueba de acceso global solo para superuser. | Corregido localmente. |
| SENT-AUD-003 | Autorización administrativa antes de payload en miembros masivos, CRUD de equipos, seed y membresías. Controles de mutación ocultos en Usuarios/Equipos; lectura y exportación permanecen. | Probes 001–005/013; Viewer UI; baseline de permisos y token read. | Corregido localmente. |
| SENT-AUD-004 | Conteo de APICheckTarget y StatusPageConfig reales; errores de infraestructura no equivalen a cero. `organizations/services.py`. | Probes 015–018/024; fallo de conteo rechaza alta. | Corregido localmente. |
| SENT-AUD-005 | Cupo común beta/no beta cuenta cuentas inactivas y reservas de invitaciones válidas; aceptación reemplaza su propia reserva. `common/membership.py`, servicios y vistas de usuarios/organización. | Probes 009/010; aceptación, reutilización, expiración, último cupo concurrente. | Corregido localmente. |
| SENT-AUD-006 | Configuraciones nuevas limitadas al catálogo (beta Free 3 / Free 7 / Pro 30); nuevas organizaciones alineadas. Dry-run muestra impacto contractual por tenant/tipo. Flag de aplicación histórica desactivado. | Probe 028; pruebas de serializer/servicio, valores plan, dry-run y aplicación bajo overrides en BD desechable. | Configuración y mecanismo corregidos; aplicación a datos históricos pendiente. |
| SENT-AUD-007 | Validación completa del lote antes de consumir leases: lista, UUID, estado, latencia finita/no negativa, código y tamaño. El 0 existente del agente se conserva para TCP/DNS/sin respuesta HTTP. `monitoring/agent_payload.py`, `monitoring/services.py`. | Probes 020/021; lote válido + entrada inválida conserva mediciones y reserva; infinitos, negativos, códigos inválidos y sentinel 0. | Corregido localmente. |
| SENT-AUD-008 | Alta y reenvío usan PUBLIC_APP_URL y fragmento, sin doble slash. Configuración inválida devuelve error claro y revierte alta/extensión. Frontend valida mediante POST y conserva compatibilidad con query antigua. | Probe 011; reenvío y URL inválida; E2E fragmento sin bearer ni activación implícita. | Corregido localmente; SMTP externo no revalidado. |
| SENT-AUD-009 | Readiness requiere BD/caché/broker/worker; 503 degradado ante fallo. Probes compartidos concurrentes, espera máxima 3,5 s, worker cacheado 5 s, sin excepciones sensibles ni throttling previo dependiente de caché. | Probe 012; fallos por componente, timeout <5 s, concurrencia, worker cacheado, independencia del throttling. Probe local con servicios disponibles. | Corregido localmente. |
| SENT-AUD-010 | Operaciones masivas reutilizan transiciones individuales y publicación pública; errores de sincronización no se silencian. `maintenance/services.py`. | Probe 023; timeline/publicación y baseline de mantenimiento. | Corregido localmente. |
| SENT-AUD-011 | Limit entero 1–500/default 100; UUID y formatos de filtros validados; inválidos 400. `audit/views.py`. | Probes 007/008; limit 501 y filtros malformados. | Corregido localmente. |
| SENT-AUD-012 | Sin fallback de 100%, métricas nullable y separación carga/error/sin mediciones/resultado. Recuperación GET explícita; no se cambia la meta SLA. | Probe 019; timeseries vacío nullable; UI histórico fallido sin 100%. | Corregido localmente. |
| SENT-AUD-013 | Timeseries e historial de Monitoring usan reloj de Conectividad, con keys tenant y sin timers de 15/30 s. `TargetDetailDrawer.tsx`, `ChecksList.tsx`. | UI Free sin lectura anticipada; baseline de planes/navegación/pausa/visibilidad/GET. | Corregido localmente. |
| SENT-AUD-014 | Target pertenece al tenant y condición coincide con tipo; PATCH valida estado resultante completo; target null permitido. `alerts/services.py`. | Probe 027; PATCH incompatible y regla global. | Corregido localmente. |
| SENT-AUD-015 | Estimaciones desde catálogo efectivo, incluida cotización sin precio inventado; metadatos de estimación y organizaciones cotizadas. `organizations/views_admin.py`. | Probe 026; Enterprise coincide con catálogo; UI explícitamente MRR estimado. | Corregido localmente. |
| SENT-AUD-016 | Etiqueta uniforme “Informe imprimible (HTML)”; ruta legacy, extensión y MIME reales conservados. | Revisión de componentes de reportes y build; no se afirma PDF binario. | Corregido localmente. |
| SENT-AUD-017 | Página 404 con recuperación accesible; detalle distingue recurso no encontrado de consulta fallida. | UI ruta inexistente y teclado/móvil; navegación existente. | Corregido localmente. |
| SENT-AUD-018 | Admisión común en transacción con bloqueo de organización, incluyendo altas alternativas; existentes reutilizados no consumen otro cupo ni disparan escaneo inicial duplicado. No se retiran recursos sobre cuota. `common/beta_quota.py`. | Probe 031 concurrente no beta; último cupo, fallo de infraestructura y reutilización; baseline beta/aprovisionamiento/403 vs429. | Corregido localmente. |
| SENT-AUD-019 | E2E real crea target deshabilitado y sin cobertura; retira únicamente su fixture previo antes de repetir el alta. Credenciales de fixture reutilizadas por rol sin relajar límites. | Persistencia real E2E; comprobación de cero targets activos, cero checks y cero cobertura cloud. | Corregido localmente. |

## Retención: gate destructivo pendiente

`RETENTION_PLAN_CAP_ENFORCED=false` en settings, plantillas y Compose; runtime local comprobado en false.

- Con la flag desactivada, la purga real mantiene los días configurados previamente.
- `purge_telemetry --dry-run` evalúa el techo contractual y muestra configuración/impacto por organización y por tipo de histórico.
- No se cambian configuraciones existentes al cambiar de plan ni durante dry-run.
- No se purgan configuraciones de targets/SSL/dominos ni auditoría.
- Activar el techo histórico requiere revisar el dry-run y aprobar un respaldo. No se ejecutó una purga real durante esta entrega; los casos de aplicación usan únicamente la base de pruebas.

## Reproducción local

Las 31 reproducciones originales se integran por `common/tests_audit_regressions.py`; 32 regresiones contractuales adicionales están en `common/tests_hardening_contracts.py`. Las seis UI originales se incluyen en `frontend/e2e/hardening.spec.ts`, junto con dos pruebas nuevas de invitación/teclado.

```powershell
docker compose exec -T backend python manage.py test --noinput
cd frontend
npm run build
npm run check:secrets
$env:E2E_FIXTURE_SUFFIX='hardening-20261013-final'
npm run test:e2e
```

Para Chromium debe prepararse previamente ese fixture con `SENTINEL_E2E_FIXTURE=1` y `seed_e2e_accounts --suffix <sufijo>`; al finalizar se retira exclusivamente mediante el mismo sufijo y `--cleanup`, conservando auditoría. Nunca usar una cuenta real ni registro público como shortcut de JWT. Si se repiten suites simultáneamente, usar bases desechables distintas y no compartir fixtures/salidas de pruebas.

### Resultados finales

- Django completo: **234/234 aprobadas**, 64,750 s; base de pruebas creada y destruida, check Django sin incidencias.
- Chromium completo: **144/144 aprobadas**, última ejecución 6,7 min, un worker, sin retries locales ni casos omitidos. Incluye 1440×900, 390×844, navegación/teclado/foco, errores parciales y restricciones reales de Viewer.
- TypeScript `--noEmit` y Vite build: aprobados; último build 30,25 s.
- Guard de secretos y self-tests: aprobados, sin publicar valores. No es una auditoría histórica de Git.
- Compose local y productivo: configuración válida; producción evaluada con la plantilla saneada, sin montar certificados ni desplegar.
- Readiness local tras reiniciar únicamente Celery local: 200 en 1,04 s, BD/caché/broker/worker healthy. Un worker respondió al inventario y ninguna tarea periódica quedó sin registrar; no se ejecutaron sondeos para esta comprobación. Timeout controlado <5 s cubierto en suite.
- Flag histórica comprobada false; fixture con 0 targets activos, 0 checks y 0 recursos SSL/DNS/WHOIS/Security Headers antes de retirarlo.
- Versiones registradas: Python 3.13.16, Django 5.2.17, Node 24.19.0, TypeScript 5.9.3, Docker Compose 5.5.1, Vite 5.4.21.
- Revisadas capturas desktop/móvil de la suite. Cuenta expirada, errores y ausencia de medición se representan sin inventar salud.
- Fixtures de ambas iteraciones retirados: cero cuentas/organizaciones restantes; 31 registros de auditoría del fixture final conservados. Ninguna cuenta real fue modificada.

### Iteraciones y limitaciones

Se registraron fallos antes del cierre, sin expectedFailure, skips ni excepciones para aprobar: sincronización pública pendiente; un fixture de verificación sin cupo Free; BetaControl ausente tras flush en un fixture concurrente; un fixture de retención sin fecha requerida; error de edición de sintaxis corregido; alta E2E que encontraba su recurso anterior antes de terminar el POST; cuenta atrás comprobada contra tiempo real de navegación; navegación abortada durante ajustes en caliente y logins de fixture redundantes que agotaban presupuestos.

Se corrigieron causas/fixtures y se repitieron suites completas. La prueba temporal usa reloj virtual pausado, conserva la comparación del plazo y exige GET sin sondeos. No se relajaron cuotas, presupuesto de login, permisos ni tiempos de sondeo para lograr un resultado positivo.

No se revalidaron CI remoto, producción, pagos reales ni integraciones externas. Flake8 no está instalado en el contenedor (comprobación real fallida), no se presenta como aprobado. Auditorías de dependencias/capacidad no se repitieron.

## Pendientes externos que impiden cierre operativo

1. Rotar la credencial SMTP expuesta y actualizar el entorno privado, por el operador autorizado.
2. Revisar exposición histórica/remota; no se reescribió Git.
3. Revisar dry-run de retención, aprobar respaldo y decidir activación explícita del techo.
4. Ejecutar CI remoto y resolver sus gates.
5. Aprobar y ejecutar despliegue productivo en otra fase.

Las verificaciones locales no sustituyen esos gates.
