# Auditoría integral de Sentinel — 2026-10-12

> Reevaluación local del 2026-10-13: se conservan los hallazgos y resultados originales como evidencia histórica. Las correcciones, nuevas regresiones y gates externos están en [el informe de remediación](AUDIT_REMEDIATION_2026-10-13.md). No interpretar las cifras originales como el estado corregido actual, ni la aprobación local como autorización de beta.

## Dictamen y alcance

**No aprobar la apertura de beta con el estado auditado.** Hay 19 hallazgos consolidados: 2 P0, 9 P1, 7 P2 y 1 P3. Las suites anteriores pasan, pero las comprobaciones adicionales reproducen defectos no cubiertos. No se corrigió código funcional, no se migró ni se desplegó; las correcciones requieren aprobación.

Revisión: `8b118fb85dd75140a0b0ee9942137a605a386dde`, rama `main`, árbol limpio al comenzar. Se añadieron únicamente informe, reproducciones y aislamiento del harness E2E. No se modificaron cuentas reales. Los resultados son locales, no evidencia de CI ni certificación de seguridad.

Entorno observado: PostgreSQL 16, Redis 7; Python 3.13.16, Django 5.2.17, DRF 3.18.1, Celery 5.6.3; Node 24.19.0, React 18.3.1, Vite 5.4.21, TypeScript 5.9.3, Playwright 1.55.1. Servicios Compose activos. Un worker respondió `pong`; las 11 entradas Beat referencian tareas registradas. Esto no demuestra ejecución correcta de todas las integraciones.

## Evidencia y límites de las pruebas

| Ejecución | Resultado | Interpretación |
| --- | --- | --- |
| Suite Django existente, repetida al cierre | 171/171 aprobadas | Cobertura existente, no aprobación del sistema completo |
| TypeScript y build Vite, repetidos | Aprobados | Compilación, no ausencia de bugs |
| Chromium existente, repetido al cierre | 136/136 aprobado | Alta real aislada sin activar sondeos; no cubre los cuatro defectos UI adicionales |
| Reproducciones backend adicionales | 31: 8 aprobadas, 23 fallidas; sin errores de harness en la ejecución final | Los fallos verifican invariantes incumplidas; no están marcados como expectedFailure |
| Reproducciones UI adicionales | 6: 2 aprobadas, 4 fallidas | Smoke de 18 rutas en dos tamaños aprobado; cuatro defectos reproducidos |
| Concurrencia adicional | Dos altas SSL: `[201, 201]`, 3 recursos con límite 2 | Carrera confirmada fuera de organizaciones beta |

Las reproducciones backend viven en [common/audit_20261012.py](../backend/common/audit_20261012.py). Su nombre evita que se confundan con los 171 tests de baseline; se ejecutan explícitamente y devuelven exit code distinto de cero mientras existan los hallazgos. Los tests UI adicionales están en [frontend/audit](../frontend/audit/system-audit.spec.ts). No sumar sus fallos a un supuesto gate verde.

Fixtures persistentes: `audit-20261012-a`, `audit-20261012-b` y `audit-20261012-c`, creados mediante `seed_e2e_accounts`, con administrador y Viewer. Las organizaciones Free, Pro, beta y vencidas adicionales, así como el superusuario, se ejercitan en bases Django desechables. Correos de pruebas: `example.test`; envíos de invitaciones simulados, entregas locales de la suite con locmem. No se enviaron correos a personas.

**Incidencia de aislamiento:** la primera ejecución E2E existente creó un target activo de `example.com`. Su tenant de prueba llegó a acumular 5 checks, un certificado escaneado y un resultado de cabeceras. No se puede afirmar que esa ejecución estuvo totalmente libre de conexiones externas. Se canceló únicamente la habilitación del fixture A y se ajustó el test de alta para persistir `enabled:false` y `related_modules:[]`. El producto no cambió. Se valida de nuevo con fixture C; este riesgo se registra en SENT-AUD-019.

