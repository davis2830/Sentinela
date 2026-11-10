# Consola superadmin orientada a beta cerrada

Fecha de implementación: 2026-11-09, America/Guatemala. Evidencia local sobre código de esta entrega, PostgreSQL/Redis y correo simulado. CI remoto y despliegue permanecen separados. No acredita producción lista ni certificación formal de accesibilidad.

## Resultado

Se mantienen identidad oscura, navbar, lateral y sesión de plataforma independiente con 2FA y diez minutos. El lateral ahora contiene Resumen, Beta, Organizaciones, Usuarios, Salud de plataforma y Auditoría. El buscador central continúa retirado.

Resumen prioriza cupos, incorporación y pendientes de beta. El contexto comercial sólo consulta su API cuando se despliega. No se mezclan sus alcances: beta incluye participantes de organizaciones de prueba; comercial conserva la exclusión manual de pruebas.

Cuenta, acceso de organización, participación en beta y suscripción se presentan por separado. Una medición fallida cuenta como medición registrada y conserva el fallo. Los indicadores de configuración utilizan recursos actuales de Uptime, SSL, DNS, Dominios, API Checks y Security Headers: no representan un historial de adopción.

## Matriz funcional

| Sección / opción | Resultado esperado y comprobado | Evidencia / límite |
| --- | --- | --- |
| Resumen: carga inicial | Sólo resumen beta; cuatro indicadores y grupos de atención coherentes con el directorio | Django, mock de peticiones y API real; no consulta comercial ni eventos |
| Resumen: atención | Envío fallido, invitación vencida, verificación, acceso bloqueado, sin recursos y sin mediciones abren el filtro exacto | Agregaciones y filtro compartido; grupos pueden coincidir, no se suman |
| Resumen: contexto comercial | Consulta al desplegar, conserva clasificación y estimaciones existentes | Regresión Chromium y alcance explícito; no acredita pagos |
| Beta: incorporación | Separación de invitación, registro sin verificar y organización registrada; vencimiento no invalida una cuenta activa | Directorio con entrega de invitación y verificación independientes |
| Beta: invitar y reenviar | Confirmación y motivo; correo en cola o aceptado por servidor, sin afirmar recepción | Servicio existente, pruebas Django y API real con locmem |
| Beta: reenviar verificación | Sólo cuenta pendiente válida, sin organización; conserva límites y revoca enlace anterior | Regresión de cooldown/revocación; API real recupera envío fallido |
| Beta: cupos y admisiones | Acciones independientes; no permite cupos inferiores a reservas | Regresión Django/API real; configuración actual del backend |
| Beta: revocar/rechazar | Se aplican a pendientes, revocan enlaces; no se utilizan para cuentas registradas | Recorrido API real y protecciones de estado |
| Beta: suspensión/reactivación | Misma transición que Organizaciones | Prueba cruzada Beta → organización → Beta; suscripción intacta |
| Beta: comentarios | Dos enlaces HTTPS, motivo, gestión exclusivamente administrativa | Django y UI/API real; creación del formulario fuera de Sentinel |
| Portal: comentario | Participante beta recibe sólo enlace público; apertura sin parámetros de identidad | Django y Chromium; no se enviaron comentarios ni correos reales |
| Organizaciones: directorio | Búsqueda, filtros combinados, acceso/beta/clasificación, orden servidor, total y páginas de 25 | Regresiones de directorio y API real; formato sin page compatible |
| Organizaciones: CSV | Exporta resultados filtrados o todas; incluye acceso y beta | API real; alcance independiente de página y protección de fórmulas |
| Ficha: general/contacto | Identidad/estados persistentes; contacto acotado, motivo y auditoría | Django/API real; no modifica correo de inicio de sesión |
| Ficha: usuarios | Página de 25 y ficha administrativa bajo demanda | API real, consulta por ID y retorno al drawer |
| Ficha: recursos/límites | Consumo de siete módulos; lista sólo al seleccionar, páginas de 25 | 26 monitores y seis módulos reales en fixtures; destinos sin credenciales, query o fragmento |
| Ficha: agentes | Estado derivado de heartbeat vigente, sin token ni configuración | Regresión Django; sin heartbeat no se inventa medición |
| Ficha: historial | Consulta sección al seleccionarla y prepara Auditoría global manual | Regresiones de carga por sección |
| Plan | Vista previa servidor con límites efectivos beta, consumo y excesos; motivo para aplicar | Django/API real; Enter no elude una vista previa fallida; no elimina recursos |
| Prueba | Vista previa con fecha servidor y cambio explícito a trialing | Django/API real; no confirma cobros |
| Acceso | Bloqueo de nuevas sesiones/comprobaciones; sesiones invalidadas, datos/plan/fechas/roles conservados | JWT, token API y tareas en Django; recorrido administrativo real |
| Acceso concurrente | Beta y Organizaciones bloquean primero organización y después invitaciones; ambas transiciones terminan coherentes | Bloqueo PostgreSQL reproducido antes de corregir; regresión concurrente aprobada en la suite final |
| Acceso protegido | Superadmins activos impiden suspensión; reactivar no renueva prueba vencida | Django; trabajos ya iniciados no se cancelan forzosamente |
| Usuarios | Filtros y orden servidor; distingue legacy/custom; ficha muestra roles/permisos efectivos | Django, mock y API real; edición de roles continúa en organización |
| Usuarios: acciones | Activar/desactivar, Administrador/Lectura heredada y revocar sesiones; motivo y protecciones | API real; superadmins y último administrador protegidos |
| Salud | Consulta al entrar; actualización posterior manual; PostgreSQL, caché, broker y workers reales | API real y fallos parciales simulados; snapshots acotados |
| Salud: colas/copia | LLEN de colas y prioridades, sin consumir; resumen permitido al portapapeles | Django y Chromium; fuente inaccesible es No disponible, no cero |
| Auditoría | Cero eventos al abrir, editar, preparar o volver; consulta, paginación y detalle explícitos | Contador de red mock/API real, filtros de fechas y organización |
| Navegación/foco | Filtros, página y posición conservados; Escape, panel móvil, retorno del foco | Regresiones Chromium; respuesta tardía de A no muestra datos/acciones en B |
| Diálogos anidados | Una única ficha tras editar contacto, sin claves React duplicadas | Reproducción con API real convertida en regresión; sin errores React en el flujo nuevo |

