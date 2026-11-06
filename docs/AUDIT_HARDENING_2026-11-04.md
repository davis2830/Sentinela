# Auditoría por módulos y corrección operativa — 2026-11-04

## Alcance y conclusión

Correcciones locales sobre `33942ba`, con cambios sin commit. Se preservan Free
300 s / Pro 60 s, cuotas, verificación, cadencias compartidas, permisos, aislamiento,
SSRF, previews independientes, 202/429 y retención protegida. No se desplegó ni se
alteraron cuentas o bases operativas. Esta revisión no autoriza producción ni
sustituye una prueba de penetración o capacidad del entorno objetivo.

Se usaron proyectos Docker separados: `sentinel-audit-20261104` para Django/E2E
y un proyecto `sentinel-prod-audit-*` para el Compose productivo real. Correo locmem,
cuentas `@example.test`, destinos controlados, ausencia de Beat en auditoría y
certificados TLS efímeros. No se enviaron mensajes a personas. El daemon Docker
se inició; la pila operativa existente no se recreó ni migró.

## Hallazgos corregidos

| ID | Corrección local y evidencia |
| --- | --- |
| REV-NOV-001 | `follow-redirects` y `postcss-selector-parser` actualizados dentro de sus rangos; npm completo sin vulnerabilidades |
| REV-NOV-002 | CI ejecuta Senti9 en su target Linux, con OpenSSL y sin red; 58/58. Limpieza de SQLite y permiso temporal de archivo corregidos en tests |
| REV-NOV-003 | La fixture E2E inicia worker después de preparar BD y usuarios; readiness permanece estricto |
| REV-NOV-004 | Solo `/health` y `/health/` quedan exentos del redirect Django; API conserva HTTPS. Regresión middleware y smoke TLS sobre Compose real |
| REV-NOV-005 | Deploy exclusivamente manual y con CI exitoso del mismo SHA/repo; dos pruebas cubren fallo, ejecución pendiente, SHA distinto, fork y PR |
| REV-NOV-006 | Backend Alpine, parches de distribución, pip retirado del runtime, usuarios no-root; frontend y nuevo gateway parcheados. Trivy de las tres imágenes: cero High/Critical |
| REV-NOV-007 | Roadmap/readiness actualizados; informes históricos conservados |
| NOV-008 | Faltaba `packaging` al ejecutar el alta real de Monitoring; dependencia explícita y alta administrativa E2E corregida |
| NOV-009 | Filtros `page_id` inválidos en Status Page podían producir 500: validación UUID tras permisos, cinco rutas y PATCH Viewer cubiertos |
| NOV-010 | Preferencia de Status Page global podía reutilizar un ID ajeno/obsoleto: almacenamiento por organización y consultas solo con selección existente |
| NOV-011 | Gateway upstream tenía 1 Critical y 5 High corregibles: imagen propia con `apk upgrade`, no-root, configuración incorporada y gate Trivy en CI/CD |
| NOV-012 | Compose productivo no pasaba `REDIS_PASSWORD` a Django para el caché: se transmite también a worker/Beat. Smoke real con Redis autenticado aprobado |
| NOV-013 | Rollback SQL anterior podía restaurar sobre tablas existentes sin abortar: backup custom, checksum, recreación solo bajo flag irreversible y `pg_restore --exit-on-error` |
| NOV-014 | Harness UI tenía URL fija y carreras por avanzar el reloj antes de finalizar navegación/datos; URLs configurables, fixtures completas y esperas de estado, sin relajar negocio |
| NOV-015 | Instalación Python con rangos abiertos: constraints fija los 48 paquetes del inventario probado; instalación limpia y `pip check` aprobados |

No se añadieron exclusiones Trivy, `expectedFailure`, skips nuevos ni auditorías
silenciadas. Se conservó una omisión Windows/POSIX preexistente al probar fuera
de Linux; el target Linux ejecuta las 58 pruebas sin omisiones. La causa exacta
del antiguo traceback CI en Python host no se acredita: se ejecuta ahora el
runtime oficial del agente en lugar de asumir equivalencia del host.

## Matriz por módulo

La columna funcional/seguridad refiere a pruebas automatizadas aprobadas en el
alcance indicado, no a garantía de ausencia de defectos. p95 corresponde solo al
GET medido con el dataset sintético descrito después.

