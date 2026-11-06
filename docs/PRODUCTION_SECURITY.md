# Seguridad de producción

## Perímetro

Nginx es el único servicio publicado. Escucha 443 con TLS 1.2/1.3, redirige 80 a HTTPS y emite HSTS únicamente por HTTPS. Certificado y llave se montan desde `TLS_CERT_PATH` y `TLS_KEY_PATH`.

La consola SaaS usa un listener de Nginx publicado en `127.0.0.1:8081` del host. El gateway público rechaza las rutas administrativas. La publicación externa de la consola requiere los controles y la validación de [Acceso a Administración SaaS](PLATFORM_ACCESS.md).

El gateway se construye desde `docker/nginx/Dockerfile`, aplica parches Alpine e
incluye su configuración en la imagen. Configurar `GATEWAY_IMAGE` junto con
`BACKEND_IMAGE`, `FRONTEND_IMAGE` e `IMAGE_TAG`; las tres imágenes comparten el tag
inmutable del release. No sustituir el gateway parcheado por la imagen upstream
sin repetir el escaneo. Nginx corre como usuario `nginx` (UID/GID 101): la llave
real debe ser legible por ese grupo, por ejemplo propietario `root:101` y modo
`0440`. Mantener esos permisos al renovar el certificado. Nunca versionar la llave.

Backend corre como UID 10001 y el frontend productivo como `nginx`. El puerto
8080 del gateway es liveness ligado exclusivamente a loopback, sin publicación.
La ruta exacta `/health/` de Django admite el probe HTTP interno; las demás rutas
mantienen la redirección TLS. Readiness continúa exigiendo BD, caché, broker y worker.

CD publica imágenes, pero desplegar exige ejecución manual explícita, CI aprobado
para el mismo SHA y el entorno GitHub `production`. Configurar revisores obligatorios
en ese entorno es un gate externo; nombrarlo en YAML no configura por sí solo esa
aprobación. El backup previo es PostgreSQL custom con checksum y catálogo verificado.
Solo `MIGRATION_IRREVERSIBLE=true`, aprobado previamente, habilita restauración en
rollback: detiene aplicaciones, recrea la BD y restaura con errores fatales antes
de levantar imágenes anteriores. Probar esa ruta en preproducción antes de usarla.

La red productiva usa `172.30.0.0/24`; el gateway tiene `172.30.0.10`. Django confía solo en `172.30.0.10/32` mediante `TRUSTED_PROXY_CIDRS`, y Nginx sobrescribe `X-Forwarded-For` con `$remote_addr`.

## Salida de red

`common.safe_http` acepta solo HTTP(S), prohíbe credenciales embebidas, valida puerto y todas las IP resueltas, bloquea loopback, RFC1918, link-local, metadata cloud, multicast y rangos no globales, y nunca sigue redirecciones. La conexión se fija a una IP ya validada, conservando el hostname para `Host`, SNI y validación TLS, con lo que se evita una segunda resolución vulnerable a DNS rebinding. API Checks, Security Headers, sondeos HTTP cloud de Monitoring, diagnósticos y webhooks usan ese cliente. Los sondeos TCP cloud conectan a una IP literal validada; HTTP/TCP ya no delegan el hostname a Blackbox. Blackbox conserva `follow_redirects: false` para sus usos independientes.

Los targets privados deben ejecutarse mediante Sentinine. `quarantine_unsafe_targets` es dry-run por defecto y audita cada cambio con `--apply`.

## Identidad

Los API tokens se guardan como SHA-256 más prefijo; el secreto se devuelve una sola vez al crearlo. La migración revoca todos los tokens plaintext anteriores.

`POST /api/v1/auth/revoke-sessions/` exige `current_refresh_token`, conserva su JTI y falla cerrado si el blacklist no puede completarse. Los access tokens ya emitidos pueden vivir hasta 15 minutos.

## Datos

PostgreSQL 16 es la base oficial. `purge_telemetry` aplica `metrics_retention_days` por organización y elimina solo históricos de Monitoring, API Checks, Security Headers y DNS. TimescaleDB no está activo.
