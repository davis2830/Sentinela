# Beta privada y verificación de correo

Implementación local del 5 de octubre de 2026. Producción y la infraestructura/retención de logs permanecen fuera de esta fase. Se conserva la auditoría de seguridad y administración.

## Flujo y acceso

La beta empieza **cerrada**, con 20 cupos configurables desde el panel de administración de plataforma. Solo un superadministrador puede abrir admisiones, invitar un correo concreto, reenviar/revocar invitaciones, rechazar registros y suspender/reactivar organizaciones. Cada acción exige motivo y genera auditoría.

Invitación por correo → registro → confirmación explícita del correo → login → onboarding. Las invitaciones reservan cupo durante siete días; las organizaciones activas o suspendidas conservan su cupo. Cerrar admisiones no detiene organizaciones activas. Reducir capacidad por debajo de reservas vigentes se rechaza.

El registro devuelve **202 y una sesión limitada**, nunca JWT ni organización. Esa sesión solo permite consultar estado y solicitar reenvío. Un login con contraseña válida de una cuenta pendiente redirige a la misma pantalla; tampoco entrega JWT. El enlace de verificación vence en 30 minutos, es de un solo uso y solo un POST lo consume. Abrir páginas o consultar invitaciones no activa cuentas.

La verificación crea exactamente una organización Free bajo transacción y bloqueo del control de capacidad. Se comprueba el mismo gate de identidad en login, 2FA, refresh, JWT y API tokens. La elegibilidad de organización también cubre tareas periódicas y Sentinine. Un usuario huérfano no recibe automáticamente ninguna organización.

Los integrantes creados por un administrador también deben confirmar su correo. Las invitaciones de integrantes existentes siguen separadas de las de beta y no pueden restablecer una contraseña ni transferir una cuenta existente. Su aceptación explícita para una cuenta nueva sirve como prueba del correo al que se envió la invitación; GET nunca la consume.

## Correo y protección del formulario

