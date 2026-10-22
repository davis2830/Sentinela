# Sentinel + Senti9: pruebas en tu equipo personal

Guía para **Windows + PowerShell + Docker Desktop con contenedores Linux**.
Fecha: 2026-10-22. Versión del agente: **1.7.0**.

## 1. Qué tenemos y qué falta

| Componente | Estado |
| --- | --- |
| Sentinel | Backend Django, PostgreSQL, Redis, Celery y frontend React disponibles en el código actual |
| Senti9 | HTTP/HTTPS/API de Monitoring, TCP IPv4/IPv6 y DNS A/AAAA |
| Entrega | Diario SQLite persistente, acuse por ejecución, deduplicación y heartbeat independiente |
| Seguridad | Token por archivo, TLS obligatorio salvo desarrollo explícito, contenedor sin privilegios |
| Operación | Cola local, último acuse, drenaje, diagnósticos y estado desconocido/desactualizado |
| Distribución | Candidato local, imágenes exportadas 1.7.0 y 1.6.0, manifiesto, checksums y prueba de retorno |
| Docker Hub | Repositorio privado `davis1924/senti9` creado; imagen todavía no publicada |
| Pendiente | Firma confiable, publicación verificada por digest, CI remoto y piloto real sostenido |

Evidencia anterior: **288 pruebas Django**, **58 de agente/empaquetado**, build frontend
y cuatro fases de compatibilidad del diario aprobadas localmente. Las tres pruebas
Chromium dirigidas del panel pertenecen al bloque de telemetría. No equivale a CI ni a producción lista.
La nueva guía se valida por configuración; **el laboratorio completo descrito aquí todavía no se ejecutó**.

Para la historia detallada: [revisión de producción](SENTININE_PRODUCTION_REVIEW_2026-10-22.md),
[telemetría](SENTI9_TELEMETRY_2026-10-22.md) y [distribución](SENTI9_RELEASE_2026-10-22.md).

## 2. Qué necesitas llevar al equipo personal

- Docker Desktop iniciado y usando contenedores Linux. Comprueba `docker info --format '{{.OSType}}'`: debe decir `linux`.
- Docker Compose **2.24.4 o posterior**: `docker compose version`.
- El **código actual completo** de Sentinel, incluyendo archivos nuevos de este trabajo.
  Selecciona la rama `codex/sentinel-senti9-2026-10-22` en GitHub para obtener este
  trabajo. No asumir que `main` los contiene: la integración a main es un paso separado.
- El paquete `dist/senti9-1.7.0/`, o construir la imagen desde ese código.
- Puertos locales **3001 y 8000** disponibles. No necesitas VM en nube, dominio, Cloudflare ni abrir puertos del router.
- Conexión inicial a Internet para descargar imágenes base y dependencias de construcción.

El paquete del agente **no incluye el servidor Sentinel**. Si no tienes un servidor
autorizado accesible, ejecuta ambos localmente como indica esta guía. Lleva código y
artefactos autorizados; crea tus propios secretos en el equipo personal. No copies `.env`,
tokens, bases de datos ni volúmenes del equipo de la empresa.

Sugerencia de carpeta personal: `C:\SentinelLab\GC_OPS_OBS`. Los comandos siguientes
se ejecutan desde esa raíz, ajustando únicamente la ruta si elegiste otra.

## 3. Preparar Sentinel local

### 3.1 Abrir PowerShell y definir el proyecto

```powershell
Set-Location C:\SentinelLab\GC_OPS_OBS
$labArgs = @('-p', 'senti9-personal', '-f', 'docker-compose.yml', '-f', 'docker-compose.personal.yml')
```

Mantén esta ventana abierta. En una nueva sesión redefine `$labArgs` antes de usarlo.
Es importante incluir siempre ambos archivos y el mismo proyecto: así utilizas los
contenedores y volúmenes separados del laboratorio.

`docker-compose.personal.yml` deja frontend/API en **127.0.0.1**, no publica PostgreSQL
ni Redis, y mantiene los módulos de observabilidad fuera del inicio básico.
Este archivo se combina con el principal y requiere la versión de Compose indicada.

