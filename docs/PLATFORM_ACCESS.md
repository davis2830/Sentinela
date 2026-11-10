# Acceso a Administración SaaS

En desarrollo, inicia sesión en el portal habitual y abre **Perfil → Seguridad**
para vincular tu aplicación autenticadora. Confirma tu contraseña actual al
enrolar el factor. Después entra en
[Acceso administrativo local](http://localhost:3001/admin/login) y confirma
tu contraseña y el código de seis dígitos. El código debe ser de tu autenticador.

La sesión administrativa dura diez minutos y el navegador la conserva en memoria.
Django guarda una huella HMAC del token. Las respuestas administrativas indican
`Cache-Control: no-store`. El frontend y la API de desarrollo escuchan en localhost.
Recargar la pestaña requiere iniciar sesión de nuevo. **Cerrar sesión administrativa**
revoca la sesión en Django. Los cambios de contraseña, factor, versión de sesión
o elegibilidad invalidan el acceso. Los códigos de recuperación del portal permiten
recuperar el acceso al perfil. La consola exige el código del autenticador.

Si un superadmin pierde su autenticador, el operador de la base de datos debe
verificar su identidad por el canal de soporte y coordinar el reenrolamiento.
La recuperación operativa consiste en incrementar `session_version`, limpiar el
secreto TOTP y los códigos de respaldo, y marcar `is_2fa_enabled` como falso en la
misma transacción. El usuario vincula su nuevo autenticador desde el perfil. La
consola permanece bloqueada para esa cuenta hasta completar la activación.

## Operación de la consola

- **Resumen SaaS** prioriza cupos, invitaciones, verificaciones y organizaciones de beta. Los grupos de atención abren Beta con el filtro correspondiente; pueden coincidir y no deben sumarse. El contexto comercial se consulta al desplegarlo y conserva su alcance y carácter estimado.
- **Beta** separa invitación, verificación, organización, recursos y mediciones actuales. Invitar, reenviar, revocar/rechazar, configurar cupos, abrir/cerrar admisiones y configurar comentarios tienen confirmaciones y motivos propios. Un envío aceptado por el servidor de correo no prueba recepción en la bandeja.
- **Organizaciones** permite buscar, filtrar, ordenar y exportar el directorio. La ficha carga General, Usuarios, Recursos y límites e Historial al seleccionarlos. Contacto, plan, prueba, clasificación y acceso son acciones auditadas. Las vistas previas de plan y prueba se calculan en el servidor.
- **Usuarios** distingue administradores, lectura heredada y permisos personalizados. La ficha consulta roles y acceso efectivo; su edición permanece en Roles y permisos de la organización. Se mantienen las protecciones de superadmins y del último administrador.
- **Salud de plataforma** consulta dependencias y colas al entrar; después requiere **Actualizar diagnóstico**. Copia sólo un resumen acotado. Los mensajes listos incluyen prioridades configuradas; no son tareas en ejecución ni un historial de fallos.
- **Auditoría** nunca consulta eventos al entrar, preparar filtros, editarlos o regresar. Requiere **Consultar auditoría**; la paginación y el detalle pertenecen a la consulta aplicada.

Los directorios usan páginas de 25. Búsqueda y filtros permanecen en memoria al navegar; sólo la sección aparece en la URL. Los recursos se cargan al seleccionar su módulo.

### Suspender y reactivar acceso

**Suspender acceso** bloquea nuevas sesiones y comprobaciones, invalida sesiones web y conserva datos, plan, suscripción, fechas de prueba y roles. Los trabajos pendientes vuelven a comprobar autorización; no se cancelan a la fuerza los que ya comenzaron. Beta y Organizaciones utilizan la misma transición. Se protege cualquier organización con superadmins activos.

**Reactivar acceso** exige iniciar sesión nuevamente. No renueva una prueba vencida ni confirma pagos. Una suscripción antigua marcada como suspendida se muestra por separado del bloqueo completo de acceso.

### Comentarios de participantes

En **Beta → Formulario externo de comentarios** configura un enlace HTTPS público y, opcionalmente, el enlace privado de respuestas. La acción requiere motivo. El portal beta recibe únicamente el enlace público y abre el proveedor sin añadir identidad, organización o credenciales. Sin enlace, muestra configuración pendiente.

El formulario se crea fuera de Sentinel y debe solicitar categoría (error/mejora/duda), módulo, descripción, pasos y resultados esperado/obtenido. Sentinel no crea tickets ni inventa conteos de comentarios. No pegues credenciales en el formulario.

[Guía y matriz de la consola beta](PLATFORM_BETA_CONSOLE_2026-11-09.md) · [Componentes de consola](../frontend/src/components/platform_admin) · [Rutas administrativas](../backend/organizations/urls_admin.py).

## Publicación de la consola

El gateway de producción atiende el portal de clientes por HTTPS. El listener
administrativo queda publicado en el loopback del servidor, en
`127.0.0.1:8081`, y exige el hostname `admin.sentinel.gctechops.com`.
El listener público rechaza las rutas administrativas y sus API globales.

1. Configura `ALLOWED_HOSTS` con los hostnames del portal y de la consola.
   Usa los valores de ejemplo de producción como referencia.
2. En Cloudflare Zero Trust, crea la aplicación de Access para
   `admin.sentinel.gctechops.com` y limita la política a las identidades de los
   operadores autorizados, empezando por la cuenta del propietario.
3. Publica ese hostname mediante Cloudflare Tunnel. Ejecuta `cloudflared` en el
   host del gateway y configura el servicio `http://127.0.0.1:8081`.
   Conserva el Host administrativo y activa **Protect with Access** en el túnel
   con el equipo y el AUD de la aplicación de Access.
4. Desde fuera del servidor, comprueba el desafío de Cloudflare Access, el
   inicio de sesión administrativo con TOTP y el rechazo de la API administrativa
   en el dominio de clientes. Comprueba también que el puerto 8081 se escucha
   únicamente en el loopback del servidor.

[Configuración de una aplicación protegida por Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)