| Módulo | Funcional y seguridad | Operación y límites | p95 local GET |
| --- | --- | --- | ---: |
| Registro/verificación | Beta, expiración/reutilización, activación explícita, admisión y correos temporales | Entrega simulada locmem; proveedor real pendiente | No medido |
| Login/sesiones/2FA | JWT, blacklist, revocación, refresh concurrente y ausencia de acceso prematuro | Flujos de navegador y errores de sesión | Login aislado, sin carga de autenticación |
| Onboarding | Free por defecto, protocolos, pruebas opcionales y confirmación de métodos mutantes | No crea históricos/SLA desde previews | Presupuestos/concurrencia, no throughput |
| Organización/planes | Free/Pro/beta/vencida, cuotas transaccionales y bloqueo de upgrades sin contratación | No cambia cuotas ni activa pagos reales | 38,63 ms suscripción |
| Usuarios/equipos | Viewer lector, último administrador, invitaciones/cupos y aislamiento | Carreras reales con conexiones PostgreSQL separadas | 41,10 ms usuarios |
| Uptime & Latencia | Alta E2E deshabilitada, HTTP/TCP, 202/429, SLA sin salud ficticia, SSRF/IP fijada | GET sin sondeo y reloj compartido; sin carga de sondeos reales | 116,40 ms |
| SSL | Identidad/cupo, vencimientos, disponibilidad de scan y permisos compartidos | Tarea registrada y ejecución controlada; CA real externa pendiente | 64,60 ms |
| DNS | Cambios normalizados, historial, intervalos y aislamiento | Resolución controlada y guardia de concurrencia | 48,20 ms |
| WHOIS | Identidad, asociación explícita, cuotas y límites | Tarea registrada; registradores externos no certificados | 51,27 ms |
| API Checks | Contratos HTTP, previews, métodos mutantes, tokens/tenant y SSRF | Resultados/202/429; pruebas de conexiones controladas | 57,04 ms |
| Security Headers | Scoring/ausencia de datos, permisos, cuotas y salida segura | Escaneo/polling y previews independientes | 43,51 ms |
| Sentinine | 58 pruebas Linux y contratos backend v2, acuses, duplicados, expiración y secretos | Cola, recuperación, backpressure, DNS/IPv6 y TLS local real | 41,01 ms inventario de agentes |
| Alertas | Reconocimiento por admin, referencias tenant y deduplicación en incidentes | Entrega/supresión y reglas controladas | 47,30 ms |
| Incidentes | Estados, asociación y asignación del mismo tenant | Timeline y agrupación; UI de gestión | 36,47 ms |
| Mantenimientos | Recurrencia, límites temporales, SLA y acciones masivas | Sincronización con Status Page dentro del alcance probado | 42,98 ms |
| Status Page | GET sin crear/publicar, desconocidos explícitos, aislamiento y filtros inválidos | Preferencia por tenant, directorio y publicación seleccionada | 32,89 ms |
| Notificaciones | Canal del tenant, locmem real, fallo explícito e idempotencia | Dos conexiones concurrentes; proveedor real pendiente | 34,24 ms; canales 34,35 ms |
| Reportes | Datos/tenant, HTML imprimible, exportación autenticada | Fallos y resúmenes; no se afirma PDF binario | 34,46 ms |
| Auditoría | Tenant exacto, global restringido, parámetros y ausencia de secretos | Conservación tras retiro de fixtures | 34,90 ms |
| Dashboards | Conteos, estados desconocidos, filtros, tooltips, permisos, fallos parciales y móvil | Reloj/lecturas, sin mutaciones al refrescar | 44,74 ms agregado Monitoring |
| Plataforma/perfil | Privilegios, roles, precios del catálogo y rutas inexistentes | Navegación y formularios; sin carga admin privilegiada | No medido |
| Celery/readiness | Registro de tareas; BD, caché autenticado, broker y worker | TLS 1.2/1.3, HSTS, API privada y caída/recuperación del worker | Smoke, no prueba de saturación |
| Retención | Solo históricos, límite contractual y tenant; protección de configuraciones | Flag histórico sigue `false`; no se purgaron datos operativos | No medido |

Cobertura principal: `backend/common/tests_module_audit.py`,
`tests_hardening_contracts.py`, `tests_scan_limits.py`, `tests_scan_availability.py`,
`tests_diagnostics.py`, suites de accounts/users/organizations/monitoring,
`sentinine/test_*.py`, `frontend/e2e/` y `frontend/audit/system-audit.spec.ts`.
No todos los CRUD, combinaciones de configuración o proveedores posibles fueron
explorados manualmente; esos límites no se presentan como módulos certificados.

## Evidencia de pruebas

| Gate local | Resultado |
| --- | --- |
| Django en imagen con constraints | 291/291; 70,719 s; base temporal creada y destruida |
| Senti9 Linux, sin red ni privilegios | 58/58; sin omisiones |
| TypeScript/build | Aprobados; Vite 7.3.7 |
| Chromium completo | 204/204; 5,9 min, sin reintentos ni omisiones; 18 rutas en 1440×900 y 390×844 |
| Guard/plantillas | 7/7 y guard aprobados |
| Endpoint IPv6 | 3/3 aprobadas |
| Gate de release | 2/2 aprobadas |
| npm completo | Cero vulnerabilidades conocidas |
| pip-audit del inventario exacto | 48 paquetes; cero vulnerabilidades conocidas |
| Trivy backend/frontend/gateway | Cero High/Critical, sin exclusiones; inventario Python idéntico tras constraints |
| Trivy config | Seis Dockerfiles: cero High/Critical, sin exclusiones |
| Workflows | actionlint/ShellCheck aprobados sin excepciones; copias de workflows sin red |
| Compose/migraciones | Config válida; `makemigrations --check --dry-run` sin cambios y `migrate --check` aprobado |
| Topología productiva real aislada | HTTP→HTTPS, TLS 1.2/1.3, HSTS, frontend, API 401, backend sin puerto host, UID 10001 y pérdida/recuperación de worker |
| Backup/restauración | Dump custom restaurado en otra BD ficticia: 4 usuarios y 2.500 checks; BD restaurada retirada |

