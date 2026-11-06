# Plan y ejecución de correcciones UX — 2026-11-04

## Plan aplicado

Partimos de los [12 hallazgos UX](UX_AUDIT_2026-11-04.md), conservando la
arquitectura, la paleta, los layouts de escritorio y las reglas de negocio.

1. Acceso y confianza: retirar la preferencia de sesión sin efecto, implementar
   recuperación de contraseña, ocultar alta a Viewer y corregir afirmaciones de seguridad.
2. Accesibilidad compartida: diálogo, foco, Escape, fondo inerte, etiquetas y
   nombres de controles; tamaños legibles y áreas de interacción.
3. Claridad operativa: separar vacío/error, consulta/medición y admisión abierta/cerrada.
4. Uso móvil: una sola representación de los recursos, filtros compactos y acciones
   accesibles sin recorrer horizontalmente una tabla de escritorio.
5. Regresiones, revisión visual y documentación; producción y CI remoto fuera de alcance.

## Decisiones y cambios

| Hallazgo | Corrección | Evidencia de regresión |
|---|---|---|
| 001 | Se retira «Recordar sesión»; se explica la persistencia del navegador y el cierre en equipos compartidos. No se cambian JWT/refresh ni se introduce otra política de almacenamiento. | UX access; suite auth-session existente |
| 002 | Solicitud y confirmación de recuperación por correo, sin autenticar automáticamente. | Diez pruebas Django de recuperación, incluida concurrencia; password recovery is explicit |
| 003 | `ModalSurface` para Target/SSL; foco inicial, contención/restauración, fondo inerte, bloqueo de scroll y Escape. El hook común beneficia también a drawers existentes. | UX target dialog; UX SSL read failure, incluida apertura/cierre del diálogo |
| 004 | Campos de login/registro asociados, autocomplete, nombres accesibles en Target/SSL/onboarding, cierre y logout; errores anunciados. | UX access; registro con invitación; UX target dialog; password recovery |
| 005 | Alta de Monitoring con `AdminButton`; backend conserva `IsAdminOrReadOnly`. | UX Viewer y permisos backend existentes |
| 006 | Monitoring usa filas móviles con identidad, estado, frecuencia, latencia y detalle; tabla original desde 768 px. Orden/selección desplegables y filtros móviles por select. | UX Viewer mobile; quick endpoint panel mobile; smoke responsive existente |
| 007 | Se conserva un solo selector Nube/Senti9 con agente condicional. Se retiran sus representaciones duplicadas y emojis de opciones. | UX target dialog; alta administrativa y previews existentes |
| 008 | Utilidades tipográficas explícitas de 9/10/11 px sustituidas por 12 px; controles de al menos 44 px y foco visible. Sin cambiar fuentes o colores semánticos. | UX System minimum; suite de layout, paleta y responsive existente |
| 009 | SSL diferencia fallo de consulta de vacío, ofrece reintento local y omite conteos de filtro cuando falla la lectura. Si existe caché conserva sus recursos junto al aviso. | UX SSL read failure y recuperación |
| 010 | «Resultados de monitoreo», «Consulta automática» y pie neutral «Consola Sentinel». El tooltip conserva fecha, alcance GET y próximo ciclo. | Suite de reloj compartido, planes y GET sin POST |
| 011 | Registro muestra estado explicativo sin recoger campos si no hay admisión/invitación vigente. No se inventa lista de espera ni se abre la beta. | Private beta requires invitation; UX access; registro y verificación existentes |
| 012 | Auditoría describe eventos y trazabilidad, sin afirmar verificación criptográfica/inmutabilidad comprobada. | UX audit avoids unverified claims |

La adaptación móvil específica de filas se limita a Monitoring, donde se midió
el hallazgo 006. Los demás módulos conservan sus listas y cuadrículas actuales;
no se presenta esto como una conversión de todas sus tablas a filas móviles.
La tipografía y los objetivos de interacción compartidos sí se aplican globalmente.

## Recuperación de acceso: contrato y controles

- `POST /api/v1/auth/password/recovery/`: `{email, turnstile_token}`. Respuesta 202
  genérica para cuenta habilitada o dirección desconocida; no confirma entrega.
  Usa el outbox cifrado existente y sus reintentos, sin pasar secretos a Celery.
- `POST /api/v1/auth/password/reset/`: `{token, password}`. Token ligado al usuario
  y su contraseña actual, máximo una hora y uso único. UUID y token inválidos
  devuelven 400. No hay activación por GET ni login automático.
- Enlace con fragmento desde `PUBLIC_APP_URL`; el frontend retira el fragmento
  visible al cargar y confirma únicamente al enviar el formulario.
- Límites persistidos: solicitud por IP 10/h y por correo 3/h; confirmación 20/h
  por IP. Turnstile mantiene validación de hostname y acción `password_reset`.
  El modo local DEBUG sin secreto conserva la excepción local existente.
