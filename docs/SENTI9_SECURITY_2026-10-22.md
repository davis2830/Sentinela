# Senti9 1.5.0: conexión, secretos y ejecución sin privilegios

## Alcance realizado

Implementación y pruebas locales aisladas. No se publicó este equipo, no se creó
Cloudflare Tunnel, no se conectó Senti9 al dominio real, no se rotaron tokens
reales y no se modificaron volúmenes existentes de agentes.

### Conexión

HTTPS obligatorio en el control. HTTP necesita development + ALLOW_HTTP explícitos;
los targets HTTP LAN siguen permitidos según configuración. CA corporativa y
hostname verificado, con confianza separada para control y targets. Nunca seguir
redirects ni aplicar bypass TLS de un target al canal de control.

### Secretos

Token por archivo, prioridad sin fallback si el archivo falla, lectura acotada y
rechazo de contenido inválido. Compatibilidad con variables anteriores. Las
plantillas de instalación no incluyen el token; la UI explica el montaje.
Respuestas que revelan token usan Cache-Control: no-store.

Rotación administrativa por organización, revelación única, hash almacenado y
auditoría sin secreto. Exige agente offline, sin reservas activas ni ejecuciones
pendientes. El nuevo CLI de drenaje entrega pendientes y muestra conteos sin
ejecutar la recuperación del diario de un proceso activo.

### Contenedor

UID/GID 10001, /data 0700, diario 0600; raíz readonly, sin capabilities,
no-new-privileges, límites y tmpfs en Compose/instaladores. Fresh volumes reciben
propietario correcto; volúmenes root históricos necesitan migración controlada
previa. No existe un entrypoint que arranque privilegiado para corregirlos.

Imagen local `sentinel/sentinine:1.5.0`; etapa tests separada con OpenSSL. No se
publicó imagen ni se probaron instaladores contra hosts de clientes. Las
plantillas versionadas requieren que la imagen exista en el registry autorizado
o sea construida localmente.

## Verificación local

- **34 pruebas del agente** aprobadas dentro de contenedor sin red externa,
  puertos publicados ni privilegios. Certificados efímeros generados en /tmp del
  contenedor: válido, vencido, no confiable y hostname incorrecto; además prueba
  de downgrade/redirect bloqueado y separación de CA.
- Cuatro pruebas dirigidas backend aprobadas: rotación, revocación del token
  anterior, tenant/RBAC, auditoría, bloqueo por pendientes y plantilla sin secreto.
- Imagen runtime construida. Verificados UID 10001, capabilities=0,
  NoNewPrivs=1, rootfs readonly, archivo de token, modos del estado y persistencia
  al recrear contenedor. Solo volumen temporal etiquetado, eliminado al terminar.
- Instaladores PowerShell/Bash con sintaxis válida; Compose config válido.
- Build frontend aprobado (12,82 s). Suite Django completa **274/274**, 79,955 s.
  Se verifican también las pruebas existentes de entrega y concurrencia.

Se añadió verificación del runtime sin privilegios al workflow CI. Esta evidencia
es local; CI remoto, pruebas Windows de instalación real, publicación de imagen,
DNS/IPv6 y piloto LAN permanecen pendientes.

## Operación y límites

Ver [README de Senti9](../sentinine/README.md) para variables, permisos, drenaje y
secuencia de rotación. La cola conserva las ventanas de 1.4: recepción hasta 24 h,
sin promesa de retención indefinida. Rotación no es hot reload; parar y recrear
después de vaciar pendientes. Los límites de recursos son una base que requiere
medición en el piloto, no un resultado de capacidad productiva.