Las primeras ejecuciones de Chromium detectaron dependencia faltante, URL de
harness fija y una carrera de medición SVG. Una ejecución posterior pasó 203/204
por la preparación del nuevo test de Status Page; otra falló en navegación y reloj.
Se corrigieron esperas de estado y se repitió el caso del reloj cinco veces: 5/5.
Una repetición agotó el presupuesto de login de las cuentas usadas en muchas
ejecuciones; se mantuvo el límite 15/900 s y se creó otra fixture para la suite
final. Esa ejecución completa pasó 204/204. No se limpiaron presupuestos ni se
relajaron límites. Ninguna ejecución fallida se considera un gate completo aprobado. Evidencia local
en `.tmp/audit-20261104/`; las trazas permanecen ignoradas por Git.

## Rendimiento: baseline de lectura, no capacidad de producción

- Escenario versionado: `tests_perf/scenarios/07_module_read_audit.js`.
- Dataset protegido: `tests_perf/seed_audit_dataset.py`, solo DEBUG, BD `sentinel_audit`,
  flag E2E y organización ficticia exacta con sus dos usuarios; transacción y sin sobrescritura.
- 25 recursos por módulo de Conectividad, 2.500 mediciones Monitoring, 25 alertas,
  5 incidentes, 5 mantenimientos, 25 notificaciones fallidas, 5 reportes,
  2 páginas privadas, 3 agentes offline y canal deshabilitado.
- Recursos de sondeo deshabilitados donde el modelo lo permite; sin Beat ni envíos.
  Pro activo es exclusivamente un estado de fixture, no una concesión a usuarios reales.
- Duración 115 s, hasta 5 VUs, 18 endpoints, 2.269 solicitudes incluyendo login,
  cero errores HTTP, 2.268 checks correctos, p95 global 59,42 ms, máximo 265,72 ms.
- Umbrales por endpoint p95 <500 ms, fallos <1% y checks >99%: aprobados.
- Host Windows/Docker Desktop 29.8.2, x86_64, 16 vCPU disponibles y 12.138.213.376
  bytes de RAM asignada al daemon, compartido con otros servicios locales. No equivale
  a tráfico de clientes, carga de sondeos, soak, estrés prolongado o capacidad máxima.
- Resumen local saneado: `tests_perf/reports/module-audit-local.json`, ignorado,
  `setup_data=null`; no usar `--summary-export` con JWT.

## Artefactos finales y limpieza

- Backend: `sha256:e310c2fe4e02dfd47907de9eaf36412e479a2032c9dd312074b55f0b19bdf9da`.
- Frontend: `sha256:e8e23041649219bd9247bd2ecfcac647aaefba32b60c08542b1d04ec8f4ca7a4`.
- Gateway: `sha256:be73971a3de43cbb2e8e95546f6796f64a7788d52edea67bcbff5c1d82da3863`.
- Tres organizaciones ficticias retiradas mediante el comando protegido; se
  conservaron **84 registros de auditoría**. Proyectos de auditoría detenidos sin
  borrar volúmenes; ninguna organización real se eliminó.
- Los JSON de escaneo y logs de pruebas permanecen en `.tmp/audit-20261104/`,
  ignorados. No se versionan dumps, exportaciones de imagen ni trazas de navegador.
- El runtime operativo previo no se reconstruyó: las evidencias corresponden a
  las imágenes aisladas indicadas. Publicar/aplicar el cambio requiere su revisión.

## Cierre pendiente antes de producción

1. Revisar/publicar estos cambios y ejecutar CI sobre el SHA final. No se hizo commit
   ni push; el CI remoto observado anteriormente sigue correspondiendo al código anterior.
2. Configurar revisores del entorno GitHub `production`, los secretos SSH y las tres
   imágenes GHCR. Solo entonces solicitar despliegue manual con CI verde del mismo SHA.
3. SMTP/Turnstile/dominio reales, SPF/DKIM/DMARC y entrega al destinatario autorizado;
   no acreditados por fixtures. Pagos reales continúan fuera de esta fase.
4. Rotación SMTP y revisión del backup/JWT publicados históricamente: sin evidencia
   nueva de cierre. La limpieza del árbol no sanea el historial público.
5. Ensayo de rollback completo y restauración en preproducción; revisar migraciones
   irreversibles y permisos/renovación de la llave TLS (grupo 101, modo 0440).
6. Dry-run vigente de cuarentena/retención y respaldo aprobado antes de aplicar cambios
   sobre datos antiguos. Mantener el techo histórico desactivado mientras tanto.
7. Verificar Alloy/Loki en el entorno objetivo y ejecutar soak/capacidad con una carga
   representativa antes de aumentar admisión beta, cuotas o retención. Logs ampliados
   siguen reservados a su fase posterior.

El baseline anterior permite continuar hacia preproducción controlada; no permite
declarar el producto libre de vulnerabilidades ni abrir producción automáticamente.