Los errores y resultados anteriores se identifican junto a la acción. Las acciones de la ficha quedan deshabilitadas durante actualización fallida o pendiente. Salud no inicia terminales, reinicios ni ejecución remota.

## Correcciones reproducidas durante la validación

- Editar contacto podía duplicar fichas porque el drawer y el formulario usaban la misma clave React entre hermanos. Ahora tienen claves distintas; el recorrido real exige exactamente una ficha y ausencia de errores React.
- Suspender desde Organizaciones y reactivar desde Beta simultáneamente podía producir deadlock: Beta bloqueaba primero invitación y luego organización. Se reprodujo un 500 seguro en PostgreSQL. Ambas rutas ahora comienzan por organización; la regresión coordinada conserva acceso, invitación y suscripción coherentes.
- Los accesos bloqueados incluyen también cuentas desactivadas antes de crear su organización.
- La ficha distingue una fecha de prueba conservada de una prueba vigente. Cuando la suscripción ya no está en prueba, muestra la fecha registrada sin afirmar un vencimiento que no ocurrió.
- La prueba de paleta inspeccionaba por separado existencia y color de etiquetas y superficies de carga que podían desmontarse entre ambas lecturas. Ambas comprobaciones consultan el DOM y leen estilos dentro de una única ejecución del navegador, sin conservar referencias a nodos desmontados y manteniendo los colores exigidos. Tres repeticiones dirigidas aprobaron antes de la pasada completa de cierre.
- El harness de aislamiento de sesión ahora espera al formulario y precarga sus módulos antes de cambiar identidad, evitando una navegación durante la preparación de la prueba. Ambas regresiones de aislamiento aprobaron cinco repeticiones cada una.
- Las fixtures del portal hidratan su perfil autenticado antes de guardarlo para navegación. Así las pruebas de reloj miden una identidad/organización estable, en lugar de capturar un plazo mientras cambia el ámbito de caché. Los seis recorridos de Gestión aprobaron tres repeticiones cada uno.
- Una pasada de navegador coincidió con un reinicio del backend aislado y recibió ERR_EMPTY_RESPONSE en auth/me. La pasada de cierre mantiene servicios y código inmóviles; no se relajaron permisos ni se añadieron reintentos automáticos para ocultarlo.

## Contratos y responsabilidades

Prefijo administrativo: /api/v1/platform-admin/. Se conservan data y rutas anteriores; se añaden parámetros y rutas. El generador oficial y los tipos OpenAPI se actualizan juntos.

