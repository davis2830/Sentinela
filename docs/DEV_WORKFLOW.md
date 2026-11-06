# Flujo de desarrollo

Para una instalación personal nueva de Sentinel + Senti9, usar la
[guía de laboratorio local](SENTI9_PERSONAL_LAB.md). Incluye un override separado
con puertos loopback, cuenta ficticia, cuota de agente y endpoint Docker de prueba.

## Inicio

En un equipo nuevo, copiar `.env.example` a `.env` **solo si no existe**:

```powershell
if (-not (Test-Path -LiteralPath .env)) { Copy-Item -LiteralPath .env.example -Destination .env }
```

Editar la copia privada antes del primer arranque: generar un `SECRET_KEY` propio y
una contraseña PostgreSQL; configurar SMTP y el remitente para probar verificación
e invitaciones. Gmail requiere una contraseña de aplicación. Sin SMTP configurado
no se valida entrega de correo. Turnstile requiere sus propias claves y hostnames
permitidos para validar la integración real.

Para generar una clave en tu terminal (no compartir su salida):

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

La URL local es `PUBLIC_APP_URL=http://localhost:3001`; la API para el navegador es
`VITE_API_URL=http://localhost:8000/api/v1`. Si cambias el puerto frontend, actualiza
también el origen público, CORS y CSRF. El override personal fija el puerto 3001.
El dominio HTTPS de producción corresponde a una instalación distinta.

Si ya tienes `.env`, incorporar únicamente claves faltantes revisando la plantilla;
no reemplazar credenciales ni claves de cifrado. Al restaurar datos cifrados se
necesitan las claves originales. Las plantillas no transfieren la BD, la admisión
beta, cuentas, planes ni secretos de otro equipo. La configuración del agente
Sentinine se prepara por separado según la guía del laboratorio.

Compose interpola `.env`, pero solo transmite al contenedor las variables
declaradas en `environment`. Las opciones compartidas ahora se transmiten a Django,
worker y Beat; las direcciones internas de BD/Redis y JWT de 15 minutos / 7 días
son fijas en Compose. `POSTGRES_HOST`, `POSTGRES_PORT`, `REDIS_HOST`, `REDIS_PORT`
y las URL Celery de la plantilla documentan esa topología; se pueden usar al
ejecutar procesos fuera de Docker ajustándolas a direcciones accesibles.
`REDIS_PASSWORD` y `REDIS_CACHE_URL` comentadas son opciones para procesos nativos,
no habilitan autenticación en el Redis de Compose local. `PROMETHEUS_URL` se retiró
de la plantilla porque actualmente el backend no la lee.

Comprobar las plantillas sin usar secretos ni iniciar contenedores:

```powershell
docker compose --env-file .env.example config --quiet
docker compose --env-file .env.example -f docker-compose.yml -f docker-compose.personal.yml config --quiet
docker compose --env-file .env.production.example -f docker-compose.prod.yml config --quiet
```

El último comando comprueba estructura e interpolación, no certificados, SMTP,
Turnstile, acceso a GHCR ni readiness real. Los placeholders de producción deben
reemplazarse antes del uso. Al cambiar variables transmitidas a un contenedor,
recrearlo; reconstruir una imagen por sí solo no actualiza su entorno.

```powershell
docker compose up -d --build
docker compose exec backend python manage.py migrate
```

Frontend: `http://localhost:3001`. API: `http://localhost:8000/api/v1/`.

## Validaciones obligatorias

```powershell
docker compose exec -T backend python manage.py check
docker compose exec -T backend python manage.py makemigrations --check --dry-run
docker compose exec -T backend python manage.py test
docker compose exec -T frontend npm run build
docker compose config --quiet
```

Para producción, valide además `docker compose -f docker-compose.prod.yml config --quiet`, ambos Dockerfiles y `nginx -t`.

## Seguridad

- Use `common.safe_http` para HTTP saliente configurable.
- No añada excepciones localhost ni desactive TLS.
- Los destinos privados pertenecen a Sentinine.
- Ejecute `python manage.py quarantine_unsafe_targets` primero sin `--apply`.
- No registre tokens, credenciales, cabeceras de autorización ni archivos `.env`.

## Auditoría aislada y repetible

No ejecutar escenarios de carga o fixtures sobre el Compose operativo. Usar
`docker-compose.audit.yml` como archivo independiente, con un nombre de proyecto
único, una BD `sentinel_audit` propia y puertos loopback 31800/31801. No importa
tu `.env`: los ejemplos siguientes indican explícitamente la plantilla pública.

```powershell
$auditArgs = @('--env-file', '.env.example', '-p', 'sentinel-audit-local', '-f', 'docker-compose.audit.yml')
docker compose @auditArgs build backend
docker compose @auditArgs run --rm backend python manage.py test
docker compose @auditArgs run --rm backend python manage.py migrate --noinput
docker compose @auditArgs run --rm -e SENTINEL_E2E_FIXTURE=1 backend python manage.py seed_e2e_accounts --suffix audit-local
docker compose @auditArgs up -d backend celery_worker
```

