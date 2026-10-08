# Bitácora de implementación

## 2026-10-07 — Consulta discreta y diagnósticos independientes

- Control común sin cuenta atrás permanente; siguiente consulta en tooltip y antigüedad de lectura separada de la última medición real. Se conserva el ciclo por área y la recarga manual sin reinicio.
- «Probar configuración» opcional en seis módulos y onboarding. Presupuesto independiente transaccional: 3/min por organización, Free 20/día, pago 100/día (techo operativo configurable), global 60/min y cuatro simultáneas, una por organización. No modifica cuotas comerciales, históricos ni intervalos de recursos guardados.
- Reutilización cifrada de resultados seguros durante 30 s con fecha explícita, aislamiento HMAC, caché opcional y presupuestos de BD obligatorios. Métodos HTTP potencialmente mutantes exigen confirmación, sin reutilización/reintentos automáticos. Preservados SSRF, suscripción y RBAC.
- Límites informativos sin bloquear guardar ni duplicar avisos. Retirada la petición inmediata del detalle de APIs; historial incorporado al ciclo compartido. Ajustado encabezado móvil de creación de targets para evitar texto estrecho.
- Gates locales: **171/171 Django**, **136/136 Chromium**, TypeScript/Vite y validación Compose. Quince regresiones backend y diez UI nuevas. Un fallo intermitente de carga de ficha móvil en una ejecución anterior pasó aislado y en la repetición completa. Capturas móviles revisadas; fixtures retirados, auditoría conservada.
- Sin migraciones, dependencias nuevas, cambios de cuentas reales, commit, push o despliegue. Flake8 no disponible en el contenedor; auditorías de dependencias no repetidas. CI remoto, producción y pendientes externos continúan pendientes.

## 2026-10-07 — Política de consulta profesional por área

- Conectividad comparte ciclo contractual backend entre dashboard, seis módulos y ficha de endpoint: Free 300 s / Pro 60 s. Gestión comparte 30 s entre resumen y seis módulos; corregido también el antiguo intervalo de 20 s de Notificaciones. Sistema conserva consultas iniciales/manuales, sin polling periódico.
- Eliminada la capacidad de reiniciar el reloj mediante recarga manual. Control común `Actualización automática`, pausa persistente por usuario/tenant/área y consultas limitadas a fuentes activas; pestaña oculta sin polling ni ráfagas al regresar.
- Metadatos operativos incompletos o fallidos detienen lectura automática. Un fallo temporal del GET de suscripción conserva la cadencia conocida y el plazo; recuperación mediante recarga, sin ejecutar sondeos. Fecha de consulta separada de última señal real.
- Configuración editable de Status Page excluida del refresco automático/general para no sobrescribir borradores. Usuarios, auditoría y plataforma usan claves de consulta particionadas por organización.
- Quince regresiones Chromium nuevas: recarga exitosa/fallida Free/Pro, fallo/recuperación del plan, seis módulos de Gestión, Sistema, pestaña oculta y permiso operativo ausente. Se mantienen tests backend de cooldown, reservas, permisos, concurrencia, 202/429 y GET sin mutaciones.
- Gates locales: **156/156 Django**, **126/126 Chromium**, TypeScript/build aprobado. Capturas desktop/móvil revisadas y fixtures aislados retirados, auditoría conservada. No se hicieron migraciones, dependencias nuevas, commit, push ni despliegue. CI remoto, producción y pendientes externos permanecen pendientes.
- Esta política sustituye la variante anterior por ruta y el reinicio manual del ciclo; la entrada siguiente conserva la evidencia histórica.

## 2026-10-07 — Contador En vivo persistente y sincronizado

- Corregido el reinicio al desmontar módulos: próxima consulta y pausa conservadas por usuario, tenant y ruta en almacenamiento de sesión de la pestaña.
- Sustituidos temporizadores de polling independientes por un reloj compartido con el contador, limitado a consultas activas registradas por la pantalla. Se saltan ciclos ausentes sin ráfagas y se evitan consultas automáticas en pestaña oculta.
- Conectividad toma Free 300 s / Pro 60 s del backend y revalida suscripción en el mismo ciclo. `scan_availability`, reservas y cooldown de cada recurso siguen siendo autoridad del backend; GET no ejecuta sondeos ni renueva tiempos de espera.
- Doce pruebas Chromium nuevas: seis módulos al navegar/recargar, Pro en deadline conservado, pausa, suscripción no vigente, cambio de plan automático, ciclos ausentes e aislamiento entre usuarios. Una regresión Django nueva verifica GET repetidos sin cambiar deadline/medición/reservas para Free, Pro e intervalo más lento.
- Gates locales aprobados: **156/156 Django**, **111/111 Chromium**, TypeScript/build. Fixtures aislados retirados y auditoría conservada; sin commit, push o despliegue. CI remoto y pendientes externos siguen pendientes.

