# Suscripciones, onboarding y cobertura por protocolo

Validación local: 2026-10-03. No representa un despliegue productivo ni evidencia de CI.

Actualización 2026-10-05: el registro ahora requiere invitación beta y confirmación de correo antes de crear organización o entregar JWT. El grupo beta Free nuevo tiene 3 targets, 300 segundos y 3 días de telemetría; los usuarios existentes no cambiaron de cuotas ni se marcaron como verificados. Ver [flujo, transición y gates](BETA_EMAIL_VERIFICATION.md).

## Bloqueo operativo

`common.subscriptions` permite operaciones si la organización está activa y su suscripción es `active`, o si está `trialing` con una fecha de vencimiento futura. Una prueba sin fecha, vencida, `past_due`, cancelada o una organización suspendida no tiene habilitación operativa. La fecha se verifica en cada solicitud y ejecución, sin depender del job diario.

Monitoring (incluido el alias `monitoring-targets`), SSL, DNS, dominios, API Checks, Security Headers y registro de Sentinine rechazan altas, modificaciones, pruebas de conexión y escaneos manuales con HTTP 403 y `errors.code = SUBSCRIPTION_REQUIRED`. Los usuarios no administradores tampoco pueden mutar estos módulos. Se conserva la lectura del historial y la eliminación por administradores.

Los schedulers excluyen organizaciones sin habilitación. Las tareas ya encoladas vuelven a comprobarla antes de iniciar el trabajo; no se cancela una conexión que ya estaba en ejecución al vencer la prueba. Sentinine sigue reportando heartbeat, recibe una lista vacía de tareas y no puede ingresar nuevas mediciones. El agente aplica esa lista en su siguiente heartbeat.

La integración de pagos sigue pendiente. Los planes de pago, incluido Pro, requieren confirmación confiable o autorización del administrador de plataforma. El API público no acepta una afirmación de pago del cliente. Cambiar a Free no reactiva una prueba vencida. El banner y el selector de planes explican estas restricciones.

Después de confirmar el correo y obtener admisión, las cuentas nuevas comienzan en **Free activo y permanente**, sin prueba Pro automática y sin fecha de vencimiento. Antes de confirmar, no tienen organización ni sesión operativa. Pro se contrata desde Planes y no se concede durante el registro, aunque el cliente envíe un `plan_tier` diferente. Las pruebas configuradas explícitamente por administración siguen usando su fecha de vencimiento; no se extendieron ni se reactivaron las existentes. La migración `0006_free_registration_defaults` cambia defaults, no filas existentes.

La frecuencia mínima de Free es 300 segundos y la de Pro, 60 segundos. Monitoring y API Checks validan creación y edición; los defaults de creación se obtienen del plan. Los sondeos automáticos y manuales comparten `max(intervalo del recurso, mínimo del plan)`, incluso para recursos antiguos con un intervalo demasiado corto. SSL, DNS, WHOIS y cabeceras aplican como mínimo la frecuencia contratada a las solicitudes manuales y conservan su programación periódica existente.

`common.scan_limits` usa reservas persistentes `ScanLease` en PostgreSQL con bloqueo transaccional. Impide duplicados mientras un trabajo está pendiente y durante el intervalo posterior a su finalización; las tareas vuelven a validar la suscripción y la reserva antes de conectar. Una tarea en cola caduca tras 10 minutos; las tareas cloud tienen límite duro de 540 segundos para terminar antes de que caduque una reserva activa. Si el broker rechaza el envío, la reserva sin iniciar se libera. No se realizan los antiguos reintentos de Monitoring a los 5 segundos: una caída queda registrada y la siguiente comprobación respeta el intervalo.

Los `/scan/` admitidos siguen devolviendo 202; los anticipados devuelven 429, `Retry-After`, `errors.code = SCAN_COOLDOWN` o `SCAN_PENDING` y un mensaje de espera. Los masivos y seleccionados solo trabajan sobre la organización del solicitante y devuelven `queued_count`/`skipped_count`; los schedulers globales quedan reservados para Beat. Las pruebas en vivo también consumen un intervalo, compartido por organización entre rutas de diagnóstico para impedir eludirlo cambiando URL. Cambiar la dirección sugerida tras una redirección no elimina ese tiempo de espera.

Sentinine reserva cada asignación desde el heartbeat; no recibe otra hasta que termina o caduca la reserva. Solo se aceptan resultados de recursos habilitados asignados al agente autenticado y con una asignación pendiente, sin duplicados. Un sondeo privado no se ejecuta desde los botones cloud.

`Actualizar datos` únicamente consulta resultados guardados y muestra que no ejecutó una comprobación. No se muestran controles masivos de sondeo en las cabeceras. `Comprobar ahora` solo aparece en el detalle administrativo y respeta el cooldown individual del backend.