### 3.2 Crear configuración privada para este laboratorio nuevo

Si `.env` ya existe, revisa su procedencia antes de seguir. Estos comandos se detienen
para evitar reemplazarlo. Úsalos en una copia nueva para el laboratorio:

```powershell
if (Test-Path -LiteralPath .env) { throw 'Ya existe .env. Usa una copia nueva del laboratorio o revisa ese archivo.' }
$labKeyBytes = New-Object byte[] 48
$labRandom = [Security.Cryptography.RandomNumberGenerator]::Create()
$labRandom.GetBytes($labKeyBytes)
$labSecret = [Convert]::ToBase64String($labKeyBytes)
$labRandom.GetBytes($labKeyBytes)
$labDbPassword = [Convert]::ToBase64String($labKeyBytes)
$labRandom.Dispose()
$labEnv = @(
  'DJANGO_SETTINGS_MODULE=config.settings.dev',
  'DEBUG=True',
  "SECRET_KEY=$labSecret",
  'POSTGRES_DB=sentinel',
  'POSTGRES_USER=sentinel',
  "POSTGRES_PASSWORD=$labDbPassword"
)
[IO.File]::WriteAllLines((Join-Path $PWD '.env'), $labEnv, [Text.UTF8Encoding]::new($false))
Remove-Variable labSecret,labDbPassword,labEnv,labKeyBytes
docker compose @labArgs config --quiet
```

El `.env` permanece en tu equipo y está ignorado por Git. No se necesita SMTP para
la cuenta ficticia de esta guía. No se modifica el registro público ni la verificación
de correo del producto.

### 3.3 Iniciar solo los servicios necesarios

```powershell
docker compose @labArgs up -d --build db redis backend frontend celery_worker celery_beat
docker compose @labArgs exec -T backend python manage.py migrate --noinput
docker compose @labArgs exec -T backend python manage.py check
docker compose @labArgs ps
```

Si backend tarda durante la primera migración, consulta los logs y vuelve a verificar
salud después de migrar:

```powershell
docker compose @labArgs logs --tail 60 backend
Invoke-RestMethod http://localhost:8000/health/
```

Abre **http://localhost:3001** en el navegador. El primer build puede tardar; Docker
mostrará si un puerto está ocupado o una imagen no pudo descargarse.

### 3.4 Crear cuenta de laboratorio y habilitar cuota de agente

Se utiliza el comando existente de fixtures, autorizado solo con DEBUG y una variable
explícita. Crea una organización ficticia distinta de las cuentas reales:

```powershell
docker compose @labArgs exec -T -e SENTINEL_E2E_FIXTURE=1 backend python manage.py seed_e2e_accounts --suffix personal-lab
```

El plan Free permite **0 agentes privados**. Para esta organización ficticia habilita
Pro localmente, sin cambiar planes de clientes ni realizar pagos:

```powershell
docker compose @labArgs exec -T -e SENTINEL_E2E_FIXTURE=1 backend python manage.py shell -c "from django.conf import settings; from organizations.models import Organization; import os; assert settings.DEBUG and os.environ.get('SENTINEL_E2E_FIXTURE') == '1'; org=Organization.objects.get(slug='e2e-personal-lab',name='Sentinel E2E personal-lab',beta_managed=False); assert set(org.users.values_list('email',flat=True)) == {'e2e-admin-personal-lab@example.test','e2e-viewer-personal-lab@example.test'}; org.plan_tier='pro'; org.save(update_fields=['plan_tier']); print('Cuota de agente habilitada solo en la organizacion ficticia')"
```

Credenciales **exclusivas de este laboratorio local**:

| Campo | Valor |
| --- | --- |
| Correo | `e2e-admin-personal-lab@example.test` |
| Contraseña | `E2e-Admin-Password-123!` |

No se envía correo. Si la fixture ya existe, el comando se detiene sin reemplazarla;
no la vuelvas a crear para reabrir el laboratorio. El usuario viewer también creado
no se utiliza para administrar el agente.

## 4. Cargar o construir Senti9