## 2026-10-07 — Superficies grafito uniformes

- Centralizados paneles `#101820`, hover `#16202B`, bordes/rejilla `#263340` y bordes destacados `#405060`; fondo general y textos claros preservados.
- Eliminadas superficies antiguas directas en Status Page, tooltips, SVG y estilos de tablas. Paneles sólidos en Conectividad, Gestión, Sistema, autenticación y portales; franjas compactas mantienen gradiente discreto.
- Dona y KPI usan una única regla semántica de salud, sin modificar mediciones, conteos ni filtros.
- Gates locales: TypeScript/build aprobado, Django **155/155**, Chromium **99/99**; revisión de capturas desktop 1440×900 y móvil 390×844. No se repitieron auditorías de dependencias en este cambio visual.
- Sin cambios backend, contratos, migraciones o dependencias; sin commit, push ni despliegue. CI remoto y pendientes externos permanecen pendientes.

## 2026-10-07 — Seguimiento de pendientes de auditoría

- Aplicada exclusión tenant-aware de muestras de mantenimiento en reportes SLA/live, disponibilidad y resumen; servicios lentos cuentan como disponibles sin perder estado degradado. Historial público agregado por día/target en SQL, zona horaria activa, consultas constantes y sin muestras futuras.
- Correo con cero mensajes aceptados queda fallido; concurrencia de dos conexiones PostgreSQL entrega una vez. Correlación automática de incidentes ya no agrupa endpoints distintos. Ciclo caída/alerta/incidente/aviso/recuperación probado con locmem, no proveedor externo.
- **155/155 Django, 91/91 Chromium, TypeScript/build, check y ausencia de migraciones aprobados**. Workers locales reiniciados y smoke final de broker repetido. pip-audit sin vulnerabilidades conocidas; Trivy fs sin High/Critical en lockfile frontend. Baseline local k6: 529 solicitudes, 0 errores, p95 28,79 ms, hasta 5 VUs; no certifica capacidad de sondeos.
- Fixtures retirados, auditoría preservada. Sin producción, logs ampliados, commit/push ni CI. [Estado vigente y pendientes externos](BETA_VALIDATION_FOLLOWUP.md).

## 2026-10-07 — Auditoría integral local y correcciones beta

- Endurecidos permisos de Gestión y validación de referencias entre organizaciones. Lectores no reciben secretos de canales ni payloads de API; diagnóstico de canal sujeto a suscripción y restricciones beta. SMTP configurable con TLS, validación de destinos y conexión fijada a IP; entrega con bloqueo de fila.
- Status Page sin creación/publicación en GET, selección vacía sin publicar y ausencia de mediciones explícita. Reportes sin uptime/MTTD ficticios, rangos acotados, descarga HTML autenticada por cabecera y contenido escapado; CSV neutraliza fórmulas. DNS no registra cambios por reordenamiento.
- Gates locales: **148/148 Django**, **91/91 Chromium**, TypeScript/build, check Django, ausencia de migraciones nuevas y Compose local válido. Smoke real de reporte y HTTPS por broker/worker. Fixtures retirados, auditoría conservada. npm High aprobado con dos avisos Moderate; pip-audit ausente.
- No se aprueba beta/producción ni se amplían logs. Se registran pendientes de SLA/mantenimiento, capacidad, integraciones, dependencias y CI en [el informe de auditoría](BETA_MODULE_AUDIT.md).

## 2026-10-06 — Capas del tooltip de la dona

- Tooltip de salud con capa explícita por encima del botón central y fondo opaco. El porcentaje central no atraviesa el tooltip; la ventana no intercepta eventos del puntero y conserva filtros/restablecimiento.
- Ampliada la prueba de gráficos existente: hover del segmento, fondo opaco, orden real de capas donde se cruza con el centro, filtros y capturas desktop/móvil. Sin aumento del conteo.
- Gates locales: Django **120/120**, Chromium **87/87** y TypeScript/build Vite aprobados. Fixtures aislados retirados conservando auditoría. CI y producción pendientes; sin cambios backend ni frecuencia de sondeo.

