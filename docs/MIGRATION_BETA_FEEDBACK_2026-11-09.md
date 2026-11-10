# Migración de enlaces de Beta en el entorno local

Aplicada el 9 de noviembre de 2026, America/Guatemala, tras reproducir el error de Resumen en el entorno habitual.

## Causa y corrección

El frontend actualizado ya se servía desde sentinel_frontend, pero accounts.0011_betacontrol_feedback_links seguía pendiente en sentinel_backend. La consulta de BetaControl fallaba por la columna inexistente feedback_submission_url. Los logs del GET /api/v1/platform-admin/beta/overview/ confirmaron ProgrammingError/UndefinedColumn.

Se aplicó únicamente accounts.0011 con migrate accounts 0011_betacontrol_feedback_links --noinput. Añade feedback_submission_url y feedback_management_url, ambos inicialmente vacíos. No contiene migraciones de datos ni modificaciones de acceso, permisos, clientes, planes o suscripciones.

## Respaldo previo

- PostgreSQL CUSTOM: backups/sentinel_pre_beta_0011_20261109_qqp16rac.dump, excluido de Git.
- SHA256: 04b7102d75a845377f1d1d3d696230e09b7ac1a3f1c045cf1a08377e61bb5e68.
- pg_restore --list reconoció el archivo; la copia local coincide con el archivo del contenedor mediante SHA256. No se realizó una restauración ni se purgaron respaldos anteriores.

## Comprobación

- Entorno: Compose sentinela, sentinel_backend / sentinel_db, base sentinel.
- Plan previo: sólo dos campos añadidos a BetaControl.
- Estado final: accounts.0011 [X]; migrate --check --noinput sin pendientes.
- check --database default sin problemas.
- BetaControl conservó id=1, capacity=1 y admissions_open=true. Ambos enlaces quedaron vacíos.
- Los manejadores GET de BetaOverviewView y BetaAdminView devolvieron 200 contra la base real del contenedor mediante solicitudes internas de sólo lectura; directorio con page_size=25. No se forzó una sesión ni se omitió 2FA en el servidor HTTP.
- GET HTTP sin credenciales a beta/overview/ sigue devolviendo 401.
- No se ejecutó una nueva sesión autenticada de navegador ni una suite de pruebas sobre datos habituales.
- No se enviaron correos ni se reiniciaron servicios. No hubo cambios de código de aplicación en esta corrección.

El procedimiento aislado y su validación previa se conservan en [la entrega funcional](PLATFORM_BETA_CONSOLE_2026-11-09.md). Su indicación de migración pendiente describe el estado anterior a esta aplicación.
