# Revalidación y prioridades — 2026-11-04

Este informe conserva los hallazgos iniciales. Después se implementaron correcciones
y se repitieron gates locales; consultar la [auditoría y cierre posterior](AUDIT_HARDENING_2026-11-04.md).

## Alcance

Revisión solicitada de pendientes y mejoras, sin correcciones funcionales, actualizaciones
de dependencias, migraciones, cambios de datos, commit, push ni despliegue.
Revisión local y remota: `33942bacda6bbb97bba3eb64b5d7247975e4313e`.
Al comenzar, el árbol Git estaba limpio y `main` coincidía con GitHub.
La limpieza y las plantillas de entorno ya están publicadas; la indicación previa
de que seguían únicamente locales dejó de estar vigente.

No constituye una nueva auditoría funcional completa de todos los módulos.
Docker Desktop no tiene daemon disponible; no se iniciaron servicios para esta revisión.

## Evidencia nueva

| Comprobación | Resultado |
| --- | --- |
| TypeScript y build frontend | Aprobados, Vite 7.3.7 |
| Guard de repositorio y plantillas | 7/7 pruebas y guard aprobados |
| Serialización de endpoints | 3/3 pruebas aprobadas |
| npm producción | 1 High: `follow-redirects` 1.16.1 |
| npm completo | 1 High y 1 Moderate; correcciones disponibles para ambas |
| Senti9 en Windows/Python 3.13 | 52 pruebas ejecutadas; 3 errores y 1 omisión POSIX existente; suite no aprobada |
| Django completo, Playwright completo, Trivy local y runtime | No ejecutados: entorno Docker no disponible |
| CI remoto de esta revisión | Fallido; Playwright omitido por dependencias de jobs fallidas |
| CD remoto de esta revisión | Publicación de imágenes aprobada; despliegue detenido por secretos faltantes |

