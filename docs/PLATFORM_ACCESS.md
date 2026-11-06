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

- **Resumen SaaS** muestra estimaciones y distribuciones de organizaciones. El seguimiento de clientes usa estados de suscripción. Los pagos confirmados y las fechas de cobro requieren un registro de facturación real.
- **Organizaciones** ofrece filtros por plan y estado, exportación CSV y acceso a la ficha de cada cliente. Desde la ficha se puede cambiar el plan o extender la prueba.
- **Usuarios** muestra organización, rol, estado, verificación de correo, 2FA y último acceso. Las acciones de soporte requieren un motivo para auditoría.
- **Beta** y **Auditoría** cubren admisión y actividad global de la plataforma. [Componentes de consola](../frontend/src/components/platform_admin) · [Rutas administrativas](../backend/organizations/urls_admin.py).

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
