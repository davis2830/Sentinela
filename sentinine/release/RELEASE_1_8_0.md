# Senti9 1.8.0 · instalación y retorno

Compatible con protocolo v2, diario SQLite y telemetría de 1.7.0. No se publica una imagen ni se actualiza un agente real al preparar este candidato.

La imagen `davis1924/senti9:1.8.0` se publicó como pública el 2026-11-11, con variantes AMD64/ARM64 y descargas anónimas verificadas. [Digest, evaluación de seguridad y evidencia](../../docs/SENTI9_PUBLIC_IMAGE_2026-11-11.md). Los comandos de preparación siguientes siguen siendo locales; publicar no actualiza agentes instalados.

Cambios: diagnóstico de lectura sin inicializar el diario; instaladores que consumen el perfil versionado de Sentinel; identidad de contenedor y volumen por agente; instalación principal por Docker Linux y Docker Desktop con contenedores Linux. El portal descarga el token una sola vez, comprueba primera señal y distingue conexión, entrega y cola local.

Requiere el backend con `monitoring.0009_agentprobe_revocation_reason_agentprobe_revoked_at`. Su revocación invalida el hash del token, pausa monitores y conserva historial. No reviertas este control al retornar un runtime anterior.

## Preparación local

```text
docker build --target production -t davis1924/senti9:1.8.0 sentinine
python sentinine/release.py compatibility --baseline davis1924/senti9:1.7.0 --output .tmp/senti9-180-compatibility.json
python sentinine/release.py prepare --baseline davis1924/senti9:1.7.0 --report .tmp/senti9-180-compatibility.json --output dist/senti9-1.8.0
python sentinine/release.py verify dist/senti9-1.8.0
```

El paquete incluye ambas imágenes, manifiesto, reporte de compatibilidad, instalador Python empaquetado y SHA256SUMS. La comprobación de hashes acredita integridad; la autenticidad requiere firma externa con clave obtenida por un canal confiable. CI remoto, firma, publicación y piloto se realizan por separado.

## Instalar

1. Configura `SENTI9_CONTROL_URL` en el backend. Producción requiere HTTPS sin credenciales, query ni fragmento. `SENTI9_IMAGE` fija una referencia versionada o digest autorizado, público o privado. Marca `SENTI9_DISTRIBUTION_READY=true` sólo después de verificar esa distribución.
2. Registra Senti9, guarda su archivo de token fuera de repositorios y carpetas compartidas y prepara sus permisos antes de ejecutar comandos. En Linux debe ser legible por UID 10001, con permisos 0400. Conserva una copia segura.
3. Usa las instrucciones Bash o PowerShell del portal. Docker Desktop debe ejecutar contenedores Linux. `host.docker.internal` alcanza servicios del host; en Linux el laboratorio añade `host-gateway`. No uses localhost dentro del contenedor para alcanzar Sentinel o servicios del host. [Referencia Docker](https://docs.docker.com/desktop/features/networking/networking-how-tos/).
4. Imagen pública: `docker pull davis1924/senti9:1.8.0` no requiere cuenta de Docker. Registro privado: autentícate con una cuenta autorizada. Paquete local: verifica hashes y firma y carga la imagen con `docker image load --input ARCHIVO.docker.tar`; el perfil local usa `--pull never`.
5. Alternativa avanzada: descarga el perfil JSON no secreto desde el portal. Usa Python 3.11+ con `install.sh` (`SENTININE_INSTALL_PROFILE`, `SENTININE_TOKEN_FILE`) o `install.ps1 -ProfileFile ... -TokenFile ...`. Los scripts leen el mismo perfil y nunca evalúan su cadena de comando.
6. CA corporativa: monta el PEM de sólo lectura y configura `SENTININE_CONTROL_CA_FILE` y, cuando proceda, `SENTININE_TARGET_CA_FILE` con rutas internas. Conserva la validación TLS. HTTP se admite únicamente en laboratorio explícito con `SENTININE_ENV=development` y `SENTININE_ALLOW_HTTP=true`.
7. La primera señal acredita conexión. Crea después un monitor privado; comprueba su primera medición y configura regla y canal de aviso.

## Diagnóstico y actualización

`docker exec NOMBRE python -m diagnostics` comprueba configuración, lectura de token, CA, estado local y autenticación sin heartbeat ni solicitud de tareas. No muestra secretos, argumentos ni cuerpos. `python -m delivery status`, `drain` y `resume` conservan sus contratos.

Para actualizar: drena, entrega pendientes, detén el contenedor y vuelve a crearlo con el mismo servidor, token, nombre de volumen y usuario 10001. La consola conserva los comandos de cada agente. No elimines el volumen. Para rotar, el backend volverá a comprobar desconexión y pendientes; el nuevo archivo se descarga sólo durante esa acción.

Retorno: drena y detén 1.8.0, usa la imagen 1.7.0 del mismo paquete y vuelve a montar el mismo volumen y token. La prueba seed → upgrade → rollback → resume verifica identidad, pendientes, recuperación de running sin repetir solicitudes y deduplicación. No cambies el esquema del backend ni reactives un token revocado.

Capacidades conservadas: HTTP/API de Monitoring, TCP, DNS y TLS del agente. Las validaciones JSON del módulo API Endpoints siguen ejecutándose en cloud; no se anuncian como capacidad privada.