Una ejecución intermedia Django se descartó por colisión de nombres de base de pruebas. La ejecución definitiva de auditoría usa `test_sentinel_audit_20261012`; el baseline usa `test_sentinel`. También se descartaron errores iniciales del harness (campo de fixture incorrecto, PATCH sin dominio donde el contrato exige dominio, DNS mock que afectaba Redis). Los resultados finales no cuentan esos errores como bugs del producto.

No verificado: CI remoto, producción/TLS real, pagos, SMTP/Turnstile/webhooks reales, agente Sentinine desplegado, carga sostenida, capacidad, entrega Loki de extremo a extremo y auditoría completa de dependencias. Flake8 no está instalado en el contenedor; no se instaló ni se declaró ese gate aprobado. No se ejecutó purga contra la BD local real. La lectura de la plantilla SMTP nunca imprimió sus valores; no se comprobó su validez contra Gmail ni su exposición en remotos/historial. Se contrastaron contratos/documentos relevantes, no cada afirmación de los 37 Markdown versionados ni todos los campos de cada formulario.

## Matriz por módulo

`A` significa aprobado únicamente en los recorridos probados; `H` indica hallazgos; `NV` no verificado. La tabla separa funcionalidad (F), permisos/planes (P), operación (O), interfaz (UI) y documentación/contratos (D). Las aprobaciones no equivalen a revisar todos los campos y combinaciones posibles.

| Módulo | F | P | O | UI | D | Evidencia / pendiente |
| --- | --- | --- | --- | --- | --- | --- |
| Registro e invitación beta | A | A | A | A | A | `tests_beta`, `beta-flows`: verificación, replay, capacidad y fallos de correo simulados; proveedor real NV |
| Login, sesiones y 2FA | A | A | A | A | A | `SecurityAndAuthTests`, `auth-session`, `tests_beta`; no revisión exhaustiva de cada combinación TOTP |
| Tokens API y perfil | A | A | A | A | A | Hash, revelado único, scope read y flujo de identidad; smoke perfil |
| Invitaciones de miembros / onboarding | H | H | H | A | H | 005 y 008; onboarding y previews existentes pasan |
| Organización y planes | H | H | H | A | H | 004, 005, 006 y 018; Free 300 s / Pro 60 s y vencimiento pasan |
| Usuarios y equipos | H | H | H | H | H | 003 y 005; roles/permisos como submódulos inventariados; aislamiento de equipo extranjero aprobado |
| Uptime & Latencia / ficha | H | A | H | H | H | CRUD, scans 202/429 y cobertura por protocolo pasan; 012 y 013 |
| SSL | A | H | H | A | A | CRUD válido aprobado; 018 bajo concurrencia fuera de beta |
| DNS | A | A | A | A | A | CRUD, SSRF de resolver, cambios normalizados y retención en suite existente; resolución externa real NV |
| Dominios WHOIS | A | A | A | A | A | CRUD con dominio, asociaciones explícitas y schedulers probados; WHOIS real NV |
| API Checks | A | H | A | A | H | 004; CRUD, métodos mutantes y presupuestos de preview pasan |
| Security Headers | A | A | A | A | A | CRUD, SSRF, historial y previews; ejecución contra proveedor externo NV |
| Sentinine | H | A | H | A | H | 007; tenant, asignación, duplicados y vencimiento en suite existente; binario desplegado NV |
| Reglas y alertas | H | H | A | A | H | 014; reconocer/resolver, deduplicación y eventos probados; referencias inválidas aceptadas |
| Incidentes | A | A | A | A | A | Ciclo, relaciones tenant, timeline y deduplicación en suite existente |
| Mantenimientos | H | A | H | A | H | 010; rangos, recurrencia y SLA existentes pasan; masivos no sincronizan publicación |
| Status Page administrativa y pública | H | H | H | A | H | 004 y efecto de 010; publicación explícita y estados desconocidos pasan |
| Notificaciones | A | A | A | A | H | SMTP plantilla 001; serializers de lectores, fallo/cero envíos e idempotencia local pasan; proveedor real NV |
| Reportes / SLA live | A | A | A | H | H | Seis generadores, rangos y ausencia de mediciones pasan; exportación 016 |
| Centro de Conectividad | A | A | A | A | A | Gráficas, filtros, atención y fallo parcial pasan; auditoría agregada afectada por 002 |
| Resumen de gestión | A | A | H | A | H | Conteos/filtros/deduplicación pasan; mantenimiento público afectado por 010 |
| Auditoría | H | H | H | A | H | 002 y 011; entradas tenant extranjero correctamente ocultas, globales no |
| Administración de plataforma | H | A | A | A | H | Solo superusuario aprobado; precio/MRR 015; pantalla privilegiada no auditada visualmente como superusuario |
| Celery y healthchecks | H | A | H | A | H | Registro Beat, pruebas directas y worker ping; readiness 009 |
| Retención | A | H | H | NV | H | ORM tenant-aware conserva configuraciones en tests; techo comercial eludible 006 |
| Navegación global / harness | H | A | H | H | H | 017 y 019; 18 rutas válidas sin overflow en dos viewports |

