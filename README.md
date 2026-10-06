# Sentinel

Plataforma multi-tenant de observabilidad NOC/SRE con monitoreo HTTP/TCP/DNS, certificados TLS, WHOIS, API Checks, cabeceras de seguridad, alertas, incidentes, reportes y probes privados Sentinine.

## Estado verificable

La rama contiene hardening de proxy y SSRF, API tokens con hash, revocación transaccional de sesiones, scans asíncronos, retención tenant-aware, topología TLS de producción y recolección de logs con Grafana Alloy. La aprobación de producción sigue condicionada a los gates de [PRODUCTION_READINESS](docs/PRODUCTION_READINESS.md).

## Desarrollo local

```powershell
Copy-Item .env.example .env
docker compose up -d --build
docker compose exec backend python manage.py migrate
```

- Frontend: http://localhost:3001
- API: http://localhost:8000/api/v1/
- Health: http://localhost:8000/health/
- Loki: http://localhost:3100

No use targets privados con el runner cloud. Asígnelos a un Guardián Sentinine.

## Producción

Copie [.env.production.example](.env.production.example), configure imágenes GHCR inmutables, secretos y rutas de certificado/llave. El gateway Nginx redirige HTTP a HTTPS y es el único punto expuesto. Consulte [GO_LIVE_CHECKLIST](docs/GO_LIVE_CHECKLIST.md).

## Documentación

El índice mantenido está en [docs/README.md](docs/README.md). Los documentos bajo `.clinerules/` están retirados y solo redirigen a la documentación vigente.
