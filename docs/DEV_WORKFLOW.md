# Flujo de desarrollo

Para una instalación personal nueva de Sentinel + Senti9, usar la
[guía de laboratorio local](SENTI9_PERSONAL_LAB.md). Incluye un override separado
con puertos loopback, cuenta ficticia, cuota de agente y endpoint Docker de prueba.

## Inicio

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