Para Chromium, iniciar Vite en otra terminal dentro de `frontend/`, con
`VITE_API_URL=http://127.0.0.1:31800/api/v1` y puerto 31801. En la terminal de
pruebas configurar `E2E_BASE_URL=http://127.0.0.1:31801`,
`E2E_API_URL=http://127.0.0.1:31800/api/v1` y `E2E_FIXTURE_SUFFIX=audit-local`;
ejecutar `npm run test:e2e`. Las repeticiones deben usar fixtures nuevas por ejecución
para no mezclar datos ni agotar el presupuesto de login de un correo; no limpiar
presupuestos ni deshabilitar controles de autenticación.

El escenario `07_module_read_audit.js` tiene dataset y guard propios. Preparar otra
fixture con sufijo `audit-perf-<ejecucion>` mediante `seed_e2e_accounts`, ejecutar
`tests_perf/seed_audit_dataset.py` por `manage.py shell` con `SENTINEL_E2E_FIXTURE=1`
y `AUDIT_FIXTURE_SUFFIX` igual al sufijo. k6 recibe `PERF_FIXTURE_SUFFIX` y accede
solo al backend de la red de auditoría. El script genera Pro sintético, 25 recursos
por módulo y 2.500 checks sin tareas ni correos. No prueba cuotas de alta: estas
se validan por separado en Django. Ver [evidencia y límites](AUDIT_HARDENING_2026-11-04.md).

Para smoke productivo, construir imágenes locales `sentinel-audit-backend:local`,
`sentinel-audit-frontend-prod:local` y `sentinel-audit-gateway:local` desde sus
Dockerfiles. Generar certificados **de prueba** para localhost en `.tmp/audit-tls/`.
Combinar exclusivamente `docker-compose.prod.yml` y `docker-compose.audit.prod.yml`
con `--env-file .env.production.example` y otro proyecto `sentinel-prod-audit-*`;
el override sustituye nombres, imágenes, secretos por fixtures y puertos.
Migrar su BD nueva y levantar `backend celery_worker frontend nginx`. Después:

```bash
bash scripts/smoke-production.sh sentinel-prod-audit-mi-ejecucion
```

El script valida el certificado, TLS 1.2/1.3, redirección, HSTS, rutas y backend
sin puerto host; detiene/reinicia **solo el worker ficticio** para comprobar 503
y recuperación. Se niega a operar sobre nombres que no sean de auditoría.
No sustituye el smoke con dominio/certificado de preproducción.

Retirar cada fixture con `seed_e2e_accounts --suffix <sufijo> --cleanup`, su flag
E2E y el mismo proyecto; el comando exige nombre/usuarios exactos y conserva la
auditoría. Después ejecutar `docker compose ... down` sin `-v` si se debe conservar
la BD de auditoría. Nunca reutilizar esos comandos contra organizaciones reales.

## Higiene del repositorio

- La aplicación web está en `frontend/`: conservar su `package.json`, `package-lock.json`, entrada HTML, código, pruebas y recursos utilizados. No añadir prototipos raíz ni lockfiles sin manifiesto.
- No versionar backups, volcados de BD, `__pycache__`, bytecode, dependencias, builds, logs, capturas, trazas, cobertura ni configuraciones privadas. Los `.dockerignore` sí son código de configuración y se versionan.
- Las capturas/reportes del navegador pertenecen a artefactos de CI o carpetas locales ignoradas, no al historial de código. Los escenarios, fixtures aislados y migraciones se conservan.
- Conservar evidencia histórica de rendimiento solo saneada: nunca exportar tokens de `setup()`. El escenario local k6 genera JSON mediante `handleSummary`; no usar `--summary-export` con escenarios autenticados.
- Ejecutar desde `frontend/`: `npm run test:repo-guard` y `npm run check:repo`. CI ejecuta ambos. El guard rechaza rutas generadas/sensibles y JWT serializados sin mostrar sus valores; no sustituye una auditoría de historial o de backups.
- La limpieza del 2026-11-01 conserva 20 archivos obsoletos únicamente en `.local-archive/repo-hygiene-2026-11-01/`, ignorado por Git. Backups y capturas conservan su copia local. No restaurar el antiguo script E2E contra la BD de desarrollo; usar las pruebas aisladas de `backend/monitoring/`.
- Esta limpieza prepara cambios locales, no elimina lo ya publicado en GitHub: el dump y el JWT histórico requieren tratamiento separado del historial y revisión de secretos afectados. No reescribir historial ni cambiar visibilidad sin aprobación.

## Migraciones

La migración de APIToken revoca los tokens plaintext existentes. Antes de aplicarla en producción se requiere respaldo y comunicación de regeneración.