Reconciliación de inventario: 17 aplicaciones propias, 44 modelos propios cargados (incluidos los seis de beta), 20 prefijos REST principales más health, 11 entradas Beat. Sentinine está integrado en Monitoring; roles, permisos y equipos pertenecen a Usuarios. Planes pertenece a Organización. Auditoría guarda UUIDs, no FK de organización: no afirmar que borrar un tenant transforma sus logs en globales.

## Hallazgos reproducibles

### SENT-AUD-001 — P0 — Material SMTP no-placeholder en plantilla versionada

- Condición/evidencia: `.env.production.example` está seguido por Git y tiene `EMAIL_HOST_PASSWORD` no vacío/no-placeholder; también `EMAIL_HOST_USER`. Se inspeccionó presencia, no se copiaron valores. La validez de la contraseña no se probó.
- Esperado/observado: plantilla publicable sin secretos / material de credenciales en texto plano dentro del repositorio auditado.
- Impacto/causa: riesgo de uso indebido del remitente; configuración operativa copiada a una plantilla.
- Corrección propuesta: revocar/rotar si es una credencial vigente, sustituir por placeholders, revisar exposición histórica y remota, añadir secret scanning. No reescribir historia ni rotar sin autorización específica.
- Regresión: rechazar secretos no-placeholder en archivos de ejemplo y comprobar que la nueva credencial solo está en almacenamiento privado.

### SENT-AUD-002 — P0 — Auditoría global visible desde cualquier tenant

- Reproducción: probe `test_006` crea un marcador privado con `organization_id=None`; un Viewer de A lo recibe en `GET audit-logs/`. `test_022` confirma que un registro explícitamente de B sí se oculta.
- Esperado/observado: A solo ve su auditoría / también ve todas las entradas sin tenant. El riesgo incluye información de identidad y administración, según contenido de esas entradas.
- Ubicación/causa: `backend/audit/services.py:37`, filtro con `OR organization_id IS NULL` para lectores tenant.
- Corrección propuesta: filtro exacto de tenant; consultas globales separadas y exclusivamente de plataforma. No borrar registros.
- Regresión: logs propios, ajenos y globales con administrador, Viewer y superusuario; entradas globales jamás visibles en el API tenant.

### SENT-AUD-003 — P1 — Viewer puede modificar miembros y equipos

- Reproducción: probes `001–005`: desactivar/eliminar admin por `organizations/members/bulk-action/` devuelve 200 y cambia/borra el usuario; crear equipo devuelve 201; editar/eliminar devuelve 200. UI adicional muestra «Nuevo Equipo» a Viewer.
- Esperado/observado: 403 sin cambios / mutaciones reales, incluidas operaciones contra administradores de la misma organización.
- Ubicación/causa: `backend/organizations/views.py:452`; `backend/users/views.py:301,372,475,539`, permisos solo autenticado. `frontend/src/pages/UsersPage.tsx:542`, botones ordinarios sin gate de rol.
- Corrección propuesta: autorización de administración antes de validación en todos los endpoints masivos/equipos; ocultar controles a lectores; proteger al último administrador en operaciones individuales y masivas.
- Regresión: CRUD/seed/membresía y bulk como Viewer, operador y administrador; ninguna mutación con scope read; no dejar una organización sin administrador.