## 2026-10-06 — Tooltip único en rendimiento global

- Las tres franjas mantienen el cursor temporal sincronizado, pero solo la franja con puntero o foco de teclado muestra el contenido del tooltip. Al salir o perder foco se oculta, sin desactivar los indicadores sincronizados ni cambiar mediciones.
- Ampliada la regresión existente para recorrer latencia, disponibilidad y volumen: exactamente un tooltip en la franja activa, tres indicadores temporales, ausencia de tooltip al salir y foco/ArrowRight de teclado. Captura local del resultado y regresiones desktop/móvil conservadas.
- Revalidación local: Django **120/120**, Playwright Chromium **87/87** y TypeScript/build Vite aprobados. Fixtures aislados retirados conservando auditoría; CI y producción pendientes. Sin cambios backend, migraciones o frecuencia de sondeo; flake8 no se repitió.

## 2026-10-06 — Rangos largos y gráficos de estado

- Reproducido el bug de 24 h con 25 buckets y horas repetidas: cero puntos renderizados pese a tener mediciones. El eje categórico se sustituyó por coordenadas de timestamp completas en los tres paneles, con dominio compartido y ticks explícitos. Regresión de 1 h / 6 h / 24 h / 7 d con series dispersas, barras y etiquetas visibles. Se conservan huecos sin datos y se informa la cantidad de intervalos medidos.
- Dona con cuatro controles permanentes, conteos, porcentajes, texto auxiliar de 12 px y porcentaje saludable en el centro. Estados vacíos sin recurso ficticio y consultas parciales sin score global ni filtros engañosos. Barras por módulo segmentadas por salud real; errores, carga, ausencia de recursos y falta de medición diferenciados. Filtros por teclado y atributos accesibles conservados.
- Gates locales: Django **120/120**, Playwright Chromium **87/87**, TypeScript/build Vite y revisión visual 1440×900 / 390×844 aprobados. Tres regresiones UI nuevas; corregidos selectores para las etiquetas SVG de Recharts, evitando aserciones vacías. No cambia el sondeo, planes, endpoints, permisos o base de datos. Fixtures aislados retirados, auditoría preservada; CI y producción pendientes. Sin nueva ejecución de flake8.

## 2026-10-06 — Rendimiento global legible y telemetría coherente

- Sustituida la superposición de dos áreas y ejes por tres franjas alineadas: latencia, disponibilidad y comprobaciones/minuto. Tooltip compartido, fecha completa, referencias fuera de las curvas, tipografía auxiliar de 12 px y etiquetas sin recortes en desktop/móvil. Se mantienen períodos y controles del dashboard.
- Corregida la discrepancia backend/frontend: puntos con `checks` y `checks_per_minute`, promedio del período y alias `requests` conservado. Tasas con duración observada de buckets parciales; latencia/disponibilidad nulas en intervalos sin mediciones, sin 100% artificial ni arrastre de valores. Checks futuros excluidos y cache versionada para no servir el contrato anterior. Sin migración ni nuevos sondeos.
- Gates locales: Django **120/120**, Chromium **84/84** y TypeScript/Vite aprobados. Tres regresiones backend nuevas y dos flujos UI; alineación temporal verificada también después del ajuste final. Revisión visual desktop/móvil y primer viewport del dashboard preservado. Fixtures aislados retirados, auditoría preservada; CI y producción pendientes. No se repitió flake8.

## 2026-10-05 — Ficha integral HTTP/HTTPS

- Nueva página `/monitoring/:targetId` desde el drawer de Monitoring: resumen, disponibilidad/rendimiento, SSL/TLS, DNS, dominio/WHOIS, seguridad web, actividad y configuración. Mantiene filtros al volver, navegación por tabs, paleta compartida y adaptación desktop/móvil.
- Modelo `TargetCoverage`, migración aditiva `0006` aplicada localmente y GET/PATCH de cobertura tenant-aware. Recursos anteriores requieren confirmación; aprovisionamiento registra solo recursos utilizados y compatibles. WHOIS siempre se selecciona explícitamente. GET no crea recursos, reservas ni tareas; hostname/puerto/URL exactos y asociaciones invalidadas al cambiar el endpoint. Consulta por lote sin crecimiento por registro DNS.
- Viewer de lectura; administradores conservan habilitación por suscripción y disponibilidad de cada sondeo. Lecturas Free 300 s/Pro 60 s, recarga sin POST, comprobación 202 con estado pendiente y resultado posterior. Datos ausentes no son cero ni saludables; cada fuente conserva su timestamp.
- Gates locales: Django **117/117**, Playwright Chromium **82/82** y TypeScript/Vite aprobados. Doce regresiones nuevas backend y seis de interfaz; detalle en [ficha integral](ENDPOINT_DOSSIER.md). Se corrigió el cierre de conexiones de los hilos de pruebas concurrentes para permitir eliminar la base de prueba. Revisión visual 1440×900 y 390×844; fixtures aislados retirados y auditoría preservada. Worker local recargado. CI y producción pendientes.

