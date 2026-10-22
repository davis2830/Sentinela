# Revalidación de Sentinel — 2026-10-21

## Alcance

Revisión local de `main`, commit `c856e4a687fa90d9d53f3b7c94b566d944489df4`, con árbol limpio al inicio. Se revisaron los contratos de las correcciones recientes y rutas alternativas de Monitoring, cuotas, usuarios/invitaciones, auditoría, salud y ejecución de sondeos. Los hallazgos describen el estado vigente; no se atribuye su introducción al último commit.

La suite existente pasa, pero hay defectos adicionales reproducidos y auditorías de dependencias fallidas. No aprobar apertura de beta ni producción con esta evidencia.

## Resultados locales

| Comprobación | Resultado |
| --- | --- |
| Django completo, `python manage.py test --noinput` | 234/234, 95,624 s; base de pruebas creada y destruida |
| Reproducciones adicionales explícitas | 3/3 fallidas por contratos incumplidos; no se ocultan como expectedFailure |
| Modelos/migraciones, `makemigrations --check --dry-run` | Sin cambios detectados |
| Migraciones instaladas, `migrate --check` | Exit 0; ninguna pendiente en la BD local |
| TypeScript y build Vite | Aprobados, también tras `npm ci --ignore-scripts` con el lockfile |
| Flake8 crítico, `--select=E9,F63,F7,F82` | 0 incidencias |
| Guard de secretos versionables y self-test | Aprobados; no equivale a auditoría histórica ni rotación |
| Compose local y productivo | Configuración válida; producción con `.env.production.example`, sin despliegue |
| Readiness local | HTTP 200; BD, caché, broker y worker healthy |
| Registro Celery | Un worker responde; ninguna tarea periódica sin registrar |
| Retención | `RETENTION_PLAN_CAP_ENFORCED=False`; sin purga aplicada |
| npm, producción, umbral High | Fallido: 1 paquete High y 2 Moderate |
| pip-audit, inventario realmente instalado | Fallido: 9 avisos en 2 paquetes |
| Chromium local, suite completa | **140/144**, 13,8 min; cuatro timeouts, sin retries locales |
| Repetición de los cuatro casos fallidos | **3/4**, 1,1 min; reloj recuperado, smoke desktop continúa con timeout |
| CI remoto | Sin evidencia disponible en esta revisión; CLI `gh` ausente |

El runtime consultado usa Django 5.2.18; la documentación inicial menciona 5.2.17 y requirements permite ambos.

## Hallazgos

### REV-001 — P1 — Ventana de mantenimiento reasignable a otro tenant

- Ubicación: `backend/monitoring/views.py:511` y `backend/monitoring/serializers.py:228`.
- PATCH comprueba la organización del target original, pero `MaintenanceWindowSerializer.target` es escribible y su queryset no limita organización. Después del control inicial, `serializer.save()` acepta un target ajeno.
- Reproducción: administrador A modifica su ventana mediante `PATCH /api/v1/monitoring/maintenance-windows/<id>/` con `target=<uuid de B>`. Respuesta **200** y nueva FK persistida. El conocimiento de un UUID ajeno es requisito; no se demostró su obtención.
- Impacto: integridad entre organizaciones. La reproducción confirma que `AlertEvaluatorService._is_target_in_maintenance()` devuelve **True** para el target ajeno tras la reasignación, habilitando la supresión de sus alertas durante la ventana.
- Acción: hacer inmutable la relación en PATCH o validar la relación resultante contra el tenant antes de guardar; cubrir también los alias de rutas y el efecto de supresión.

### REV-002 — P1 — Sondeos cloud delegados sin conexión fijada a IP validada

- Ubicación: `backend/monitoring/tasks.py:76` y `backend/monitoring/tasks.py:129`.
- HTTP/TCP validan el nombre en Django y luego envían ese mismo hostname a Blackbox mediante `requests.get`. La IP validada no se conserva en el despacho. HTTP configurable evita `common.safe_http`, contradiciendo la regla del proyecto.
- Reproducción controlada: `_run_http_check()` despacha `target=https://probe.example.test/check` al exporter y realiza **0 llamadas** a `common.safe_http.request`. No se ejecutaron conexiones reales para este probe.
- Impacto: la validación previa no garantiza que la resolución posterior del exporter mantenga el destino público. Hay una brecha de DNS rebinding/SSRF; no se realizó una explotación contra Blackbox real. `follow_redirects: false` protege contra redirecciones, no fija la resolución DNS.
- Acción: pasar los sondeos HTTP por el cliente seguro con conexión fijada; para TCP conservar una IP validada hasta la conexión o introducir un aislamiento de red equivalente verificable. Conservar Host/SNI y verificación TLS.

### REV-003 — P1 — Bundle de confianza TLS desactualizado en backend