### SENT-AUD-004 — P1 — Cuotas de API Checks y Status Page siempre cuentan cero

- Reproducción: probes `016–018,024`: un recurso existente produce `current:0`; Free puede crear otro API y otra Status Page por encima del límite, HTTP 201.
- Esperado/observado: inventario real y rechazo al alcanzar cuota / altas admitidas y contador incorrecto.
- Ubicación/causa: `backend/organizations/services.py:57,64`, busca `APICheck` y `StatusPage` inexistentes; captura la excepción y usa cero. Los modelos reales son `APICheckTarget` y `StatusPageConfig`.
- Corrección propuesta: usar modelos correctos, no fallar abierto ante errores de conteo y revalidar cuota dentro del bloqueo transaccional de alta.
- Regresión: cero, límite, exceso, aislamiento, Free/Pro/beta y dos altas concurrentes en ambos módulos.

### SENT-AUD-005 — P1 — Alta directa y aceptación de miembros eluden cuota

- Reproducción: probes `009–010`, Free con cupo completo: `POST users/` devuelve 201 y aceptación de invitación devuelve 200, creando otro integrante. No se enviaron correos.
- Ubicación/causa: `backend/users/services.py:33` solo limita organizaciones `beta_managed`; `backend/organizations/views.py:637` acepta sin revalidar capacidad.
- Esperado/observado: cupo comprobado al crear/aceptar / capacidad excedida por rutas alternativas.
- Corrección propuesta: una política común transaccional para todos los tenants, considerando invitaciones válidas y evitando doble conteo del cupo reservado por la invitación aceptada.
- Regresión: alta directa, aceptación, reenvío, invitación vencida y aceptación concurrente, con cupo completo o liberado.

### SENT-AUD-006 — P1 — Free puede ampliar retención a diez años

- Reproducción: probe `028`: beta Free con retención 3 días puede enviar `PATCH organizations/current/ {metrics_retention_days:3650}`, HTTP 200.
- Ubicación/causa: `backend/organizations/serializers.py:105` admite 7–3650; la vista actualiza directamente; `purge_telemetry` utiliza el valor de organización sin techo del plan.
- Esperado/observado: retención efectiva limitada por contrato / techo de almacenamiento eludible desde configuración. Esto no demuestra corrupción de la purga; su selección tenant-aware sí pasa.
- Corrección propuesta: limitar configuración y limpieza efectiva por plan; armonizar mínimo beta de 3 días y cambios de plan sin eliminar datos retrospectivamente durante esta auditoría.
- Regresión: Free/beta/Pro, downgrade, valor antiguo fuera de cuota y purga que nunca elimina configuraciones.

### SENT-AUD-007 — P1 — Sentinine persiste telemetría no válida

- Reproducción: probes `020–021`: con token del agente y asignación pendiente, `response_time_ms:'NaN'` devuelve 200 y crea un check; una lista con un string devuelve 500.
- Ubicación/causa: `backend/monitoring/services.py:696,715`, conversión directa a float y `item.get` sin serializer de cada resultado.
- Esperado/observado: 400, medición/reserva intactas / datos no finitos persistidos o excepción. No se observó acceso a otro tenant: ese control sí existe.
- Corrección propuesta: validar forma, UUID, estado permitido, latencia finita/no negativa, HTTP status y tamaños antes de consumir reservas; definir rechazo atómico del lote inválido.
- Regresión: NaN/infinito/negativos/status inválido, lote mixto, duplicado, recurso ajeno, vencimiento y reenvío tras rechazo.

### SENT-AUD-008 — P1 — Invitaciones de integrantes ignoran dominio público