## 2026-10-05 — Paleta compartida y textos más blancos

- Tras aprobar el piloto, la paleta se comparte desde `:root` entre Conectividad, Gestión, Sistema, navegación y formularios/drawers renderizados en portales. Se conserva el fondo oscuro; paneles y franjas usan superficies y bordes consistentes. Sin nuevas dependencias ni cambios de contratos, permisos o cadencia.
- Textos principales blancos; secundarios `#E2E8F0` y auxiliares `#CBD5E1`, en lugar de grises azulados oscuros. Se aclaran placeholders y clases neutras anteriores sin eliminar los estados deshabilitados. Controles de fondo vivo conservan texto oscuro para contraste.
- Gráficas de Conectividad y Gestión alineadas con cyan, emerald, verde Online, ámbar, coral y violeta. Ejes/leyendas más claros y etiquetas de rendimiento de al menos 12 px.
- Gates locales: Django 105/105, Chromium 76/76 y TypeScript/Vite aprobados. Regresión de estilos renderizados en 17 rutas, herencia de tokens en portales y revisión visual 1440×900 y 390×844. Continúan aprobadas las regresiones Free/Pro, Viewer, cooldown y GET sin sondeos. Fixtures aislados retirados; cuenta piloto y auditoría preservadas. CI y producción pendientes.

## 2026-10-05 — Piloto de paleta viva en Monitoring

- Uptime & Latencia conserva el fondo oscuro con superficies azuladas más definidas, texto secundario más claro y selección visible en la franja de estados. Marca emerald, Online verde, latencia cyan, advertencias ámbar y caídas coral; los estados conservan etiquetas e iconos, no dependen solo del color.
- Tokens CSS limitados a `monitoring-workspace`, incluidos tabla, cuadrícula y detalle. Tailwind conserva los colores originales como fallback para los demás módulos. Curva, leyenda y promedio de latencia usan el mismo cyan; ejes de la gráfica legibles a 12 px. Sin dependencias, cambios backend, intervalos ni permisos.
- Reiniciado únicamente el frontend local para cargar la configuración Tailwind. Revisión visual de 1440×900 y 390×844; contraste del texto secundario renderizado en tabla superior a 4.5:1 en el fixture. No se declara conformidad global de accesibilidad.
- Gates locales: Django 105/105, Chromium 75/75 y TypeScript/Vite aprobados. Pruebas nuevas cubren separación marca/Online, alcance del tema, tabla/cuadrícula/drawer, filtros móviles y ausencia de overflow de página. Cuentas aisladas de prueba, sin modificar la cuenta piloto; CI, extensión de paleta a otros módulos y producción pendientes.

## 2026-10-05 — Recarga de Conectividad alineada con el plan

- Se eliminaron los 15 segundos fijos de los seis módulos de Conectividad. El intervalo de lectura procede de `limits.min_check_interval_seconds` de la organización: Free 300 s, Pro 60 s, otros planes según su configuración real. Metadatos ausentes o consulta fallida deshabilitan el polling automático.
- El contador utiliza tiempo transcurrido real y se reinicia al cambiar el plan o recargar datos. Dashboards y Gestión conservan su configuración propia; no se cambia la programación de recursos ni su política backend.
- La recarga manual informa que solo consultó resultados guardados, sin ejecutar una comprobación. `Comprobar ahora` sigue exclusivamente en el detalle, condicionado a `scan_availability` y al 429 backend; recursos más lentos mantienen su intervalo.
- Reloj virtual comprueba que los seis módulos Free no consultan a los 15 segundos y sí a los 300, sin POST de scan; también cubre Pro, cambio de plan y metadatos ausentes. Validación local: Django 105/105, Chromium 73/73 y TypeScript/Vite aprobados. Cuenta piloto preservada; CI y producción pendientes.

## 2026-10-05 — Corrección de confirmación de correo y pantalla de verificación