- El inventario instalado contiene `certifi==2026.7.22`; pip-audit devuelve `PYSEC-2026-4320` / `GHSA-6q48-6c7w-9gw2`.
- El aviso oficial del 20 de octubre afecta el bundle de confianza usado por clientes Python como requests. Su explotación requiere una posición en la ruta de red y una clave intermedia comprometida; no se afirma compromiso de Sentinel.
- Acción prioritaria: exigir `certifi>=2026.10.19`, reconstruir los runtimes que lo incluyen y repetir auditoría y pruebas. Actualizar solo el entorno temporal del auditor no corrige la aplicación.
- Además hay **8 avisos de Pillow 12.3.0**, con corrección reportada en 13.0.0: `CVE-2026-112895`, `112400`, `112397`, `112896`, `112897`, `112395`, `112404`, `112899`. El camino revisado utiliza Pillow para un QR y un logo local; no se identificó entrada remota que alcance esos parsers. Revisar compatibilidad y actualizar sin asumir explotación en ese flujo.
- Fuente: [aviso oficial de certifi](https://github.com/advisories/GHSA-6q48-6c7w-9gw2).

### REV-004 — P2 — Configuración HTTP guardada no aplicada por el sondeo cloud

- Ubicación: `backend/monitoring/tasks.py:87` y `docker/blackbox/blackbox.yml`.
- El método solo distingue POST frente a cualquier otro valor. Cabeceras, cuerpo y `expected_status` del target no se envían al exporter; sus módulos tienen método y códigos válidos fijos.
- Reproducción: target con PUT, estado esperado 204, header de prueba y cuerpo. Despacho real simulado: únicamente `target`, `module=http_2xx` y timeout; no contiene el header ni el cuerpo. La prueba del header falla.
- Impacto: los checks cloud pueden informar resultados que no corresponden a la petición configurada; diagnóstico y agente pueden divergir del sondeo periódico.
- Acción: unificar el contrato de ejecución HTTP y cubrir método, cuerpo, cabeceras, estado esperado y umbral de latencia con un servidor de pruebas aislado.

### REV-005 — P2 — El lockfile no supera el umbral npm exigido por CI

- `npm audit --omit=dev --audit-level=high` devuelve exit 1 tanto en el contenedor como después de restaurar el lockfile local.
- High: `follow-redirects==1.16.0`, corregido en 1.16.1, con dos avisos: [cabeceras en array](https://github.com/advisories/GHSA-q3jh-wrc6-jgq8) y [escape de sensitiveHeaders](https://github.com/advisories/GHSA-8r9p-f939-6h3c).
- La dependencia viene de Axios. Su adaptador Node se sustituye por un módulo nulo en el build de navegador; este resultado bloquea el control de dependencias, pero no prueba una fuga de credenciales desde la SPA.
- Dos entradas Moderate corresponden a React Router y su dependencia directa. La corrección ofrecida implica revisar la migración de versión; no ejecutar `audit fix --force` sin validar rutas y sesiones.
- Acción: actualizar el lockfile con la corrección compatible de follow-redirects, repetir `npm ci`, build, auditoría y flujos de navegación; evaluar React Router por separado.

### REV-006 — P2 — Gate local de Chromium incompleto

- La suite completa termina **140 aprobadas / 4 fallidas**. Tres casos de reloj persistente (`/monitoring`, `/ssl`, `/api-checks`) fallan en `page.goto` esperando `load`; no llegan a fallar las aserciones del reloj.
- Una repetición dirigida, sin cambiar tests ni timeouts, aprueba los tres casos del reloj. No sustituye el resultado fallido de la suite completa ni demuestra una causa funcional del reloj.
- El smoke desktop 1440×900 falla dos veces. Recorre 18 rutas bajo un presupuesto total de 30 s en `frontend/audit/system-audit.spec.ts:27`; la repetición agota el timeout en `page.evaluate`, no por un resultado `false` de overflow. El smoke móvil sí pasó en la suite completa.
- Impacto: falta una ejecución completa estable para cerrar la validación de interfaz. No se demuestra que una ruta concreta esté rota ni se afirma un fallo visual por ese timeout.
- Acción: medir duración por ruta y separar el smoke en casos aislados; hacer deterministas los recursos externos y el reloj del harness, conservando los asserts de permisos, navegación y overflow. Repetir después suite completa y CI.
- Se revisaron las capturas locales desktop y móvil del dashboard; no se observó desbordamiento en esas capturas de fixtures.
- Trazas iniciales conservadas en `frontend/test-results/`; repetición separada en `frontend/.tmp/revalidation-20261021-rerun/`. Estos artefactos locales no se versionan.

## Reproducciones y límites

Las tres pruebas nuevas están en `backend/common/audit_revalidation_20261021.py`, fuera del patrón de descubrimiento automático y con aserciones del comportamiento esperado. La suite normal mantiene su resultado 234/234; eso no incluye ni resuelve estos fallos adicionales.

```powershell
docker compose exec -T backend python manage.py test common.audit_revalidation_20261021 --noinput
```

Las reproducciones usan una BD desechable y tráfico HTTP simulado. No se cambió lógica funcional ni se aplicaron migraciones, purgas o actualizaciones de dependencias del proyecto. Las herramientas Python se instalaron en un venv temporal separado del runtime. Se restauraron dependencias frontend del lockfile y se descargó Chromium para ejecutar la suite.

El fixture `revalidation-20261021` tenía dos usuarios, cero targets activos, cero checks y cero asociaciones a recursos externos antes del cierre. Se retiró únicamente esa organización mediante el comando con `--cleanup`, conservando auditoría; ninguna cuenta real se utilizó como fixture.

Siguen fuera de esta evidencia: CI remoto, despliegue/TLS real, builds y Trivy de imágenes, SMTP/Turnstile/pagos/webhooks externos, agente desplegado y carga sostenida. Los pendientes históricos de rotación SMTP y revisión/activación de retención no se consideran resueltos por esta revisión.

## Orden de corrección propuesto

1. Cerrar la reasignación entre tenants y convertir su reproducción en regresión regular. Aceptación: PATCH ajeno rechazado, relación conservada y target B sin supresión de alertas.
2. Actualizar el bundle TLS de los runtimes y revisar Pillow; reconstruir y repetir auditoría Python más suite completa. No basta con cambiar requirements si siguen ejecutándose imágenes antiguas.
3. Unificar ejecución HTTP segura y configuración real; probar método, cabeceras, cuerpo, códigos esperados, redirecciones y DNS cambiante sin acceder a infraestructura real.
4. Corregir el lockfile frontend y repetir instalación reproducible, build, auditoría npm y navegación.
5. Cerrar los fallos de Chromium con evidencia del reloj y su navegación, luego repetir suite completa y CI.