- Tokens aleatorios con hash SHA-256 en `BetaInvitation` y `EmailChallenge`; nunca se revelan en listados administrativos.
- El cuerpo del correo se conserva temporalmente cifrado en `IdentityMail`. Celery recibe únicamente el ID del correo, no el secreto. El cuerpo se borra tras aceptación SMTP, expiración o tercer fallo.
- Tres intentos como máximo, separados al menos un minuto. La tarea periódica `accounts.dispatch_identity_mail` recupera mensajes en cola y fallos de broker. Una caída tras aceptación SMTP y antes del commit puede duplicar un mensaje; la confirmación sigue siendo de un solo uso.
- Estados `queued`, `sent`, `failed`, `expired`. `sent` significa aceptación por SMTP, **no entrega certificada a la bandeja**. Una confirmación no activa la cuenta si el correo no fue aceptado.
- Reenvío: espera mínima de 60 segundos y cinco correos de verificación por destinatario/día, incluyendo el inicial. El nuevo desafío revoca los anteriores en la misma transacción. Los reenvíos administrativos de invitaciones tienen un límite separado de cinco/día.
- Mensajes HTML y texto en español. Los enlaces usan exclusivamente `PUBLIC_APP_URL`, nunca Host de una petición. Los secretos van en el fragmento y se retiran de la barra al cargar. El frontend aplica `no-referrer`.
- Turnstile se valida en servidor mediante el cliente HTTP seguro, incluyendo `success`, hostname, action y replay. Solo desarrollo con DEBUG y sin clave permite omitirlo; producción falla cerrada sin configuración y rechaza claves de prueba. [Reglas oficiales de validación de Turnstile](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
- Contadores atómicos en PostgreSQL compartidos entre workers: IP y correo para login/registro; sesión/usuario para reenvíos y 2FA. IP no se usa como identidad ni genera un bloqueo permanente.
- Registro/resend no revelan si un correo existente tiene una cuenta. Una consulta con el token secreto de invitación muestra únicamente el correo enmascarado y su estado.

La lista inicial de correos temporales es **conservadora y no exhaustiva**. Las invitaciones privadas, confirmación y presupuestos siguen siendo necesarios: no existe una lista que garantice detectar todos los proveedores. Se permiten Gmail, dominios educativos y servicios legítimos de privacidad.

Para instalar una lista local revisada, con `version` y un array `domains`, usar `update_disposable_domains --file ARCHIVO --operator UUID_SUPERADMIN --reason MOTIVO`. La actualización es transaccional, auditada y conserva la última política válida si el archivo falla. `BETA_EMAIL_DOMAIN_ALLOWLIST` permite excepciones revisadas. No se descarga ninguna lista dentro del registro. Se normalizan el dominio/IDNA y espacios externos; no se eliminan puntos ni aliases `+` de la parte local.

## Límites del nuevo grupo beta

| Control | Free beta |
| --- | --- |
| Monitoring | 3 targets, mínimo 300 segundos |
| Históricos de telemetría | 3 días; nunca configuraciones ni auditoría |
| Otros módulos | Cuotas Free existentes; auto-discovery consume esas cuotas |
| Altas de recursos desde API | 10 intentos/día por organización, no se reinicia al borrar |
| Diagnósticos | 20 solicitudes/día; además respetan la cadencia compartida |
| Primeros sondeos | 12/hora por organización; se conserva al recrear targets |
| Notificaciones | Correo a integrantes verificados, máximo 50 intentos/día |

Las organizaciones beta comparten un techo provisional de 120 admisiones de sondeo/minuto y 60 reservas pendientes (`BETA_GLOBAL_SCANS_PER_MINUTE`, `BETA_MAX_PENDING_SCANS`). El worker conserva su concurrencia existente. Son protecciones iniciales, **no una certificación de capacidad**: falta medir carga real antes de abrir la beta. Cada recurso conserva sus límites 202/429 y cadencia contractual.

Pro conserva sus contratos y mínimo de 60 segundos. En el catálogo del grupo beta, Business se presenta bajo cotización y Enterprise no se publica; no se modifican contratos existentes. El pago real continúa pendiente y no puede declararse desde el cliente.

## Cambio de correo y transición

`POST auth/email/change/` exige contraseña actual. El correo anterior sigue vigente hasta confirmar el nuevo y recibe una notificación. La confirmación revoca refresh tokens y API tokens, e incrementa la versión de sesión para rechazar access tokens anteriores inmediatamente. No se puede cambiar correo con PATCH de perfil o administración de integrantes.

Las migraciones no marcan ningún usuario existente como verificado, no suspenden cuentas ni cambian sus cuotas. Ese grupo conserva `verification_required=false` y `beta_managed=false` explícitamente. `audit_identity_rollout` es solo lectura: muestra IDs con colisiones canónicas y el conteo pendiente, sin imprimir correos. **No activar `ENFORCE_LEGACY_EMAIL_VERIFICATION` antes de revisar y preparar la verificación de ese grupo.**

`purge_identity_artifacts` es dry-run por defecto; `--apply` elimina únicamente desafíos/correos expirados hace más de 30 días. Nunca elimina usuarios, invitaciones administrativas ni auditoría. No se cambió retención de logs.

## API y modelos añadidos

| Ruta bajo `/api/v1/` | Propósito |
| --- | --- |
| `auth/register/` POST | Registro privado pendiente, 202 sin JWT |
| `auth/beta/config/` GET | Disponibilidad pública y site key, no secret key |
| `auth/beta/invitation/` POST | Consulta de invitación, sin consumo |
| `auth/beta/status/` POST | Estado con sesión limitada |
| `auth/beta/resend/` POST | Reenvío con límites y Turnstile |
| `auth/beta/verify/` POST | Confirmación explícita |
| `auth/beta/admin/` GET/POST | Administración exclusiva de plataforma |
| `auth/email/change/` POST | Cambio confirmado de correo |

Modelos: `BetaControl`, `BetaInvitation`, `EmailChallenge`, `IdentityMail`, `AbuseBucket`, `DisposableDomainPolicy`. User añade `email_verified_at`, `verification_required`, `session_version`; Organization añade `beta_managed`, `beta_status`. Migraciones `organizations.0007` y `accounts.0007–0009`.

## Gates y preparación operativa

1. Configurar SMTP, remitente y dominio público; validar SPF/DKIM/DMARC con el proveedor. La configuración está en [el ejemplo de entorno](../.env.production.example), sin credenciales reales.
2. Configurar claves Turnstile reales y hostname. `check_beta_readiness` valida configuración sin enviar correo ni probar entrega. Abrir admisiones en producción también aplica este gate.
3. Reiniciar backend, worker y Beat con la misma configuración y confirmar registro de las dos tareas de correo.
4. Probar una invitación real, bandeja/spam, expiración y reenvío; probar Turnstile real. Todavía pendiente por falta de proveedor/dominio/credenciales confirmados.
5. Ejecutar pruebas de carga y ajustar techos de cola/concurrencia antes de admitir participantes.
6. Abrir admisiones y admitir manualmente el grupo piloto. Producción sigue fuera de esta fase.

Las pruebas de navegador usan `seed_e2e_accounts --suffix SUFIJO_UNICO`, solo con DEBUG y `SENTINEL_E2E_FIXTURE=1`. No sobrescribe usuarios ni crea una excepción en el API público. Los escenarios UI de beta tienen fixtures HTTP aislados; la transacción real, correo de prueba, JWT y concurrencia se verifican con Django. SMTP/Turnstile reales requieren el gate externo anterior.

Después de una ejecución local, `seed_e2e_accounts --suffix SUFIJO_UNICO --cleanup` verifica nombre, slug y los dos correos exactos del fixture antes de retirar esa organización de prueba y sus recursos. Conserva la auditoría y rechaza la limpieza si hay otro integrante. Los dos fixtures creados durante esta validación se retiraron; pueden recrearse con el mismo comando.

Última validación local tras corregir la confirmación y la cadencia de Conectividad: Django **105/105**, Playwright Chromium **73/73** y TypeScript/Vite aprobados. Flake8 no está instalado en el contenedor reconstruido; su gate permanece sin repetir en esta ejecución. SMTP Gmail configurado y entrega de un correo de prueba confirmada por el usuario. La invitación del piloto tiene aceptación SMTP a través del worker.

Para la prueba autorizada se habilitó un único cupo en el entorno local, con `PUBLIC_APP_URL=http://localhost:3001` y `localhost` admitido por la configuración backend de Turnstile. Esto no equivale a abrir una beta pública: el gate productivo exige HTTPS, validación real del widget, dominio/remitente y capacidad. CI y producción pendientes. Las cuentas anteriores no se modificaron.

La confirmación explícita envía solo `token`; no requiere captcha. Registro y reenvío conservan Turnstile. Abrir o recargar una URL sin fragmento no confirma nada: la interfaz ofrece volver al correo más reciente o solicitar otro enlace. Reenviar revoca los anteriores. El estado consultado incluye `retry_after_seconds` y `challenge_expires_at`, nunca secretos; iniciar sesión no genera un nuevo mensaje por sí solo.