En los seis módulos de Conectividad, `En vivo` cuenta hasta la siguiente consulta de resultados: Free cada 300 segundos y Pro cada 60, según `limits.min_check_interval_seconds` del servidor. No representa una nueva medición ni acorta intervalos de recursos más lentos. Sin frecuencia válida, el polling queda deshabilitado y se ofrece consulta manual. El contador se reinicia al cambiar de frecuencia, pausar/reanudar o recargar. Dashboards y Gestión conservan sus intervalos propios.

## Onboarding

El dashboard abre el asistente para un administrador con suscripción habilitada y sin monitores. Ya no depende exclusivamente de una bandera global creada durante el registro. La preferencia de omitir/completar se guarda por ID de usuario en el navegador. Un Viewer no recibe un asistente para crear recursos, ni una cuenta vencida recibe una invitación a activarlos.

Las casillas de SSL, DNS y cabeceras envían `related_modules` en una sola creación de Monitoring. El frontend no crea recursos paralelos por su cuenta. Desmarcar una casilla se respeta en backend. La pantalla de confirmación permanece abierta hasta que el usuario termina; muestra una advertencia si el escaneo inicial no pudo encolarse, sin confundir registro con telemetría completada.

El asistente muestra el plan actual, recomienda 5 minutos para Free y 60 segundos para Pro, bloquea frecuencias no contratadas y ofrece `Ver planes` hacia la pestaña de facturación. No exige contratar para crear el primer monitor Free. Ya no promete completar el proceso en menos de 60 segundos.

## Cobertura predeterminada

| Monitor cloud | Recursos adicionales |
| --- | --- |
| HTTPS | SSL en el puerto indicado, DNS A si el host es un dominio, cabeceras sobre la URL completa |
| HTTP | DNS A si es un dominio y cabeceras; no SSL |
| TCP | Ninguno |
| DNS | DNS A; no SSL, WHOIS, API ni cabeceras |
| SSL | Certificado; no módulos adicionales |
| API | Ninguno: el monitor ya ejecuta el chequeo API |
| Sentinine | Ninguno en cloud, independientemente del protocolo |

El formulario de Monitoring explica la cobertura y permite desactivarla. `related_modules: []` desactiva todos los recursos adicionales. En la API, una selección incompatible con protocolo, host o ejecución privada se rechaza; las IP literales no generan DNS/WHOIS. WHOIS y un API Check adicional requieren selección explícita o creación en su propio módulo; no se infiere un dominio registrable a partir de un subdominio o sufijo público.

El aprovisionamiento es asíncrono, idempotente por recurso y organización, y verifica cuotas bajo bloqueo transaccional de la organización. Los fallos por módulo se registran y se devuelven en el resultado de la tarea; el monitor principal no se borra por un fallo parcial. No se borraron recursos históricos creados por el comportamiento anterior: sin procedencia explícita no es seguro atribuirlos a TCP y eliminarlos automáticamente.

## Evidencia

Actualización local 2026-10-05: Django **105/105**, Chromium **73/73** y TypeScript/Vite aprobados. Incluye seis regresiones Free con reloj virtual, Pro, cambio de plan, metadatos ausentes y recarga sin POST de scan. CI y producción pendientes. Las cifras siguientes conservan la evidencia histórica del 2026-10-03.

- Suite Django completa: 65/65 pruebas locales, incluidos los metadatos de disponibilidad de sondeo en los seis módulos.
- TypeScript y build Vite: aprobados.
- Playwright Chromium: 56/56 casos locales, incluidos onboarding Free/Pro y navegación a Planes, opt-outs, ausencia de altas paralelas, confirmación persistente, aviso de suscripción vencida y regresiones de sesión/redirección. La dirección sugerida se copia únicamente por acción del usuario y exige una nueva prueba explícita. Se verifica que recargar datos no lanza scans y que los límites se explican al usuario. La comprobación individual queda exclusivamente en el detalle administrativo y requiere disponibilidad GET vigente; los controles masivos se retiraron de la interfaz, no del backend.
- Verificación de la cuenta indicada: `past_due`, `monitoring_allowed = false`, creación rechazada con HTTP 403 mediante solicitud vacía sin crear recursos.
- Celery worker y Beat locales reiniciados para cargar las restricciones; producción permanece pendiente.

Al ejecutar las migraciones locales también se aplicó la migración pendiente `accounts.0006_hash_api_tokens`, que revoca y elimina tokens plaintext anteriores. Si existían tokens en uso deben regenerarse; no son recuperables mediante rollback de esa migración. Se comunicó este efecto durante la validación.