Escoge **una** opción:

**A. Desde el código actual:**

```powershell
docker build --target production -t davis1924/senti9:1.7.0 sentinine
```

**B. Desde el paquete que preparamos:**

```powershell
docker image load --input .\dist\senti9-1.7.0\senti9-1.7.0-linux-amd64.docker.tar
```

Antes de cargar una copia transferida, verifica sus checksums en el equipo personal.
Si tienes Python 3.11+: `python sentinine/release.py verify dist/senti9-1.7.0`.
En PowerShell también puedes calcular `Get-FileHash -Algorithm SHA256 -LiteralPath RUTA_DEL_ARCHIVO`
y comparar su valor con la línea correspondiente en `SHA256SUMS`. No uses este listado
como sustituto de una firma confiable para distribución a terceros.

Comprueba que está disponible sin iniciar nada:

```powershell
docker image inspect davis1924/senti9:1.7.0 --format '{{.Os}}/{{.Architecture}}'
```

Debe mostrar `linux/amd64`. Docker Hub no es necesario para cargar este archivo local.

## 5. Crear el agente y guardar el token

En Sentinel:

1. Entra a **Uptime & Latencia** (`/monitoring`).
2. Abre **Senti9** → **Nuevo Senti9**.
3. Nombre sugerido: **Mi PC · Laboratorio**.
4. Guarda y utiliza **Copiar token**. Se revela una sola vez.

El comando generado por la UI es una plantilla general. Para este laboratorio usa
el comando del apartado siguiente: necesita la red Docker local y HTTP de desarrollo.

En PowerShell, después de copiar el token desde esa ventana:

```powershell
New-Item -ItemType Directory -Path .secrets -Force | Out-Null
$labTokenPath = Join-Path $PWD '.secrets\senti9-personal.token'
if (Test-Path -LiteralPath $labTokenPath) { throw 'El archivo de token ya existe; no lo reemplaces si tienes pendientes.' }
$labToken = (Get-Clipboard -Raw).Trim()
if ($labToken -notmatch '^snt_live_[A-Za-z0-9_-]+$') { throw 'Copia primero el token de Senti9 desde Sentinel.' }
[IO.File]::WriteAllText($labTokenPath, $labToken, [Text.UTF8Encoding]::new($false))
Remove-Variable labToken
Set-Clipboard -Value ''
```

La carpeta `.secrets` queda fuera de Git. El token no va en el comando ni en el chat.
Se monta como archivo de solo lectura; para este laboratorio debe ser legible desde
Docker Desktop. Si el token se pierde antes de usarlo, revoca ese agente y crea otro.

## 6. Iniciar Senti9 contra Sentinel local

```powershell
$labAgentArgs = @(
  'run', '-d', '--name', 'senti9_personal_agent', '--restart', 'unless-stopped',
  '--pull', 'never', '--network', 'senti9_personal_lab',
  '--user', '10001:10001', '--read-only', '--cap-drop', 'ALL',
  '--security-opt', 'no-new-privileges:true', '--pids-limit', '128', '--memory', '256m', '--cpus', '1',
  '--tmpfs', '/tmp:rw,noexec,nosuid,size=16m,mode=1777',
  '--mount', 'source=senti9_personal_agent_state,target=/data',
  '--mount', "type=bind,source=$labTokenPath,target=/run/secrets/sentinine_token,readonly",
  '-e', 'SENTININE_TOKEN_FILE=/run/secrets/sentinine_token',
  '-e', 'SENTININE_STATE_DIR=/data',
  '-e', 'SENTININE_SERVER=http://backend:8000',
  '-e', 'SENTININE_ENV=development',
  '-e', 'SENTININE_ALLOW_HTTP=true',
  'davis1924/senti9:1.7.0'
)
docker @labAgentArgs
docker logs --tail 40 senti9_personal_agent
docker exec senti9_personal_agent python -m delivery status
```

El contenedor no publica puertos. El volumen dedicado conserva resultados entre
reinicios. No reutilices este token/volumen con un servidor distinto.

### Qué dirección significa cada cosa

