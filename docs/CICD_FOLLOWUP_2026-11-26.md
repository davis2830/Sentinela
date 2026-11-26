# CI/CD & Playwright E2E — Pendientes (2026-11-26)

## Estado actual

- **CI (`.github/workflows/ci.yml`):** operativo y en verde en cada `push` / `pull_request` con 5 jobs bloqueantes (~5–7 min):
  1. `frontend` — TypeScript, ESLint, Prettier, repo guards, contratos OpenAPI, build y `npm audit`.
  2. `backend` — Ruff, Flake8, contratos API (`docs/reference-api.json`) y 418 tests de Django (PostgreSQL + Redis).
  3. `senti9` — validación de `install.sh` e `install.ps1`, tests sin red, verificación sin privilegios (`uid 10001`) y escaneo Trivy de `senti9-runtime:ci`.
  4. `devsecops` — `pip-audit` y Trivy sobre configuraciones/Dockerfiles.
  5. `infrastructure` — validación de `docker-compose.prod.yml`, build y escaneo Trivy de imágenes `backend`, `frontend` y `gateway` (`nginx:1.30.7-alpine`), `nginx -t` y smoke test de producción.
- **Playwright E2E (`e2e` en `ci.yml`):** configurado como **manual** (`workflow_dispatch` → `run_e2e: true`) o **semanal** (`schedule` lunes 09:00 UTC), con `continue-on-error: true` y retención de reporte de **7 días** para ahorrar minutos y almacenamiento en repositorio privado.
- **CD (`.github/workflows/cd.yml`):** configurado para dispararse **solo manualmente** (`workflow_dispatch`) o por **tag** (`v*.*.*` para Sentinel, `senti9-v*.*.*` para el agente Senti9).
- **`sentinel_probe/`:** validado como legado de compatibilidad (no usado en CI/CD; el agente activo es `sentinine/` / Senti9).

---

## Pendiente 1: Activar CD hacia producción y publicación de Senti9

### 1.1 Configuración en GitHub (`Settings → Environments` y `Secrets and variables → Actions`)

- [ ] Crear el Environment **`production`** (recomendado: activar *Required reviewers* para aprobar antes de cada despliegue).
- [ ] Cargar los **Secrets** de despliegue:
  - `PROD_SSH_PRIVATE_KEY` — llave privada SSH con acceso al servidor de producción.
  - `PROD_SERVER_HOST` — IP o dominio del servidor.
  - `PROD_SERVER_USER` — usuario SSH (ej. `deploy` o `ubuntu`).
  - `PROD_HEALTHCHECK_URL` — endpoint público de salud (ej. `https://sentinel.gctechops.com/health/`).
- [ ] Cargar la **Variable** de Actions:
  - `PRODUCTION_URL` — URL pública de la aplicación (ej. `https://sentinel.gctechops.com`).
- [ ] *(Opcional, solo si se desea publicar Senti9 también en Docker Hub además de GHCR)* cargar los **Secrets**:
  - `DOCKERHUB_USERNAME`
  - `DOCKERHUB_TOKEN`

### 1.2 Preparación del servidor de producción (`/opt/sentinel-noc`)

- [ ] Verificar que `/opt/sentinel-noc` contenga `docker-compose.prod.yml` y `.env`.
- [ ] Confirmar que en `.env` las imágenes de GHCR estén en **minúsculas**:
  - `BACKEND_IMAGE=ghcr.io/davis2830/sentinela/backend`
  - `FRONTEND_IMAGE=ghcr.io/davis2830/sentinela/frontend`
  - `GATEWAY_IMAGE=ghcr.io/davis2830/sentinela/gateway`
- [ ] Ejecutar una prueba controlada de despliegue desde **Actions → Sentinel NOC - CD Production Deployment Pipeline → Run workflow** (`build_images: true`, `deploy_production: true`).
- [ ] Para publicar una nueva versión de Senti9, crear un tag `senti9-vX.Y.Z` o disparar **Run workflow** con `publish_senti9: true` (`build_images: false`) y copiar el digest `@sha256:...` generado en el *Job Summary* hacia `SENTI9_IMAGE`.

---

## Pendiente 2: Dejar Playwright E2E en verde y volverlo bloqueante

> **Regla de seguridad:** **NO** desactivar ni relajar el rate-limit `429` (`consume_budget("login-email", ..., 15, 900)`) en `backend/accounts/views.py`. El problema está en que los specs hacen login repetidas veces en lugar de reutilizar sesión.

### 2.1 Eliminar los `429 Too Many Requests` en Playwright

- [ ] Crear un proyecto `setup` (o `globalSetup`) en `frontend/playwright.config.ts` que inicie sesión **una sola vez por rol** (`admin` y `viewer` = 2 logins totales para toda la corrida) y guarde el estado en `storageState` (`playwright/.auth/admin.json` y `playwright/.auth/viewer.json`).
- [ ] Migrar los helpers `login()` de los specs en `frontend/e2e/` para reutilizar ese `storageState` (evitando nuevos `POST /api/v1/auth/login/` en cada archivo o retry).

### 2.2 Actualizar los specs al rediseño reciente de UI

Actualizar selectores y assertions que quedaron desalineados tras la homologación/rediseño de tablas compactas y módulos (SSL, DNS, Domains, Monitoring y Senti9):

- [ ] `frontend/e2e/connectivity-consistency.spec.ts` (ej. tamaño de checkbox compacto `24px` vs `44px` esperado en línea 261, estructura de `[aria-hidden="true"]` en `monitoring`/`ssl`, Uptime cards, menú vacío y paginación).
- [ ] `frontend/e2e/connectivity-health-palette.spec.ts` (`ssl uses measured health colors independently of brand`).
- [ ] `frontend/e2e/connectivity-senti9.spec.ts` (flujo de registro/archivo de token/primera señal).
- [ ] `frontend/e2e/critical-flows.spec.ts` (`login loads the dashboard`).
- [ ] `frontend/e2e/senti9-installation-ux.spec.ts` (vista de `/senti9` que ya no usa `getByRole('article')` y resto de pruebas bloqueadas antes por `429`).

### 2.3 Reactivar como gate en CI

- [ ] Validar toda la suite en verde ejecutando **Actions → Sentinel NOC - CI & DevSecOps Pipeline → Run workflow (`run_e2e: true`)**.
- [ ] Quitar `continue-on-error: true` del job `e2e` en `.github/workflows/ci.yml`.

---

## Recordatorio de límites (repositorio privado)

- **GitHub Free (privado):** 2,000 min/mes en Linux y 500 MB de almacenamiento (Artifacts + GHCR).
- Con la configuración actual (CI rápido en `push`, Playwright manual/semanal, CD manual/tag y retención de 7 días), el consumo se mantiene bajo y sin cobros sorpresa (spending limit por defecto en \$0).
- Revisar consumo periódicamente en **GitHub → Settings → Billing and plans → Usage** y limpiar versiones antiguas de imágenes en GHCR si se acerca a los 500 MB.
