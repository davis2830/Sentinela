# Sentinel — contexto operativo para agentes

Sentinel es una plataforma SaaS multi-tenant de observabilidad NOC/SRE. La fuente de verdad es el código y la documentación de [docs](docs/README.md).

## Arquitectura vigente

- Backend: Django 5.2 + Django REST Framework + Celery. Versiones fijadas en [constraints.txt](backend/requirements/constraints.txt).
- Frontend: React 18 + TypeScript + Vite; desarrollo en `http://localhost:3001`.
- Datos: PostgreSQL 16. TimescaleDB no es un componente activo.
- Caché y broker: Redis 7.
- Logs: Grafana Alloy descubre contenedores y envía a Loki.
- Red privada: los targets internos deben ejecutarse mediante Guardianes Sentinine.
- Producción: TLS termina en Nginx; el despliegue usa una ventana de corte controlada.

## Mapa del código

- **Frontend.** [App.tsx](frontend/src/App.tsx) registra las rutas. Las pantallas viven en `frontend/src/pages/` y sus componentes en `frontend/src/components/`. El portal usa [api.ts](frontend/src/services/api.ts) y la consola usa [platformApi.ts](frontend/src/services/platformApi.ts) con su propia sesión.
- **Backend.** [urls.py](backend/config/urls.py) monta [api_urls.py](backend/config/api_urls.py) bajo `/api/v1/`. Sigue el include al módulo correspondiente para encontrar sus vistas, modelos y pruebas.
- **Operación.** [Compose local](docker-compose.yml) y [Compose productivo](docker-compose.prod.yml) describen cada entorno. Celery Beat agenda tareas, Redis entrega los trabajos a los workers y Alloy recolecta los logs hacia Loki. El agente privado vive en [sentinine/](sentinine/README.md).

Para confirmar una capacidad, cruza el código y la prueba de la revisión que estás usando. Las auditorías fechadas conservan evidencia histórica. [Índice por área](docs/README.md).

## Reglas de implementación

- Mantener aislamiento por `organization_id`.
- Toda salida HTTP configurable debe usar `common.safe_http`; nunca seguir redirecciones.
- No confiar en `X-Forwarded-For` salvo que `REMOTE_ADDR` esté en `TRUSTED_PROXY_CIDRS`.
- Los endpoints individuales `/scan/` devuelven 202 y nunca un recurso obsoleto.
- Los secretos de API se almacenan como hash y se revelan una sola vez.
- La retención elimina históricos, nunca configuraciones.
- Ejecutar pruebas Django completas y build frontend antes de declarar un gate superado.
- No afirmar producción lista ni Playwright validado sin evidencia de CI.
- Para cambios de interfaz, seguir [el estándar UI/UX](docs/UI_STANDARD.md): vista operativa completa al entrar, métricas compactas legibles, identidad existente y estados desconocidos explícitos. En la ficha, gráfica y vínculos deben caber juntos en la primera pantalla de escritorio.

## Documentos principales

- [Inventario real](docs/MODULE_INVENTORY.md)
- [Pruebas](docs/TESTING_STRATEGY.md)
- [Seguridad de producción](docs/PRODUCTION_SECURITY.md)
- [Readiness](docs/PRODUCTION_READINESS.md)
- [Go-live](docs/GO_LIVE_CHECKLIST.md)
- [Estándar UI/UX](docs/UI_STANDARD.md)