| Desde dónde | Dirección | Motivo |
| --- | --- | --- |
| Navegador de Windows | `http://localhost:3001` | Frontend publicado solo en loopback |
| Navegador de Windows | `http://localhost:8000/health/` | Salud del backend local |
| Agente en la red Docker del laboratorio | `http://backend:8000` | Nombre del servicio backend; no depende de la IP de Windows |
| Agente → endpoint del ejercicio | `http://lab-target:8080` | Nombre del contenedor de prueba |
| Agente → servicio que corre directamente en Windows | `host.docker.internal:PUERTO` | Ruta de Docker Desktop hacia el host; requiere que ese servicio sea accesible |

`localhost` dentro de Senti9 apunta al propio contenedor. Además, los targets loopback
son rechazados por la política de destinos; no uses `127.0.0.1` para esquivar ese control.
La excepción HTTP anterior es **solo para desarrollo local** y requiere ambas variables.
No desactiva la verificación TLS de servicios HTTPS. Esto no valida la conexión segura
de producción, que necesitará un servidor HTTPS y certificado confiable.

## 7. Crear un endpoint de prueba dentro de Docker

Este servidor usa Python de la misma imagen, sirve una carpeta temporal vacía y no
publica puertos hacia Windows ni hacia la red doméstica:

```powershell
docker run -d --name senti9_personal_target --pull never --network senti9_personal_lab --network-alias lab-target --read-only --cap-drop ALL --security-opt no-new-privileges:true --tmpfs /tmp:rw,nosuid,nodev,size=16m davis1924/senti9:1.7.0 python -m http.server 8080 --bind 0.0.0.0 --directory /tmp
```

En **Uptime & Latencia → Nuevo Target**, configura:

| Campo | Valor |
| --- | --- |
| Nombre | `Web de laboratorio` |
| Tipo | `HTTP` |
| Endpoint | `http://lab-target:8080` |
| Ejecutor | Guardián Senti9 privado: `Mi PC · Laboratorio` |
| Frecuencia | `60 segundos` (cuota Pro del laboratorio) |
| Método / estado esperado | `GET` / `200` |
| Límite de latencia | `500 ms` |

No elijas Cloud para ese hostname privado: solo el agente en la red Docker lo resuelve.
Deja desactivado el aprovisionamiento opcional de SSL/DNS/WHOIS/seguridad si el formulario
lo ofrece: primero verifica únicamente HTTP. Este endpoint no tiene certificado ni dominio público.

## 8. Cómo comprobar que funciona

Espera el siguiente heartbeat (normalmente unos 10 segundos) y hasta uno o dos intervalos
de comprobación. Estos son criterios a comprobar, no resultados ya obtenidos en tu PC:

| Prueba | Resultado esperado |
| --- | --- |
| Directorio Senti9 | Conectado, versión 1.7.0, telemetría interna vigente |
| Primera comprobación | HTTP 200 y target operacional |
| Recepción del servidor | Fecha actualizada en el directorio |
| Acuse del agente | Fecha actualizada; por enviar vuelve a cero tras la confirmación |
| Endpoint apagado | Caído y diagnóstico; latencia actual no presentada como medición exitosa |
| Endpoint recuperado | Nueva comprobación operacional e histórico anterior conservado |

Apagar y recuperar **solo el endpoint ficticio**:

```powershell
docker stop senti9_personal_target
# Espera la siguiente comprobación y revisa Sentinel.
docker start senti9_personal_target
# Espera otra comprobación y revisa la recuperación.
```

Para comprobar persistencia, registra primero histórico y luego ejecuta:

```powershell
docker restart senti9_personal_agent
docker exec senti9_personal_agent python -m delivery status
```

El volumen/token deben mantenerse. Con la cola vacía no se demuestra retención de
pendientes: para esa propiedad existe la prueba aislada documentada de actualización/retorno.

El tipo **API** soportado aquí es el de Monitoring con ejecutor Senti9. No implica que
todos los módulos de API/SSL/WHOIS/DNS especializado se ejecuten por el agente.

## 9. Detener y volver a abrir otro día