| Ruta | Contrato |
| --- | --- |
| GET beta/overview/ | Capacidad, reservas, invitaciones vigentes, verificaciones, organizaciones, atención, alcance y fecha |
| GET beta/ | page, search, status, delivery, attention y ordering; invitations, total exacto, page_size 25, has_next y configuración |
| POST beta/ | Acciones existentes más resend_verification y configure_feedback; motivo obligatorio |
| GET organizations/ | Filtros existentes más acceso, beta y orden; data arreglo y meta paginada |
| GET organizations/{id}/ | General, usuarios o historial según section; page; conteos y consumo permitido |
| GET organizations/{id}/resources/ | module permitido y page; items seguros, total, page_size 25 y has_next |
| PATCH organizations/{id}/contact/ | Contacto permitido y reason; auditoría antes/después |
| POST organizations/{id}/plan-preview/ | Plan/estado propuesto; límites efectivos, consumo y excesos; sólo lectura |
| POST organizations/{id}/trial-preview/ | Días 1–365; fechas y estado anterior/propuesto; sólo lectura |
| POST organizations/{id}/toggle-status/ | Acceso independiente de suscripción, transición compartida y sesiones invalidadas |
| GET users/ y users/{id}/ | Directorio filtrado y ficha acotada con modo, roles y permisos efectivos |
| GET health/ | Componentes, latencias, colas, alcance y fecha; no argumentos ni cuerpos de tareas |
| GET /api/v1/organizations/current/beta-feedback/ | Ruta autenticada del participante; sólo enlace público cuando procede |

Backend separa consulta beta, acceso de organización, registro de recursos, diagnósticos y vistas HTTP. Frontend conserva platformApi y su QueryClient separados del portal. Los DTO de las rutas nuevas tienen salida explícita; los tipos frontend beta se derivan de OpenAPI. No se añadieron dependencias.

Las consultas beta usan agregaciones, Exists/Subquery y carga acotada, sin consultar envíos por fila. La regresión del directorio limita el coste a seis consultas con más de una página. Recursos cuentan y paginan antes de serializar. Sólo los datos afectados se invalidan tras una acción; Auditoría global no se invalida para disparar eventos.

Salud reutiliza los probes existentes y comparte trabajo en curso dentro de cada proceso, con cinco hilos y espera máxima de 3,5 s. Redis utiliza timeouts de 1 s. El snapshot se cachea cinco segundos. Las colas high_priority, monitoring, background y celery incluyen los buckets de prioridad configurados y prefijo del broker. Son mensajes listos, no tareas ejecutándose o fallos históricos. Workers indica que al menos un worker respondió al ping existente; no es un inventario exhaustivo de procesos o consumidores por cola.

## Migración

Actualización posterior: [accounts.0011 ya se aplicó al entorno habitual para corregir el error 500 de Beta](MIGRATION_BETA_FEEDBACK_2026-11-09.md). El estado pendiente descrito abajo corresponde al cierre original de esta entrega.

accounts.0011_betacontrol_feedback_links añade feedback_submission_url y feedback_management_url con valor vacío. No modifica accesos, planes, clasificaciones ni roles existentes.

Se aplicó y comprobó únicamente en sentinel_audit. Una regresión de MigrationExecutor actualiza desde accounts.0010 y verifica cupos, admisiones, usuarios legacy y enlaces inicialmente vacíos; las pruebas restauran las hojas vigentes de migración.

La aplicación al entorno habitual es un paso separado. Antes de usar allí estas funciones, el operador debe aplicar esta migración con el procedimiento de respaldo habitual y reiniciar los procesos correspondientes a la revisión entregada. No se ejecutó en sentinel_db como parte de esta entrega. Se confirmó mediante showmigrations de sólo lectura que el entorno habitual tiene accounts.0010 aplicada y accounts.0011 pendiente. La aplicación previa de accounts.0010 conserva su informe independiente.

## Validación local

| Comprobación | Resultado |
| --- | --- |
| Django completo con PostgreSQL/Redis aislados | 378 aprobadas |
| Pruebas del agente sin red, filesystem de sólo lectura | 58 aprobadas |
| TypeScript y ESLint | Aprobados |
| Build Vite | Aprobado |
| Ruff y formato de Python modificado | Aprobados |
| Contrato generado oficialmente y comparación de referencia | Coinciden |
| Tipos OpenAPI reproducibles | Aprobados |
| Chromium general | 238 aprobadas en una pasada completa con dos workers; ocho casos aislados omitidos y aprobados aparte |
| Recorridos con API real | 8 casos distintos aprobados: cuatro administrativos, tres de portal/calidad y uno de incorporación beta |
| Regresiones específicas de consola con mocks | 16 aprobadas; incluidas en la ejecución general |
| Repeticiones dirigidas | Paleta 3/3; aislamiento 10/10; relojes de Gestión 18/18; sin sumarlas como casos distintos |
| Node: endpoint/guard y release gate | 10 + 2 aprobadas |
| Guard de archivos/secretos | Aprobado; no constituye auditoría de secretos históricos o DB |
| Migraciones pendientes por generar | Ninguna |

No se suman repeticiones como casos distintos. La ejecución general omite por diseño los ocho casos que requieren fixtures aisladas; éstos se ejecutan aparte.

Archivos de pruebas principales: platform-admin, platform-design, platform-shell, platform-beta, platform-real, platform-beta-real, quality-real y quality-session en frontend/e2e; organizations/tests_platform_beta_console.py y common/tests_quality_migrations.py en backend.