- Corregido el HTTP 400 previo a verificar el desafío: el frontend enviaba `turnstile_token` vacío y el serializer opcional rechazaba el valor. La confirmación envía solo su token; el backend acepta el campo opcional vacío sin omitir el captcha obligatorio de registro/reenvío.
- La pantalla distingue correo en cola, aceptación SMTP, fallo, expiración y envío desconocido. Iniciar sesión con una cuenta pendiente no promete un nuevo envío. La espera del reenvío procede del backend; las consultas de outbox están acotadas y se detienen al recibir aceptación.
- Rediseño de verificación con progreso de cuenta, identidad Sentinel/GCTechOps, mensajes accionables, recuperación de enlaces incompletos/reemplazados, foco visible y layout desktop/móvil. El fragmento secreto se retira conservando el estado de navegación y no se guarda como token de verificación en almacenamiento persistente.
- Validación local: Django 105/105, Chromium 65/65 y build TypeScript/Vite aprobados. Las pruebas comprueban el cuerpo real del POST, ausencia de captcha vacío en confirmación, captcha obligatorio para reenvío, cooldown, recuperación y ausencia de overflow móvil. Revisión visual 1440×900 y 390×844. Flake8 no está instalado en el contenedor reconstruido; no se declara ese gate aprobado en esta ejecución.
- SMTP Gmail probado con un correo cuya recepción confirmó el usuario; invitación piloto enviada por Celery con aceptación SMTP. La cuenta piloto no se activa desde consola: debe confirmar el último enlace válido. CI y producción pendientes.

## 2026-10-05 — Beta privada y correo confirmado

- Registro por invitación, sin organización/JWT hasta confirmar correo. Desafíos e invitaciones beta con hash, outbox cifrado, reintentos limitados y estados reales de aceptación SMTP.
- Panel de beta exclusivo de superadministración, 20 cupos iniciales, acciones auditadas y apertura bloqueada en producción sin configuración válida. Admisiones cerradas por defecto.
- Gate de identidad en login/2FA/refresh/JWT/API tokens y elegibilidad beta en tareas y Sentinine. Eliminada asignación de la primera organización a usuarios huérfanos; invitaciones de integrantes no restablecen ni transfieren cuentas existentes.
- Nuevos Free beta: 3 monitores, 5 minutos y 3 días de telemetría. Cuotas de altas concurrentes bajo bloqueo, presupuestos persistentes para recreación/diagnóstico/sondeos/notificación y límite global provisional de cola.
- Turnstile server-side, lista temporal versionada con reemplazo atómico, cambio de correo reautenticado con revocación de sesiones y transición explícita sin alterar usuarios/contratos anteriores.
- Pantallas de invitación, confirmación, reenvío, error de correo y beta cerrada. Se corrigió pérdida de token por inicialización doble de React; los enlaces se limpian tras montar y no activan mediante GET.
- Migraciones locales `organizations.0007` y `accounts.0007–0009` aplicadas. Auditoría de rollout de solo lectura: ninguna colisión canónica detectada; ninguna cuenta existente se marcó como verificada.
- Gates locales: Django 102/102, Chromium 60/60, TypeScript/Vite, flake8 crítico, Compose válido y migraciones completas. Pruebas HTTP/UI aisladas no equivalen a correo/Turnstile reales.
- Pendiente: proveedor SMTP, dominio/remitente autenticado y claves Turnstile, prueba de entrega real, carga y CI. Producción fuera de esta fase. **Retención/almacenamiento de logs pendiente para la siguiente fase**, sin modificar infraestructura ni política de auditoría.
- Detalle operativo: [Beta y correo](BETA_EMAIL_VERIFICATION.md).

## 2026-10-03 — Franjas homologadas en toda Conectividad

- SSL, DNS, dominios WHOIS, API Checks y Security Headers adoptan el estilo compacto de Monitoring: fondo sutil, iconos vectoriales, contadores tabulares y colores semánticos según sus estados existentes.
- Se conservan las tablas restauradas, filtros y acciones de cada módulo. Los textos largos se distribuyen en dos columnas móviles sin ampliar la página; no se introducen tarjetas KPI grandes ni nuevas consultas.
- Validación local: build TypeScript/Vite, Django 65/65 y Chromium 56/56. Repetición adicional de los cinco casos móviles de los módulos modificados: 5/5; revisión visual SSL móvil. CI pendiente, sin despliegue a producción.

## 2026-10-03 — Estilo de la franja de estados de Monitoring

