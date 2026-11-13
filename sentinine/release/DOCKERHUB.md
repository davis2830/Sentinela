# Senti9 — agente privado de Sentinel

Senti9 ejecuta comprobaciones de conectividad desde tu red y entrega sus resultados a Sentinel mediante conexiones salientes. No necesita publicar puertos de entrada.

**Imagen:** `davis1924/senti9:1.8.0` · contenedores Linux en Docker Engine o Docker Desktop. La conexión del agente, la entrega de resultados y el estado del servicio son señales diferentes.

## Empezar

1. En Sentinel abre **Conectividad → Senti9 → Registrar Senti9**.
2. Selecciona Linux o Windows y guarda el archivo de token en una ubicación privada. Sólo se revela durante el registro o la rotación.
3. Descarga la imagen y ejecuta las instrucciones generadas para tu agente. Incluyen nombre de contenedor y volumen propios, servidor de control y montaje del token de sólo lectura.
4. Confirma la primera señal y crea un monitor privado. Revisa su primera medición y configura una regla y un canal de aviso.

```sh
docker pull davis1924/senti9:1.8.0
```

La imagen pública no incluye un token ni una cuenta de Sentinel. Sin configuración no ejecuta comprobaciones. La plataforma y sus permisos siguen siendo necesarios.

## Seguridad y configuración

- Usuario `10001:10001`, raíz de sólo lectura, `--cap-drop ALL` y `no-new-privileges` en las instrucciones del portal.
- `/data` necesita un volumen persistente escribible. Guarda identidad, deduplicación y resultados pendientes. No lo elimines al actualizar.
- `SENTININE_TOKEN_FILE` apunta al archivo montado de sólo lectura. Protege también sus permisos en el host. No pongas tokens en comandos, URL, imágenes ni repositorios.
- `SENTININE_SERVER` define el servidor de control. Usa HTTPS para instalaciones remotas.
- CAs corporativas: monta el PEM de sólo lectura y utiliza `SENTININE_CONTROL_CA_FILE` o `SENTININE_TARGET_CA_FILE`. Conserva la verificación TLS.
- Windows: Docker Desktop debe usar contenedores Linux. Para llegar a servicios del host utiliza `host.docker.internal`; `localhost` dentro del contenedor designa el contenedor.
- HTTP sólo se admite en laboratorio explícito mediante `SENTININE_ENV=development` y `SENTININE_ALLOW_HTTP=true`.

No ejecutes la imagen con `--privileged`, socket Docker montado ni permisos administrativos.

### Avisos del análisis de la versión 1.8.0

La imagen se analizó en ambas arquitecturas antes de publicarla. Se actualizaron zlib y Kerberos y se retiraron pip/setuptools/wheel. Permanecen dos avisos altos de Scout, evaluados para este digest concreto:

- **CVE-2026-107891:** [Alpine confirma el parche en musl 1.2.6-r3 de la rama 3.24](https://security.alpinelinux.org/vuln/CVE-2026-107891), que es la versión instalada.
- **CVE-2026-119586:** [SQLite identifica el problema en su consola](https://www.sqlite.org/cves.html). Esta imagen no incluye el ejecutable `sqlite3` ni ejecuta `.recover`; utiliza la biblioteca desde Python.

No se ocultan los avisos ni se afirma ausencia de vulnerabilidades futuras. Estas evaluaciones deben repetirse cuando cambie la imagen.

## Diagnóstico y actualización

Sustituye `NOMBRE` por el nombre indicado por Sentinel:

```sh
docker exec NOMBRE python -m diagnostics
docker exec NOMBRE python -m delivery status
docker exec NOMBRE python -m delivery drain
```

El diagnóstico comprueba configuración, lectura del token, CA, diario local y autenticación sin pedir tareas ni ejecutar monitores. Los comandos no muestran secretos ni cuerpos de tareas.

Para actualizar: drena, espera que no haya pendientes, detén el contenedor y recréalo con el mismo servidor, token y volumen. Después ejecuta `python -m delivery resume` dentro del contenedor y verifica conexión y nuevas mediciones. La rotación del token tiene su propio flujo y exige resolver pendientes antes de reemplazarlo.

Retirar el agente desde Sentinel revoca su token, pausa los monitores y conserva historial y asignaciones. Descargar una imagen nueva no actualiza automáticamente agentes existentes.

## Capacidades y compatibilidad

Protocolo v2 y telemetría compatibles con 1.7.0. Comprueba HTTP/HTTPS y API de Monitoring, TCP, DNS y TLS según las tareas autorizadas por Sentinel. Los esquemas JSON del módulo API Endpoints se ejecutan en cloud y no se anuncian como capacidad privada.

La imagen utiliza la biblioteca estándar de Python; no incluye herramientas de desarrollo ni una terminal de administración remota. Una comprobación fallida puede tener efectos si se configura un método HTTP mutador: utiliza destinos y credenciales adecuados.

Utiliza una etiqueta versionada o fija el digest publicado. No se publica `latest` para evitar actualizaciones implícitas. Esta distribución no certifica el funcionamiento de una red, VPN o CA concreta.

**Producto:** [Sentinel / GcTechOps](https://sentinel.gctechops.com).