Ejecución reproducible: levantar docker-compose.audit.yml con proyecto aislado, montar backend actual, aplicar migraciones y preparar seed_platform_audit/seed_quality_audit. Vite usa VITE_API_URL=http://127.0.0.1:31800/api/v1 y puerto 31801. Chromium usa E2E_BASE_URL, E2E_API_URL y E2E_BROWSER_API_URL correspondientes, con E2E_FIXTURE_SUFFIX=superadmin-final-1108 para las fixtures de portal existentes. Los recorridos reales requieren PLATFORM_ISOLATED=1 y QUALITY_ISOLATED=1 según el archivo. En una DB aislada nueva, preparar además las cuentas de portal mediante SENTINEL_E2E_FIXTURE=1 y seed_e2e_accounts --suffix SUFIJO_NUEVO; usar ese mismo sufijo en E2E_FIXTURE_SUFFIX. El comando rechaza sobrescribir cuentas existentes. seed_platform_audit y seed_quality_audit rechazan una DB distinta de sentinel_audit o un backend de correo no simulado. Las fixtures conservan cooldowns y presupuestos de reenvío; para repetir con un presupuesto nuevo se utiliza otra base aislada, sin relajar los límites del producto. Esperar la finalización del seed antes de iniciar recorridos y mantener el código frontend inmóvil durante capturas evita interferencia de HMR.

## Capturas y comparación

Fixtures aisladas; no representan clientes ni cifras comerciales reales. Se capturaron las seis secciones y recursos en 1440×900, 1366×768 y 390×844. El documento y las superficies principales no desbordan horizontalmente. Las listas largas conservan scroll interno; una captura de viewport móvil no representa toda su longitud.

| Área | Escritorio | Móvil |
| --- | --- | --- |
| Resumen beta | [1366](assets/platform-beta-console/summary-1366.png) · [1440](assets/platform-beta-console/summary-1440.png) | [390](assets/platform-beta-console/summary-390.png) |
| Beta | [1366](assets/platform-beta-console/beta-1366.png) · [1440](assets/platform-beta-console/beta-1440.png) | [390](assets/platform-beta-console/beta-390.png) |
| Organizaciones | [1366](assets/platform-beta-console/organizations-1366.png) · [1440](assets/platform-beta-console/organizations-1440.png) | [390](assets/platform-beta-console/organizations-390.png) |
| Usuarios | [1366](assets/platform-beta-console/users-1366.png) · [1440](assets/platform-beta-console/users-1440.png) | [390](assets/platform-beta-console/users-390.png) |
| Salud | [1366](assets/platform-beta-console/health-1366.png) · [1440](assets/platform-beta-console/health-1440.png) | [390](assets/platform-beta-console/health-390.png) |
| Auditoría | [1366](assets/platform-beta-console/audit-1366.png) · [1440](assets/platform-beta-console/audit-1440.png) | [390](assets/platform-beta-console/audit-390.png) |
| Recursos de ficha | [1366](assets/platform-beta-console/resources-1366.png) · [1440](assets/platform-beta-console/resources-1440.png) | [390](assets/platform-beta-console/resources-390.png) |

Comparación del mismo viewport: [Resumen comercial anterior 1366](assets/platform-shell/redesign-summary-1366.png) → [Resumen beta 1366](assets/platform-beta-console/summary-1366.png); [Organizaciones anteriores 1366](assets/platform-shell/redesign-organizations-1366.png) → [Organizaciones actuales 1366](assets/platform-beta-console/organizations-1366.png). Los conjuntos de fixtures y métricas difieren; se compara jerarquía y presentación.

Se siguieron las referencias del plan: [acciones concretas y jerarquía de botones GOV.UK](https://design-system.service.gov.uk/components/button/), [barra y organización de tablas Carbon](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines) y [foco visible de WCAG](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html), conservando tokens y componentes Sentinel. No se afirma conformidad WCAG completa.

## Pendientes externos y límites

- Aplicar accounts.0011 en el entorno habitual, como paso independiente.
- Crear el formulario externo real y configurar sus URLs; los enlaces example.test pertenecen sólo a fixtures y no se copiaron al entorno habitual.
- Verificar SMTP del entorno destino. Locmem comprueba estados/flujo sin acreditar entrega real.
- Ejecutar CI remoto sobre la revisión concreta y realizar despliegue por separado.
- Sin cobros reales, tickets, proveedores de tickets, perfiles nuevos de operadores, eliminación definitiva ni impersonación.

No se enviaron correos reales, no se reclasificaron clientes existentes y no se cambió acceso de organizaciones reales. Las fixtures sólo afectan la base aislada.

Al cierre se detuvieron API, worker, PostgreSQL, Redis y Vite temporales del laboratorio. Se conservaron los volúmenes y las fixtures aisladas. Los servicios habituales no se reiniciaron ni detuvieron.