- Targets, Online, Lentos, Caídos y Pausados usan una barra compacta con iconos vectoriales, fondo sutil, contadores tabulares y color semántico. El filtro activo tiene borde destacado y se puede seleccionar por teclado.
- Se mantienen las tablas restauradas, fuentes de datos y controles de sondeo existentes; el cambio no introduce nuevas tarjetas KPI ni altera otros módulos.
- Revisión visual desktop 1440×900 y móvil 390×844; sin desbordamiento horizontal. Build TypeScript/Vite, Django 65/65 y Chromium 56/56 aprobados localmente, incluida la selección de filtros por teclado. CI pendiente; sin despliegue a producción.

## 2026-10-03 — Restauración visual de tablas de Conectividad

- Por solicitud del usuario se recuperan las tablas anteriores de Uptime & Latencia, SSL, DNS, dominios WHOIS, API Checks y Security Headers, con columnas e indicadores específicos. Gestión y los dashboards por área no se revierten.
- Se conservan los resúmenes pequeños, preferencias Lista/Cuadrícula, filtros, selección, drawers y permisos. Los scans permanecen únicamente en el detalle administrativo, sujetos a disponibilidad y límites del backend; no se restauran los botones de sondeo en filas.
- Las tablas contienen su scroll horizontal en móvil e incorporan encabezados con alcance de columna y apertura del detalle mediante teclado. Los datos ausentes no se presentan como sanos.
- Validación local posterior a la restauración: Django 65/65, Chromium 56/56, TypeScript/Vite y `git diff --check` aprobados. Revisión visual de Monitoring desktop y móvil. CI pendiente; sin despliegue a producción.

## 2026-10-03 — Dashboards por área y módulos compactos

- `/dashboard` conserva la ruta y pasa a Centro de Conectividad; `/gestion` añade resumen de Gestión, gráficas navegables, pendientes deduplicados, agenda y enlaces a seis módulos. Sistema no se reorganiza.
- Doce módulos adoptan franjas compactas y listas por defecto, conservando preferencias de cuadrícula, filtros, selección, exportación y configuración. Se retiran los controles de sondeo masivo de la UI.
- Los seis GET de recursos incorporan `scan_availability` sin crear reservas ni exponer secretos; carga por lote, aislamiento organizacional y siete estados con precedencia explícita. La recarga es GET y la comprobación individual queda en el detalle administrativo, deshabilitada ante metadatos ausentes.
- Se añadieron foco de drawer, navegación por URL, ayudas de al menos 12 px y filas móviles sin overflow. El refresco conserva filtros, selección y detalle abierto; no reinicia el borrador RCA al recibir mediciones nuevas del mismo incidente.
- Gates locales: Django 65/65, Chromium 56/56 y build TypeScript/Vite. `makemigrations --check --dry-run` no detecta cambios. La suite de navegador utiliza cuentas aisladas y fixtures de telemetría; incluye revisión desktop 1440×900 y móvil 390×844.
- Sin nuevas dependencias, endpoints ni migraciones. CI pendiente; no se desplegó a producción.

## 2026-10-03 — Frecuencia estricta de sondeos por plan

- Se cerró la brecha de scans manuales: reservas atómicas PostgreSQL compartidas por API, tareas directas, Beat y Sentinine; Free 300 s / Pro 60 s, respetando intervalos configurados más lentos. Se controla el trabajo pendiente, la entrega duplicada y la siguiente ventana después de completar el sondeo.
- Los masivos y seleccionados solo admiten recursos de la organización solicitante y reportan encolados/omitidos. Los diagnósticos en vivo también tienen un presupuesto temporal por organización, aunque se cambie la URL.
- Se retiraron los reintentos de Monitoring a los 5 s, incompatibles con la política estricta. Las seis tareas cloud quedan limitadas a 540 s y una reserva pendiente caduca tras 10 min.
- Sentinine no recibe asignaciones simultáneas duplicadas y solo acepta resultados pendientes de recursos propios habilitados y asignados al agente correcto.
- La UI separa `Actualizar datos` de `Comprobar disponibles`, muestra el motivo de espera y deja de afirmar `2 checks/min` por cada target. La frecuencia presentada es una estimación de configuración, no telemetría de ejecuciones.
- Migración local aplicada: únicamente `common.0001_initial`, sin revocar tokens ni modificar planes. Worker y Beat locales reiniciados. Gates locales: Django 59/59 (incluida concurrencia PostgreSQL real), Chromium 21/21 y build TypeScript/Vite. Producción y CI continúan pendientes.