Detener conservando datos:

```powershell
docker stop senti9_personal_agent senti9_personal_target
docker compose @labArgs stop
```

Reabrir desde la misma carpeta, redefiniendo `$labArgs` si cambiaste de ventana:

```powershell
docker compose @labArgs up -d db redis backend frontend celery_worker celery_beat
docker start senti9_personal_target senti9_personal_agent
```

No necesitas volver a crear la cuenta, el agente ni el token. Los nombres de contenedor
ya existentes se reinician con `docker start`; no repitas `docker run` con el mismo nombre.
Los volúmenes guardan el histórico y el diario. El borrado de datos no forma parte de esta guía.

## 10. Problemas frecuentes

| Síntoma | Revisar |
| --- | --- |
| Compose rechaza `!override` | Versión 2.24.4+; actualizar Docker Desktop/Compose |
| Puerto ocupado | Otra instalación en 3001/8000. No detenerla sin identificarla; elegir otros puertos y ajustar frontend/guía en conjunto |
| UI no abre | `docker compose @labArgs ps` y logs frontend/backend; primer build pendiente |
| No permite crear agente | Organización correcta, cuenta admin ficticia y ajuste Pro solo del laboratorio |
| Agente desconectado | Backend healthy, ambos en `senti9_personal_lab`, token correcto y `ALLOWED_HOSTS` con `backend` |
| Rechaza HTTP | Ambas variables development/ALLOW_HTTP, y servidor `http://backend:8000` |
| Archivo de token inválido | Copia completa sin espacios, archivo montado de solo lectura, ruta absoluta, sin extensión adicional |
| `pull access denied` | La imagen aún no está publicada: construir o usar `docker image load`; el comando del agente lleva `--pull never` |
| `name already in use` | Ya existe ese contenedor; usar start o inspeccionarlo antes de sustituirlo |
| Target no resuelve | Ejecutor Senti9 correcto y alias `lab-target` en la misma red |
| Agente conectado pero sin acuse | Crear target asignado; conectado solo acredita heartbeat; revisar cola y diagnósticos |
| Todos los valores históricos viejos | Agente detenido, intervalo aún no vencido o reporte desactualizado; revisar fechas |
| SMTP no funciona | Este laboratorio no configura correo. Entrega SMTP/notificaciones externas es una verificación separada |

Logs útiles sin volcar secretos de configuración:

```powershell
docker logs --tail 60 senti9_personal_agent
docker compose @labArgs logs --tail 60 backend celery_worker celery_beat
docker exec senti9_personal_agent python -m delivery status
```

## 11. Si ya tienes Sentinel en otro servidor

No necesitas levantar otra plataforma local. Usa el token emitido por **ese** servidor,
su URL HTTPS real y la instalación de `sentinine/README.md`. El equipo debe poder
alcanzar tanto Sentinel como los endpoints que monitoreará; el agente inicia conexiones
salientes y no requiere publicar un puerto de escucha propio. Esa prueba necesita
infraestructura autorizada. Tener el dominio en Cloudflare, por sí solo, no ejecuta Sentinel.

## Validación de esta guía

Se comprobó con `docker compose ... config --format json`, usando `.env.example`
y sin arrancar contenedores: proyecto `senti9-personal`, frontend `127.0.0.1:3001`,
backend `127.0.0.1:8000`, PostgreSQL/Redis sin publicación y red `senti9_personal_lab`.
Los 17 bloques PowerShell pasaron el parser de PowerShell; `.secrets/` está ignorado
por Git. Esto valida configuración y sintaxis, no acredita ejecución de los pasos,
conectividad real, compatibilidad de todas las versiones de Windows ni prueba de producción.
Los conteos de Django/agente/build del inicio corresponden al bloque anterior.

## Referencias oficiales

- [Combinación de archivos y `!override`](https://docs.docker.com/reference/compose-file/merge/).
- [Redes y nombres de servicios en Compose](https://docs.docker.com/compose/how-tos/networking/).
- [Acceso al host con Docker Desktop](https://docs.docker.com/desktop/features/networking/networking-how-tos/).
