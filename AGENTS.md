# Sentinel — contexto operativo para agentes

Sentinel es una plataforma SaaS multi-tenant de observabilidad NOC/SRE. La fuente de verdad es el código y la documentación de [docs](docs/README.md).

## Arquitectura vigente

- Backend: Django 5.2.17 + Django REST Framework + Celery.
- Frontend: React 18 + TypeScript + Vite; desarrollo en `http://localhost:3001`.
- Datos: PostgreSQL 16. TimescaleDB no es un componente activo.
- Caché y broker: Redis 7.
- Logs: Grafana Alloy descubre contenedores y envía a Loki.
- Red privada: los targets internos deben ejecutarse mediante Guardianes Sentinine.
- Producción: TLS termina en Nginx; el despliegue usa una ventana de corte controlada.

## Reglas de implementación

- Mantener aislamiento por `organization_id`.
- Toda salida HTTP configurable debe usar `common.safe_http`; nunca seguir redirecciones.
- No confiar en `X-Forwarded-For` salvo que `REMOTE_ADDR` esté en `TRUSTED_PROXY_CIDRS`.
- Los endpoints individuales `/scan/` devuelven 202 y nunca un recurso obsoleto.
- Los secretos de API se almacenan como hash y se revelan una sola vez.
- La retención elimina históricos, nunca configuraciones.
- Ejecutar pruebas Django completas y build frontend antes de declarar un gate superado.
- No afirmar producción lista ni Playwright validado sin evidencia de CI.

## Documentos principales

- [Inventario real](docs/MODULE_INVENTORY.md)
- [Pruebas](docs/TESTING_STRATEGY.md)
- [Seguridad de producción](docs/PRODUCTION_SECURITY.md)
- [Readiness](docs/PRODUCTION_READINESS.md)
- [Go-live](docs/GO_LIVE_CHECKLIST.md)
