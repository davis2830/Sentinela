# Seguridad para el despliegue de Sentinel

El `docker-compose.yml` de este repositorio configura un entorno de desarrollo: usa Vite, expone PostgreSQL y Redis, y ejecuta Gunicorn con `--reload`. No debe publicarse directamente en Internet. El despliegue de producción necesita un proxy TLS, puertos internos para backend y servicios de datos, y una imagen estática del frontend.

## Variables obligatorias

- `DJANGO_SETTINGS_MODULE=config.settings.prod` en backend, Celery worker y Celery beat.
- `SECRET_KEY`: valor aleatorio y estable de al menos 50 caracteres, almacenado fuera del repositorio. La configuración de producción rechaza la clave de ejemplo.
- `ALLOWED_HOSTS`: nombres concretos separados por comas, sin esquema ni `*` (por ejemplo, `api.example.com`).
- `POSTGRES_PASSWORD`: credencial fuerte y distinta de la usada en desarrollo.

## HTTPS, origen y proxy

- `SECURE_HSTS_SECONDS` empieza en `3600` segundos. Aumentarlo gradualmente tras comprobar HTTPS en el dominio real. El encabezado HSTS se envía solo en respuestas que Django considera seguras.
- `SECURE_HSTS_INCLUDE_SUBDOMAINS` y `SECURE_HSTS_PRELOAD` permanecen desactivados por defecto. Activar subdominios solo cuando **todos** se sirvan por HTTPS. Preload requiere además `SECURE_HSTS_SECONDS >= 31536000` y una decisión explícita sobre el dominio completo.
- `TRUST_X_FORWARDED_PROTO=true` solo si el proxy TLS elimina cualquier encabezado `X-Forwarded-Proto` recibido del cliente y establece su propio valor. Evitar acceso público directo al backend en esa configuración.
- `CORS_ALLOWED_ORIGINS`: orígenes exactos del frontend con esquema `https://`; vacío si frontend y API comparten origen.
- `CSRF_TRUSTED_ORIGINS`: orígenes HTTPS que deban enviar peticiones protegidas por CSRF. No sustituye a `CORS_ALLOWED_ORIGINS`.

La revisión `python manage.py check --deploy --settings=config.settings.prod` puede mostrar `security.W005` y `security.W021` mientras subdominios y preload sigan desactivados. Es una decisión deliberada hasta verificar toda la infraestructura HTTPS. No se silencian esas advertencias.

Antes de publicar, ejecutar el chequeo con las variables **reales** del despliegue y verificar una respuesta HTTPS: redirección HTTP, cookie `Secure`, encabezado `Strict-Transport-Security` y orígenes CORS permitidos. El chequeo local con valores de ejemplo no sustituye esa validación.