## 2026-10-03 — Redirecciones explicadas al usuario

- Onboarding y Monitoring usan el aviso compartido «Esta página te envía a otra dirección», sin exigir conocimiento de HTTP. El código se muestra en detalles técnicos desplegables.
- «Usar esta dirección» copia una URL HTTP(S) válida al formulario y borra el resultado anterior. No visita Location, no ejecuta un test automático ni declara saludable el destino; la siguiente prueba o alta conserva la validación SSRF del backend.
- Evidencia local: build TypeScript/Vite, Django 49/49 y Chromium 20/20 aprobados. Se verificó el flujo de copiar y probar explícitamente, además de la presentación desktop/móvil. CI y producción siguen pendientes.

## 2026-10-03 — Sesión, diagnóstico HTTP y legibilidad

- El cliente comparte una única renovación JWT entre peticiones concurrentes. Sin refresh válido limpia la sesión persistida y solicita login; un fallo temporal de red/servidor no revoca credenciales. Login/registro/2FA no envían Bearer obsoleto ni disparan renovación por credenciales incorrectas.
- La rotación actualiza también Zustand; una respuesta de renovación de una sesión anterior se descarta. Un refresh sin token rotado conserva el anterior en vez de guardar `undefined`.
- Onboarding y diagnóstico de Monitoring identifican redirecciones y muestran Location como texto, sin seguirlo ni declararlo saludable. Cambiar la URL borra el resultado anterior del onboarding.
- Se retiraron emojis de Cloud/Sentinine, conservando los iconos vectoriales existentes, y la afirmación de multi-región sin evidencia. Formularios con ayudas de al menos 12 px, mayor contraste y sin escala animada en el modal de target; se evita sintetizar pesos tipográficos y se mantiene la fuente común.
- Evidencia local: Django 49/49, Chromium 19/19 y build TypeScript/Vite aprobados; revisión visual del onboarding desktop/móvil y prueba adicional móvil sin desbordamiento. No se modificaron planes ni se desplegó a producción. CI sigue pendiente.

## 2026-10-03 — Registro Free y onboarding por plan

- Las cuentas nuevas empiezan en Free activo, sin trial Pro automático ni vencimiento. Pro sigue requiriendo contratación y confirmación desde Planes.
- La migración de defaults no modifica planes existentes ni reactiva suscripciones vencidas.
- Monitoring y API Checks usan la frecuencia mínima del plan al omitir el intervalo y rechazan valores menores; se corrigió la validación que buscaba `interval_seconds` en lugar de `check_interval`.
- Los schedulers ahora respetan los intervalos del recurso y el mínimo contratado, en vez de escanear todos los targets cada minuto. Sentinine recibe únicamente los recursos cuyo sondeo corresponde.
- Onboarding identifica el plan real, recomienda Free 5 min / Pro 60 s, bloquea frecuencias superiores no contratadas y enlaza a Planes. Se retiró la promesa de menos de 60 segundos.
- Evidencia local: 48/48 Django, 12/12 Chromium y build TypeScript/Vite aprobados. Producción continúa pendiente.
- Al aplicar migraciones locales también se aplicó la migración pendiente de hash de API tokens: los tokens anteriores deben regenerarse si estaban en uso. Este efecto fue comunicado al usuario.

## 2026-10-03 — Suscripción, onboarding y cobertura

- Se centralizó la habilitación operativa y se bloquean altas, cambios, tests y scans con prueba vencida, incluso antes de ejecutar el job diario.
- Celery y Sentinine verifican la suscripción al ejecutar/asignar tareas; la lectura histórica y el heartbeat permanecen disponibles.
- Pro también exige pago verificado; la interfaz explica que los pagos en línea siguen pendientes y no presenta un plan vencido como activo.
- Se corrigió la asignación de 14 días de prueba a organizaciones nuevas con UUID preasignado, sin renovar pruebas existentes.
- Se recuperó el onboarding para administradores sin monitores, con preferencia por usuario, casillas funcionales y confirmación visible.
- El backend es el único propietario del aprovisionamiento por protocolo, respetando opt-outs, ejecución privada, cuotas e idempotencia. TCP no genera recursos adicionales; WHOIS/API no se crean sin selección explícita.
- Gates locales: 43/43 pruebas Django, build TypeScript/Vite y 11/11 pruebas Chromium. Sin despliegue a producción ni eliminación de recursos previos.
- Política y detalles: [Suscripciones, onboarding y cobertura](SUBSCRIPTIONS_ONBOARDING.md).