- Reproducción: probe `011`, `PUBLIC_APP_URL=https://sentinel.example.test`, entrega SMTP mock: el mensaje generado sigue apuntando a `http://localhost:3001`.
- Ubicación/causa: `backend/organizations/views.py:243,407`, enlaces hardcoded en alta y reenvío.
- Esperado/observado: URL pública configurada / enlaces locales que no funcionan para un destinatario remoto.
- Corrección propuesta: constructor común basado en configuración pública validada; preservar activación explícita y no introducir tokens en logs.
- Regresión: alta y reenvío con URL local/productiva, configuración faltante, expiración y token utilizado.

### SENT-AUD-009 — P1 — Healthcheck afirma salud con broker caído

- Reproducción: probe `012`, fallo controlado de conexión broker; endpoint responde 200 y `status:'healthy'` mientras su componente Celery figura degradado.
- Ubicación/causa: `backend/common/views_health.py:99–115`, fallo del broker no cambia `overall_healthy`. La vista tampoco verifica workers aunque su descripción los menciona.
- Esperado/observado: readiness degradada/no disponible / señal global positiva para despliegue y monitoreo.
- Corrección propuesta: separar liveness de readiness o hacer que readiness incluya broker; comprobar workers con timeout/cache acotados si se anuncia esa capacidad.
- Regresión: BD/cache/broker caído y ausencia de worker; límites de tiempo; ningún falso éxito global.

### SENT-AUD-010 — P2 — Mantenimiento masivo no sincroniza Status Page

- Reproducción: probe `023`: ventana publicada pasa a `in_progress` mediante bulk; su mantenimiento público sigue `scheduled`.
- Ubicación/causa: `backend/maintenance/services.py:387`, masivos cambian filas/timeline sin llamar la sincronización usada por acciones individuales.
- Esperado/observado: mismo efecto que acción individual / estado público y privado divergentes.
- Corrección propuesta: reutilizar transiciones individuales dentro del batch, incluyendo sincronización y validación del estado.
- Regresión: start/complete/cancel individuales y masivos, ventanas publicadas/privadas y rollback ante fallo.

### SENT-AUD-011 — P2 — Parámetros de auditoría provocan 500

- Reproducción: probes `007–008`: `audit-logs/?limit=bad` y `limit=-1` responden 500.
- Ubicación/causa: `backend/audit/views.py:23`, `int` directo; `backend/audit/services.py:45`, slicing negativo. No hay techo explícito para consultas enormes.
- Corrección propuesta: validar enteros positivos y aplicar máximo acotado; error de cliente claro, sin traceback público.
- Regresión: no numérico, negativo, cero, enorme, filtros inválidos y valor normal; consultas acotadas.

### SENT-AUD-012 — P1 — Histórico fallido aparece como SLA saludable

- Reproducción UI `failed resource history…`: un GET timeseries devuelve 500; drawer muestra dos valores `100.00%`, cero checks y «Cumple meta SLA». Captura revisada visualmente.
- Ubicación/causa: `frontend/src/components/monitoring/TargetDetailDrawer.tsx:33,95`, fallback `defaultSummary` con uptime 100; falta rama de error. El dashboard global y los reportes sin mediciones sí pasan sus tests.
- Esperado/observado: «Datos no disponibles» / salud y cumplimiento ficticios.
- Corrección propuesta: separar carga/error/sin mediciones de resumen real, usar nulos y permitir recarga sin sondeo; no mostrar cumplimiento sin evidencia.
- Regresión: 500/timeout, cero checks, datos válidos, recuperación y detalle eliminado en desktop/móvil.

### SENT-AUD-013 — P2 — Detalles de Monitoring mantienen timers independientes

- Reproducción UI `Free resource drawer…`: con Free, avanzar 35 s provoca otra consulta de timeseries; no debería ocurrir antes del ciclo de área de 300 s. No es un bypass del POST de sondeo: es lectura GET.
- Ubicación/causa: `TargetDetailDrawer.tsx:92` usa 30 s; `ChecksList.tsx:29` usa 15 s. Los listados y el detalle API ya usan el reloj compartido.
- Corrección propuesta: integrar consultas de ficha/historial en el ciclo de Conectividad, respetando pausa, pestaña oculta y aislamiento de usuario/tenant. No igualar sin análisis heartbeats de agentes ni Status Page pública.
- Regresión: Free/Pro, historial abierto, navegación, pausa, ocultación y recarga manual; sin consultas extra ni POST.