[CI consultado](https://github.com/davis2830/Sentinela/actions/runs/41391293401).
[CD consultado](https://github.com/davis2830/Sentinela/actions/runs/41391293292).
Estas ejecuciones son evidencia del SHA indicado, no de cambios posteriores.

## Hallazgos y acciones propuestas

### REV-NOV-001 — P1: dependencia de producción vulnerable

- Confirmado mediante `npm audit --omit=dev --json`: `follow-redirects` 1.16.1,
  dependencia transitiva, High; aviso
  [GHSA-mrwp-f3q8-3g9p](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p).
- El audit completo identifica además `postcss-selector-parser` 6.1.4, Moderate,
  [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf).
- Hay correcciones disponibles dentro de las restricciones actuales. No deducir
  una vulnerabilidad explotable en el navegador únicamente por estar en el árbol npm.
- Propuesta: actualización dirigida del lockfile, instalación limpia, auditorías,
  build y regresiones de HTTP/UI. No requiere asumir una migración a Tailwind 4.

### REV-NOV-002 — P1: backend CI bloqueado en Senti9

- CI falla en `Run Senti9 Agent Tests`; las pruebas Django posteriores no llegan
  a ejecutarse. La causa exacta en Linux requiere revisar el traceback remoto o
  reproducir el target Linux; no se atribuye a los errores locales de Windows.
- Reproducción local: `py -3.13 -m unittest discover -s sentinine -p 'test_*.py' -v`.
  Errores: SQLite retenido al limpiar un directorio temporal, eliminación de un
  archivo de token sin permiso Windows y falta de OpenSSL CLI para fixtures TLS.
  Hay una omisión POSIX existente; no se añadió ninguna omisión ni excepción.
- Propuesta: reproducir en el target Docker de pruebas, corregir la causa Linux
  y cerrar explícitamente conexiones SQLite. Si Windows se declara soportado para
  ejecutar la suite, adaptar limpieza/permisos y documentar OpenSSL.

### REV-NOV-003 — P1: fixture E2E incompatible con readiness

- Confirmación estática: `.github/workflows/ci.yml` inicia únicamente `db redis
  backend frontend`; `backend/common/views_health.py` exige worker Celery para 200.
  El paso `Wait for services` usa `curl --fail` contra ese readiness.
- Aunque se corrijan los jobs previos, la fixture no inicia el componente requerido.
- Propuesta: arrancar un worker aislado y controlado para E2E, sin Beat ni tareas
  contra cuentas reales; conservar readiness estricto y preparar la BD antes de
  habilitar ejecución. Probar que el pipeline alcanza Chromium sin falsos 200.

### REV-NOV-004 — P1: probe interno de producción incompatible con redirect TLS

- Confirmación estática: `config/settings/prod.py` fuerza `SECURE_SSL_REDIRECT=True`;
  el healthcheck Compose y el probe de CD consultan HTTP directo a 127.0.0.1 sin
  contexto HTTPS. No hay `SECURE_REDIRECT_EXEMPT` para health en settings.
- Riesgo: redirección hacia HTTPS del puerto interno, donde sirve Gunicorn HTTP,
  y backend marcado unhealthy aunque el proceso funcione. No reproducido en runtime.
- Propuesta: definir un probe interno compatible con la topología TLS sin debilitar
  la confianza del proxy ni el readiness. Mantener por separado el probe HTTPS externo;
  verificar ambos con configuración productiva y certificado efímero.

### REV-NOV-005 — P1: CD no espera los gates CI

- `.github/workflows/cd.yml` se activa por push a main y depende solo de
  `build-and-publish`; no exige el resultado del workflow CI del mismo SHA.
  El CD observado publicó imágenes y alcanzó validación de secretos con CI fallido.
- No hubo despliegue exitoso observado: lo detuvo la ausencia de secretos SSH.
- Propuesta: exigir CI satisfactorio del SHA exacto y aprobación del entorno antes
  de desplegar. Mientras producción siga pendiente, conservar publicación y hacer
  el despliegue explícito/manual. No configurar secretos de producción para resolver
  este fallo antes de introducir los gates.

### REV-NOV-006 — P1: análisis de contenedores sin aprobar

- CI falla tanto en Trivy config como en el análisis de imagen backend. El análisis
  frontend y `nginx -t` posteriores no acreditan ejecución en ese job.
- Los conteos de vulnerabilidades del 2026-10-21 son históricos; no se presentan
  como inventario actual. No se repitió Trivy local porque Docker no está disponible.
- Propuesta: separar findings de Dockerfile y de paquetes, reconstruir y escanear
  backend, frontend y gateway; conservar umbral High/Critical sin silenciarlo.
  `backend/Dockerfile` no declara usuario no-root: revisar permisos y ejecución
  sin privilegios como parte del hardening, no atribuirle todos los fallos Trivy.

### REV-NOV-007 — P2: documentación de estado desactualizada

- `ROADMAP_TRACKER.md` aún propone migrar React Router a v7, pero el manifiesto ya
  utiliza v7.18.4. Readiness conserva evidencia histórica de auditorías y cantidades
  que no reemplaza el resultado nuevo. La bitácora sí etiqueta las evidencias por fecha.
- Propuesta: actualizar el roadmap y un resumen vigente con enlaces a cada ejecución;
  conservar los informes históricos. Evitar tratar auditorías sin hallazgos en octubre
  como garantía sobre avisos publicados después.

## Orden recomendado

1. Actualizar las dos dependencias señaladas y reproducir/corregir Senti9 en Linux.
2. Corregir fixture E2E y probes internos; introducir gates CI y aprobación en CD.
3. Cerrar Trivy y repetir Django, Chromium y builds productivos sobre el mismo SHA.
4. Revalidar reglas de negocio con fixtures Free/Pro/vencida, admin/Viewer y dos
   organizaciones: GET sin sondeo, previews independientes, 202/429, cuotas,
   aislamiento y cobertura por protocolo. No rediseñar esos contratos.
5. Ejecutar una simulación operativa controlada de caída, alerta, incidente,
   notificación y recuperación; verificar cola y entrega de Sentinine tras reinicio.
6. Como mejoras siguientes: simplificar instalación local con comprobación de
   prerrequisitos/configuración; probar restauración de backup y dimensionar Free
   con carga reproducible antes de aumentar recursos o retención.

## Pendientes externos y operativos

- El repositorio continúa público. La limpieza de archivos no elimina el backup
  ni el JWT que pudieron publicarse en el historial. La revisión histórica y la
  rotación SMTP siguen sin evidencia nueva; no se leyeron ni imprimieron secretos.
- Configuración real SMTP/Turnstile/dominio y entrega de correo: no verificadas
  en esta revisión; no se leyó `.env` ni se enviaron mensajes.
- Activación del techo de retención: requiere dry-run vigente y respaldo aprobado;
  no habilitar automáticamente ni reutilizar conteos históricos para aprobar la purga.
- Pagos, integraciones pendientes y producción conservan su alcance externo.
