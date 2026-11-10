# Migración de autorización en el entorno local

Aplicada el 9 de noviembre de 2026, por solicitud del usuario, después de completar la validación aislada de F01–F09.

- Entorno: proyecto Compose `sentinela`, backend `sentinel_backend`, PostgreSQL `sentinel_db`, base `sentinel`, API local en el puerto 8000.
- Única migración pendiente: `accounts.0010_user_authorization_mode`.
- Ejecución: `python manage.py migrate accounts 0010_user_authorization_mode --noinput`, terminada con `OK`.
- Resultado: 157 usuarios en `legacy`, cero en `custom`. Las huellas antes/después de organización, privilegios administrativos, estado activo, versiones de sesión, asignaciones de roles y permisos de roles coinciden.
- Comprobaciones: `migrate --check --noinput` sin pendientes; `check --database default` sin problemas; `/health/` HTTP 200 con PostgreSQL, Redis, broker y workers saludables.

## Respaldo previo

Se generó un respaldo completo en formato PostgreSQL CUSTOM antes de migrar. `pg_restore --list` reconoció el archivo; la copia local coincide mediante SHA256 con el original del contenedor. No se realizó una restauración.

- Archivo local: `backups/sentinel_pre_auth_0010_20261109_hz4q2sda.dump`, excluido de Git.
- SHA256: `afedb3a16548848dff09bd10fc8092178573b0c3562447b10d7812b7f0a8dfef`.
- Los respaldos anteriores se conservaron.

Esta operación no activó permisos personalizados ni desplegó cambios en servicios externos. La administración podrá activar los permisos por usuario mediante el flujo auditado de Roles y permisos.
