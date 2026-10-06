# Seguridad de producción

## Perímetro

Nginx es el único servicio publicado. Escucha 443 con TLS 1.2/1.3, redirige 80 a HTTPS y emite HSTS únicamente por HTTPS. Certificado y llave se montan desde `TLS_CERT_PATH` y `TLS_KEY_PATH`.

La red productiva usa `172.30.0.0/24`; el gateway tiene `172.30.0.10`. Django confía solo en `172.30.0.10/32` mediante `TRUSTED_PROXY_CIDRS`, y Nginx sobrescribe `X-Forwarded-For` con `$remote_addr`.

## Salida de red

`common.safe_http` acepta solo HTTP(S), prohíbe credenciales embebidas, valida puerto y todas las IP resueltas, bloquea loopback, RFC1918, link-local, metadata cloud, multicast y rangos no globales, y nunca sigue redirecciones. La conexión se fija a una IP ya validada, conservando el hostname para `Host`, SNI y validación TLS, con lo que se evita una segunda resolución vulnerable a DNS rebinding. API Checks, Security Headers, diagnósticos de Monitoring y webhooks usan ese cliente. Blackbox también tiene `follow_redirects: false`.

Los targets privados deben ejecutarse mediante Sentinine. `quarantine_unsafe_targets` es dry-run por defecto y audita cada cambio con `--apply`.

## Identidad

Los API tokens se guardan como SHA-256 más prefijo; el secreto se devuelve una sola vez al crearlo. La migración revoca todos los tokens plaintext anteriores.

`POST /api/v1/auth/revoke-sessions/` exige `current_refresh_token`, conserva su JTI y falla cerrado si el blacklist no puede completarse. Los access tokens ya emitidos pueden vivir hasta 15 minutos.

## Datos

PostgreSQL 16 es la base oficial. `purge_telemetry` aplica `metrics_retention_days` por organización y elimina solo históricos de Monitoring, API Checks, Security Headers y DNS. TimescaleDB no está activo.