### SENT-AUD-014 — P2 — Regla de alerta acepta un target extranjero

- Reproducción: probe `027`: crear una regla propia con UUID de target de B devuelve 201.
- Ubicación/causa: `backend/alerts/services.py:33` y serializers validan formato, no pertenencia ni compatibilidad condición/tipo.
- Esperado/observado: rechazar relación / configuración inválida persistida. No se demostró lectura de datos de B por la evaluación; no se clasifica como fuga cross-tenant.
- Corrección propuesta: validar target con la utilidad tenant existente, así como condición/tipo, en creación y edición.
- Regresión: propio/ajeno/inexistente, reglas globales y combinaciones de condiciones compatibles.

### SENT-AUD-015 — P2 — MRR Enterprise discrepa del catálogo

- Reproducción: probe `026`: catálogo Enterprise 399 USD; stats de plataforma calculan 299 USD para ese tenant activo.
- Ubicación/causa: `backend/organizations/views_admin.py:33–37`, tabla de precios duplicada frente a `PLAN_LIMITS`.
- Corrección propuesta: una fuente de precio vigente y rotular el MRR como estimación mientras no haya contratos/pagos confirmados; no inventar ingresos cobrados.
- Regresión: cada plan, trial/past_due/cancelado y negocio bajo cotización. Cobro real sigue fuera de alcance.

### SENT-AUD-016 — P3 — «Exportar PDF» descarga HTML

- Evidencia de inspección: vista `ReportExportPDFView` devuelve `text/html`; `frontend/src/pages/ReportsPage.tsx:145` crea blob HTML y archivo `.html`.
- Esperado/observado: etiqueta que describe el formato / nombre PDF para un informe HTML imprimible. No se probó generación de PDF binario porque no existe en ese flujo.
- Corrección propuesta: renombrar acción a «Informe imprimible (HTML)», conservando compatibilidad de ruta; PDF binario sería una capacidad posterior separada.
- Regresión: etiqueta, extensión/MIME reales, impresión y autenticación sin token en URL.

### SENT-AUD-017 — P2 — Ruta desconocida deja pantalla vacía

- Reproducción UI `unknown route…`: visitar `/audit-nonexistent-route` autenticado no muestra mensaje ni recuperación.
- Ubicación/causa: `frontend/src/App.tsx`, sin ruta catch-all.
- Corrección propuesta: pantalla 404 con retorno al dashboard y navegación accesible, distinta del error de carga de un recurso.
- Regresión: autenticado/anónimo, URL inválida y UUID eliminado, foco y enlaces de recuperación.

### SENT-AUD-018 — P1 — Carrera de cuota fuera de beta

- Reproducción: probe `031`, dos conexiones PostgreSQL, Free no beta con un cupo SSL restante: ambos POST devuelven 201 y el total pasa a 3 con límite 2. DNS y tareas externas simulados.
- Ubicación/causa: vista comprueba cupo antes de entrar en el servicio; `backend/common/beta_quota.py` bloquea la organización, pero solo revalida si `beta_managed=True`.
- Corrección propuesta: admisión transaccional común para beta y no beta, con revalidación bajo bloqueo. Aplicarla también a los demás recursos y rutas alternativas.
- Regresión: dos altas simultáneas con último cupo Free/Pro/beta; exactamente una alta; errores de infraestructura no deben interpretarse como protección correcta.

### SENT-AUD-019 — P2 — El alta E2E activaba sondeos externos

