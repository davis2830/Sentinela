# Flujo de desarrollo

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

## Migraciones

La migración de APIToken revoca los tokens plaintext existentes. Antes de aplicarla en producción se requiere respaldo y comunicación de regeneración.