## 2026-10-03 — Densidad visual y tipografía

- Cabecera del dashboard compacta con selector de período visible y control de auto-refresh accesible.
- Avisos de suscripción y 2FA reducidos; cuatro KPIs agrupados en una franja de resumen.
- Fuente principal unificada en Plus Jakarta Sans y cifras de KPI con números tabulares.
- KPIs compartidos y cabeceras de módulo compactados; Monitoring usa filtros sin contenedor adicional y tarjetas más ligeras.
- Menú móvil contraído de forma automática, sin modificar la preferencia de escritorio.
- Build frontend aprobado y 9/9 pruebas Chromium locales; la comprobación de 1440×900 valida ambas gráficas completas en el primer viewport con avisos visibles. La prueba móvil verifica ausencia de desbordamiento horizontal.

## 2026-10-03 — Dashboard NOC Fase 1

- Se redujo la cabecera operativa a cuatro KPIs: salud actual, disponibilidad, latencia y atención.
- La gráfica global diferencia uptime, latencia y volumen, con umbrales visuales, tooltip unificado, skeleton y recuperación parcial.
- La dona y ocho tarjetas de módulo funcionan como filtros combinables mediante chips removibles.
- La tabla crítica y la lista separada de alertas fueron sustituidas por una bandeja de tarjetas normalizada para nueve tipos de recurso.
- Las alertas vinculadas se agrupan dentro del incidente y los elementos se ordenan por severidad y antigüedad/urgencia.
- El drawer unificado cubre Monitoring, API, SSL, dominio, DNS, seguridad, alertas, incidentes y Sentinine.
- Solo administradores reciben re-escaneo y reconocimiento de alertas; Viewer no recibe mutaciones.
- Actividad combina operación, alertas, incidentes y auditoría; agentes y auditoría participan del auto-refresh de 30 segundos.
- Playwright Chromium aprobó 8/8 flujos locales, incluidos filtros, drawer, acciones administrativas, Viewer, fallo parcial y viewport móvil.

## 2026-10-03 — Hardening integral

- Beat usa `ssl_monitor.scan_all`, `dns.scan_all` y `domain.scan_all`; una prueba valida todo el schedule.
- `TRUSTED_PROXY_CIDRS` limita XFF al gateway productivo `172.30.0.10`.
- `common.safe_http` centraliza HTTP saliente, bloquea destinos no globales, fija la conexión a una IP validada contra DNS rebinding y no sigue redirects.
- Se retiraron reescrituras localhost y autologin Basic→JWT.
- Se añadió `quarantine_unsafe_targets`; el dry-run local detectó 8 recursos y no modificó datos.
- API tokens migran de plaintext a SHA-256/prefijo; secretos antiguos se revocan.
- “Cerrar otras sesiones” conserva el refresh actual y falla cerrado.
- Los scans individuales devuelven 202; la UI espera un timestamp posterior hasta 30 segundos.
- `purge_telemetry` elimina solo históricos por política de organización.
- La topología productiva usa Nginx TLS, frontend propio, imágenes GHCR y corte controlado.
- Grafana Alloy sustituye referencias y despliegues de Promtail.
- CI ejecuta suite Django completa, build, auditorías estrictas, Trivy, Compose, builds, Nginx y Playwright.

## Evidencia local

- `manage.py check`: aprobado.
- `makemigrations --check --dry-run`: sin cambios.
- Frontend `npm run build`: aprobado.
- Playwright Chromium: 8/8 flujos críticos aprobados localmente; el gate permanece pendiente hasta CI.
- Suite Django completa: 31/31 pruebas aprobadas, incluida la ejecución directa de schedules SSL, DNS y WHOIS.
- Backend actualizado a Django 5.2.17; `pip-audit` local no reporta vulnerabilidades conocidas.
- `npm audit --omit=dev --audit-level=high` aprueba; conserva 2 avisos Moderate de React Router cuya corrección exige migrar a v7.
- Compose desarrollo y producción: configuración válida.
- Imágenes productivas de backend y frontend: build local aprobado; `nginx -t` aprobado.
- Alloy: configuración cargada, etiquetas `service`, `container` y `environment` visibles en Loki; posiciones persistidas y reutilizadas tras reinicio.
- Cuarentena: 8 hallazgos en dry-run, cero cambios.

Los resultados k6 anteriores se conservan como históricos en [tests_perf/README.md](../tests_perf/README.md).