- Cuenta inactiva, sin contraseña utilizable o pendiente de verificación no recibe
  recuperación. No se salta admisión beta, verificación ni 2FA. La solicitud no
  comprueba el estado de pago: recuperar identidad no autoriza monitoreo.
- Valida contraseña con los validadores Django. Confirmación, cambio de contraseña,
  revocación de refresh y auditoría ocurren en una transacción con bloqueo del
  usuario. Dos confirmaciones concurrentes: una tiene éxito y la otra obtiene 400.
- Si falla blacklist, se revierte la contraseña; no se anuncia éxito parcial.
  Los access tokens ya emitidos pueden sobrevivir hasta 15 minutos. MFA, organización,
  roles, tokens API y plan no se cambian. El navegador sale de su sesión tras el reset.
- Las dos rutas son anónimas en el cliente HTTP: no adjuntan bearer antiguo ni
  intentan refresh de sesión para resolver un error del formulario.

No se requieren nuevas variables ni migraciones. Se reutilizan SMTP,
`PUBLIC_APP_URL`, cifrado del outbox, Turnstile y worker/dispatcher existentes.
La entrega SMTP y Turnstile reales quedan pendientes de integración externa;
no se enviaron correos a personas durante estas pruebas.

## Reglas de negocio preservadas

Free al registrarse, mínimo 300 s; Pro 60 s y configuraciones más lentas respetadas.
GET solo consulta; previews conservan presupuesto independiente y ausencia de
históricos; sondeos persistidos conservan reservas, 202, polling y 429. Pausa,
suscripción vencida, Viewer y Senti9 mantienen autoridad backend. Sin cambios
en SSRF/redirecciones, asociaciones por protocolo, WHOIS explícito, retención,
cuotas o almacenamiento con hash de API tokens.

## Validación y cierre

Entorno aislado `sentinel-ux-fixes-20261104`, fixture `ux-fixes-20261104`, correo
locmem, sin Beat. PostgreSQL operativo del usuario y cuentas reales fuera de alcance.

- Django completo final: **301/301**, 85,335 s; incluye diez casos nuevos de
  recuperación y concurrencia real sobre PostgreSQL. La primera pasada fue 299/299
  antes de añadir las dos últimas regresiones. Los 400/403/429 y el 500 inducido
  para probar rollback son escenarios deliberados, no excepciones silenciadas.
- Chromium completo final: **210/210**, 5,2 minutos, sin omisiones ni reintentos.
  Incluye las seis nuevas regresiones de UX/recuperación y las existentes de planes,
  aislamiento, sondeos, previews, reloj, permisos, gráficos y responsive.
- TypeScript y build Vite final: aprobados; build de 17,17 s.
- Guard de archivos versionables/secretos: aprobado. Compose aislado validado
  sintácticamente; `git diff --check` aprobado respetando CRLF del equipo.
- Primera pasada Chromium: 205/209; se corrigió contenido duplicado desktop/móvil,
  se adaptaron expectativas a registro sin formulario y filas móviles, y se corrigió
  el menú de acciones que desbordaba en móvil tras ampliar controles. En repetición
  dirigida, 9/10 antes del último ajuste del menú. Los resultados parciales no se
  consideran gate final.
- Inspección visual adicional en 1440×900 y 390×844 mediante navegador, login,
  Monitoring y diálogo. Capturas locales excluidas de Git en
  `../.tmp/ux-fixes-2026-11-04/`; logs de pruebas en `../.tmp/ux-fixes-*.log`.

La auditoría inicial queda como evidencia histórica; esta entrega no constituye
una certificación WCAG ni sustituye una revisión con lector de pantalla o móviles
físicos. Tampoco amplía a los flujos no verificados declarados en aquel informe.

Los doce hallazgos quedan corregidos dentro de su alcance local, con las decisiones
explicadas en la matriz. Fixture retirado con el comando protegido para el sufijo
exacto, auditoría conservada, Compose detenido sin borrar volúmenes y Vite de prueba
terminado. Viewport restablecido y pestaña de revisión cerrada. Los servicios
habituales no se reconstruyeron durante esa fase aislada. Posteriormente, por
solicitud del usuario, se reconstruyeron y recrearon backend, frontend, worker y
Beat del proyecto local `sentinela`. PostgreSQL conserva `sentinela_postgres_data`;
Redis no se recreó. Solo se renovó el volumen anónimo de dependencias frontend.
Django check y migrate --check aprobados sin aplicar migraciones; frontend y
recuperación HTTP 200, readiness backend 200 y Celery respondió al ping.
Se añadieron healthchecks propios de worker/Beat en Compose local para evitar que
heredaran el probe HTTP del backend. Beat comprueba proceso/broker; sus logs
confirmaron despacho de tareas, sin presentar ese probe como verificación de cada sondeo.

Pendientes externos conservados: CI del árbol final publicado, entrega SMTP real,
Turnstile real, exposición histórica/rotación, retención aprobada, preproducción y
producción. Sin commit, push, despliegue ni limpieza de datos operativos.