- Evidencia: test existente «an administrator creates a monitoring target» persistía un target habilitado y cobertura por defecto contra `example.com`; el fixture A acumuló mediciones reales de Monitoring/SSL/cabeceras durante la ejecución.
- Esperado/observado: tests aislados / trabajos y conexiones externas en background pese a que el test solo comprueba creación.
- Acción dentro de esta auditoría: solo el harness se ajustó para deshabilitar el target y vaciar cobertura; habilitación operativa del fixture A cancelada. Ningún endpoint o servicio del producto fue corregido.
- Pendiente/regresión: asegurar esa política en todos los fixtures/altas y tests de workers con destinos controlados. DNS de validación de altas puede seguir consultarse; no se presenta el baseline como una prueba completamente offline.

## Backlog y orden propuesto para aprobación

1. **Contención antes de beta:** 001 y 002; luego 003. Rotación y revisión histórica requieren autoridad explícita; conservar auditoría y no borrar cuentas reales.
2. **Restricciones comerciales y capacidad:** 004, 005, 006 y 018. Unificar admisión y retención efectiva, después probar concurrencia y downgrade.
3. **Exactitud operativa:** 007, 009 y 012; luego 008 para que las invitaciones funcionen con dominio público.
4. **Coherencia de recorridos:** 010, 011, 013, 014, 015 y 017.
5. **Presentación y evidencia:** 016 y completar aislamiento de 019; promover reproducciones a la suite regular al corregir, sin expectedFailure ni excepciones silenciadas.

No aprobar gates solo porque el baseline sigue verde. El cierre de correcciones debe dejar verdes las 31 reproducciones backend y los 6 casos UI adicionales, además del baseline, y repetir los escenarios extendidos propuestos por cada hallazgo.

## Reproducción y conservación de evidencia

Desde la raíz del repositorio:

```powershell
docker compose exec -T backend python manage.py test --noinput
docker compose exec -T backend python manage.py shell -c "from django.conf import settings; from django.core.management import call_command; settings.DATABASES['default']['TEST']['NAME']='test_sentinel_audit_20261012'; call_command('test','common.audit_20261012',interactive=False,verbosity=2)"
```

No lanzar dos suites Django con el mismo nombre de BD al mismo tiempo. Las migraciones que el runner aplica son exclusivamente a bases desechables, no migraciones de la aplicación local.

Para el navegador, crear un nuevo suffix `audit-20261012-...` con `SENTINEL_E2E_FIXTURE=1`, establecer `E2E_FIXTURE_SUFFIX` y ejecutar desde frontend:

```powershell
npm run test:e2e
npx playwright test --config audit/playwright.audit.config.ts
```

Los tests adicionales fallan deliberadamente en los puntos actualmente defectuosos; sus asserts expresan el comportamiento esperado, no reproducen como correcto el comportamiento vulnerable. No hacen POST de mutación real en la UI adicional. Capturas y trazas locales están en `frontend/test-results-audit/`, excluidas de Git; incluyen solo fixtures para los recorridos adicionales. No publicar trazas sin revisar tokens y datos.

Al terminar, `seed_e2e_accounts --suffix SUFIJO --cleanup` comprueba organización y correos exactos y retira solo recursos de ese fixture; conserva auditoría. Los fixtures pueden recrearse, pero la eliminación de sus filas de prueba no es un backup recuperable.

## Bitácora de cierre

- Baseline Django repetido: **171/171 aprobado**; build final aprobado. Baseline Chromium inicial: **136/136 aprobado**.
- Auditoría final: **31 backend = 8 aprobadas / 23 fallidas**, sin errores de harness; **6 UI = 2 aprobadas / 4 fallidas**.
- Repetición Chromium con aislamiento de alta: **136/136 aprobado**. Fixture C: un target, cero targets habilitados, cero checks, cero certificados y cero targets de cabeceras. El alta aislada no activó esos trabajos.
- Los tres fixtures A/B/C fueron retirados mediante el comando con validaciones exactas; auditoría conservada. Filas de pruebas recreables, sin backup de sus resultados. No se eliminó información de cuentas reales.
- `git diff --check` aprobado. Código funcional sin cambios; solo informe/índice, reproducciones, regla de ignore de capturas y aislamiento del test de alta existente. Sin migraciones de BD local, nuevas dependencias, commit, push o despliegue.
