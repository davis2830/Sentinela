# 📝 Bitácora Técnica de Implementaciones (Changelog de Ingeniería)

Este documento registra cronológicamente cada cambio, refactorización, optimización y nueva funcionalidad implementada en Sentinel, detallando los archivos afectados, decisiones técnicas y validaciones realizadas.

---

## 📌 Plantilla de Registro para Nuevas Implementaciones

```markdown
### [AAAA-MM-DD] - Título Breve de la Implementación
- **Módulo / Componente:** (ej. Monitoring / Alerts / Incidents / UI)
- **Motivación / Requerimiento:** Contexto de la necesidad de negocio o técnica.
- **Cambios en Backend:**
  - `ruta/archivo.py`: Breve descripción de la lógica, modelo o endpoint añadido/modificado.
- **Cambios en Frontend:**
  - `ruta/Componente.tsx`: Componentes creados o modificados, hooks o estados.
- **Base de Datos / Migraciones:** Nuevas tablas, índices o migraciones aplicadas.
- **Validaciones & Pruebas:** Comprobaciones realizadas (k6, pytest, validación visual en navegador).
```

---

## 📅 Registro Histórico de Implementaciones

### [2026-09-30] - Fase 3 Paso a Producción: Meta-Observabilidad, Health Probes, Sentry & 2FA Cifrado
- **Módulo:** `common.views_health`, `common.logging`, `accounts`, `config.settings`, `frontend.dashboard`, `frontend.profile`.
- **Motivación:** Ejecutar la Fase 3 del Plan de Producción: dotar a Sentinel de meta-observabilidad y sondeo externo tipo "Dead Man's Snitch" (/health/ activo), rastreo en vivo de excepciones con Sentry, sanitización automática de logs para cumplimiento ISO 27001 / SOC 2, y cifrado en reposo con Fernet AES-128-CBC de secretos TOTP y códigos de recuperación 2FA.
- **Cambios en Backend:**
  - `backend/common/views_health.py`: Creada `HealthCheckView` pública (AllowAny) para sondas de disponibilidad externas e internas. Mide latencias activas de PostgreSQL/TimescaleDB (`SELECT 1`), Redis Cache (`ping/pong`) y Celery Broker (`connection_for_read`). Retorna HTTP 200 si todo está saludable o 503 Service Unavailable si hay degradación.
  - `backend/config/urls.py` & `backend/config/api_urls.py`: Rutas `/health/`, `/health` y `/api/v1/health/` mapeadas directamente.
  - `backend/common/middleware.py`: Exención en `IPAllowlistMiddleware` para `/api/v1/health` y `/health`.
  - `backend/common/logging.py`: Creado `SensitiveDataMaskingFilter` con expresiones regulares para censurar tokens JWT (`Bearer [REDACTED_JWT]`), credenciales (`password=[REDACTED_PASSWORD]`) y tokens de probes Sentinine (`snt_[REDACTED_TOKEN]`) en todos los flujos de log.
  - `backend/config/settings/base.py`: Configuración integral de `LOGGING` con filtro de sanitización y formateador estándar. Integración de `sentry-sdk` (Django, Celery, Redis) con muestreo y sin PII sensible.
  - `backend/requirements/base.txt`: Incorporado `sentry-sdk>=2.0.0`, `pyotp>=2.9.0`, `qrcode[pil]>=7.4.2` e instalados en backend y celery worker.
  - `backend/accounts/models.py`: Ampliado `totp_secret` a `max_length=255` para soportar tokens cifrados Fernet `enc:...`.
  - `backend/accounts/migrations/0005_alter_user_totp_secret.py`: Migración aplicada exitosamente en BD.
  - `backend/accounts/services.py`: Cifrado transparente con Fernet de `totp_secret` y de los 10 códigos de respaldo (`backup_codes`) al persistir en PostgreSQL. Verificación con desencriptado en memoria O(1) tanto para códigos TOTP como para códigos de respaldo de un solo uso.
  - `backend/accounts/views.py`: `MeView` (GET y PATCH) y `AuthService.login` retornan la bandera `requires_2fa_setup = True` para administradores u operadores si la organización o política lo requiere.
- **Cambios en Frontend:**
  - `frontend/src/types/index.ts`: Añadido campo `requires_2fa_setup?: boolean` en la interfaz de `User`.
  - `frontend/src/components/common/TwoFactorReminderBanner.tsx`: Componente de alerta NOC de alta visibilidad para operadores/administradores que no han activado 2FA, con acceso directo en 1-clic hacia `/profile?tab=security`.
  - `frontend/src/pages/DashboardPage.tsx`: Renderizado reactivo de `TwoFactorReminderBanner` junto al banner de estado de suscripción.
  - `frontend/src/pages/ProfilePage.tsx`: Soporte para cambio directo de pestaña mediante `location.state.tab` (`activeTab = 'security'`).
- **Cambios en Contenedores & Docker:**
  - `docker-compose.yml` & `docker-compose.prod.yml`: Healthcheck activo en servicio `backend` invocando `/health/` vía subproceso HTTP de Python.
- **Validaciones & Pruebas:**
  - `npm run build` ejecutado exitosamente en `frontend/` (0 errores TypeScript, 0 errores de bundling en 16.21s).
  - Peticiones HTTP a `/health/` y `/api/v1/health/` respondiendo HTTP 200 en **< 23 ms** (BD: 0.75-16 ms, Redis: 0.77-2 ms, Celery: 17-29 ms).
  - Suite de validación de 2FA ejecutada en backend con éxito total: cifrado de secreto TOTP verificado (`enc:...`), habilitación con 10 códigos de recuperación cifrados, autenticación con TOTP, autenticación con código de respaldo (consumo a 9 códigos) y desactivación segura con contraseña.
  - Test de `SensitiveDataMaskingFilter` verificado: enmascaramiento exitoso de JWTs, passwords y tokens de agente en salida stdout.

### [2026-09-30] - Fase 2 Paso a Producción: Resiliencia de Datos, Cifrado en Reposo & Backups
- **Módulo:** `common.crypto`, `monitoring` (setup_retention & Celery Beat), Redis, PostgreSQL, Scripts de Backup.
- **Motivación:** Ejecutar la Fase 2 del Plan de Producción: proteger credenciales y tokens mediante cifrado en reposo, prevenir crecimiento desmedido de tablas de telemetría con retención automática y establecer procedimientos de Disaster Recovery automatizados.
- **Cambios en Backend:**
  - `backend/common/crypto.py`: Módulo de cifrado autenticado Fernet (AES-128-CBC + HMAC-SHA256) con derivación criptográfica de clave maestra desde `SECRET_KEY`. Cifrado transparente (`encrypt_secrets_dict`), desencriptado para ejecución de sondeos (`decrypt_secrets_dict`) y enmascaramiento (`mask_secrets_dict`) para serializadores y API.
  - `backend/requirements/base.txt`: Incorporada dependencia `cryptography>=42.0.0` e instalada en contenedores backend y worker.
  - `backend/monitoring/management/commands/setup_retention.py`: Comando Django para configurar políticas nativas de retención (`add_retention_policy`) y compresión (`add_compression_policy`) en TimescaleDB, o purga por lotes en PostgreSQL estándar.
  - `backend/monitoring/tasks.py`: Tarea programada `purge_old_telemetry(days=90)` y registrada en `CELERY_BEAT_SCHEDULE` (`purge-telemetry-every-sunday`) para ejecución automática semanal.
  - `backend/config/settings/base.py`: Soporte nativo para `REDIS_PASSWORD` en `CACHES` y broker/backend de Celery (`redis://[:password@]host:port/X`).
- **Cambios en Scripts de Disaster Recovery (`scripts/`):**
  - `scripts/backup_db.sh` & `scripts/backup_db.ps1`: Generación de respaldos binarios comprimidos (`pg_dump -Fc`), verificación de integridad con `pg_restore --list`, cálculo de hash SHA-256, purga automática de respaldos >14 días y soporte para subida off-site S3.
  - `scripts/restore_db.sh`: Procedimiento seguro de restauración con validación de archivo dump y desconexión controlada de sesiones activas.
- **Validaciones & Pruebas:**
  - Test unitario de cifrado/desencriptado/enmascaramiento ejecutado con éxito en backend.
  - Comando `setup_retention --days 90` ejecutado exitosamente en `sentinel_backend` (código 0).
  - Respaldo completo en vivo ejecutado vía `backup_db.ps1` generando volcado de **53.86 MB** con checksum SHA-256 verificado.
  - Contenedores sincronizados y reiniciados (`sentinel_backend`, `sentinel_celery_worker`, `sentinel_celery_beat`).

---

### [2026-09-30] - Fase 1 Paso a Producción: Hardening AppSec, Anti-SSRF, JWT Rotation & Docker Prod
- **Módulo:** `common.security`, `accounts`, `monitoring`, `api_checks`, `ssl_monitor`, `security_headers`, Nginx, Docker.
- **Motivación:** Ejecutar el Punto 1 del Plan de Producción: blindar la plataforma contra ataques de Server-Side Request Forgery (SSRF) en sondeos cloud, rotar e invalidar tokens JWT de sesión, mitigar IP spoofing y estructurar el entorno Docker/Nginx de producción.
- **Cambios en Backend:**
  - `backend/common/security.py`: Creado módulo central de seguridad con validación estricta de IPs y hostnames (`validate_safe_target_endpoint`, `validate_safe_public_url`, `is_ip_restricted`). Bloqueo de rangos privados (RFC 1918), loopback (`127.0.0.1`), metadata cloud (`169.254.169.254`, `metadata.google.internal`), multicast y broadcast.
  - `backend/monitoring/serializers.py`: Validación anti-SSRF integrada en `MonitoringTargetCreateSerializer` y `MonitoringTargetUpdateSerializer`. Las IPs privadas solo se admiten si el objetivo está asignado a un Guardián Sentinine (`runner_type="agent"`).
  - `backend/api_checks/serializers.py` & `views.py`: Validación anti-SSRF en creación y en endpoint `test-request/`.
  - `backend/security_headers/serializers.py` & `views.py`: Validación anti-SSRF en creación y en endpoint `test-headers/`.
  - `backend/ssl_monitor/serializers.py` & `views.py`: Validación anti-SSRF en creación y en endpoint `test-connection/`.
  - `backend/config/settings/base.py`: SimpleJWT configurado con `ACCESS_TOKEN_LIFETIME = 15m`, `ROTATE_REFRESH_TOKENS = True`, `BLACKLIST_AFTER_ROTATION = True` y `UPDATE_LAST_LOGIN = True`.
  - `backend/accounts/services.py`: Rotación criptográfica y blacklisting inmediato de tokens de refresco usados en `AuthService.refresh_token`.
  - `backend/common/middleware.py`: Extracción segura de IP de cliente (derecha a izquierda) en `IPAllowlistMiddleware` para prevenir IP Spoofing vía `X-Forwarded-For`.
- **Cambios en Infraestructura & Producción:**
  - `docker-compose.prod.yml`: Arquitectura de producción sin puertos expuestos al host para DB (`5432`), Redis (`6379`), Backend (`8000`), Prometheus (`9090`) o Loki (`3100`). Entrada exclusiva por Nginx en puertos `80` y `443`.
  - `docker/nginx/nginx.conf`: Nginx endurecido con rate limiting zones (`auth_limit` 5r/s, `api_general` 60r/s), compresión Gzip, security headers (nosniff, DENY, Referrer-Policy, Permissions-Policy), caché inmutable de assets estáticos (1 año) y proxies inversos a Gunicorn.
  - `frontend/Dockerfile.prod`: Imagen multi-stage para construir y servir el bundle compilado de React vía Nginx.
  - `.env.production.example`: Plantilla de producción con variables de seguridad y contraseñas robustas.
- **Validaciones & Pruebas:**
  - 7 casos de prueba unitarios anti-SSRF ejecutados con éxito (loopback, metadata 169.254, LAN y dominios públicos).
  - Test E2E de Sentinine validado al 100% (código 0).
  - Prueba de rotación y mitigación de replay attack en JWT exitosa: el token previo fue invalidado y su reutilización rechazada.

---

### [2026-09-30] - Rebranding a Sentinine & Consolidación al 100% de Probes LAN
- **Módulo:** `monitoring`, `sentinine`, `alerts`, Celery Beat.
- **Motivación:** Renombrar la arquitectura de sondas privadas a **Sentinine** (Sentinel Watchdog), agregar detección de desconexión en Celery, soporte de intranet SSL autofirmada y selector amigable en `TargetForm`.
- **Cambios en Backend:**
  - `backend/monitoring/tasks.py`: Tarea Celery Beat `check_sentinine_heartbeats` (cada 60s) que transiciona agentes inactivos (>45s) a `offline` y dispara alertas críticas operativas.
  - `backend/config/settings/base.py`: Registrada tarea periódica `check-sentinine-heartbeats-every-60s` en `CELERY_BEAT_SCHEDULE`.
  - `backend/monitoring/models.py`: Generador de tokens con prefijo oficial `snt_live_...`.
  - `backend/monitoring/services.py`: Soporte dual para tokens `snt_live_...` y retrocompatibilidad con `prb_live_...`.
  - `backend/monitoring/serializers.py`: Expuestos `agent_probe_status` y `agent_probe_online` en `MonitoringTargetSerializer`.
  - `backend/monitoring/views.py`: Comando docker oficial `sentinel/sentinine:latest` y descripción de auditoría para Sentinine.
  - `backend/test_probe_e2e.py`: Test E2E validando ciclo completo, token `snt_live_`, reporte de checks y watchdog de desconexión.
- **Cambios en Agente (`sentinine/`):**
  - `sentinine/agent.py`: Agente v1.1.0 con soporte para `SENTININE_INSECURE_SKIP_VERIFY`, resolución DNS, conexiones TCP a bases de datos y User-Agent oficial `Sentinine/1.1.0`.
  - `sentinine/Dockerfile`, `sentinine/docker-compose.yml`, `sentinine/install.sh` y `sentinine/install.ps1`.
- **Cambios en Frontend:**
  - `frontend/src/components/monitoring/CreateProbeModal.tsx`: Rebrand completo a "Guardián Sentinine", comando Docker y pasos de despliegue.
  - `frontend/src/components/monitoring/ProbeDirectoryDrawer.tsx`: Rebrand a "Guardianes Sentinine", telemetría en vivo y badges de estado.
  - `frontend/src/pages/MonitoringPage.tsx`: Botón superior "Sentinine ({count})".
  - `frontend/src/components/monitoring/TargetForm.tsx`: Selector interactivo de ejecutor (Nube Sentinel vs Sentinine LAN) con auto-detección de IPs privadas.
  - `frontend/src/components/monitoring/TargetCard.tsx`, `TargetTableView.tsx` y `TargetDetailDrawer.tsx`: Badges semánticos morados y alerta roja cuando el Sentinine asignado está offline.
- **Validaciones:**
  - `backend/test_probe_e2e.py` ejecutado con éxito (0 errores).
  - TypeScript compilado con `npm run build` sin errores.

---

### [2026-09-30] - Sistema Centralizado de Documentación y Contexto Vivo
- **Módulo:** Documentación del Proyecto / Arquitectura.
- **Motivación:** Mantener una fuente única de verdad para el contexto técnico, avances del roadmap y registro de decisiones de ingeniería.
- **Archivos Creados:**
  - [`docs/README.md`](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/README.md): Índice principal de documentación.
  - [`docs/ROADMAP_TRACKER.md`](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/ROADMAP_TRACKER.md): Matriz de avance por fases (Fase 1 completada, Fase 2 en curso, Fase 3 futura).
  - [`docs/IMPLEMENTATION_LOG.md`](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/IMPLEMENTATION_LOG.md): Bitácora técnica estructurada.
  - [`docs/MODULE_INVENTORY.md`](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/MODULE_INVENTORY.md): Mapeo completo de modelos, endpoints y vistas frontend.
  - [`docs/DEV_WORKFLOW.md`](file:///c:/Users/feshernandez/GC_OPS_OBS/docs/DEV_WORKFLOW.md): Guía de desarrollo, sincronización con Docker y diseño UI.
  - [`README.md`](file:///c:/Users/feshernandez/GC_OPS_OBS/README.md): Portada del repositorio con visión general y accesos rápidos.

---

### [2026-09-29] - Motor de Agentes Satélite (Private Probes para Redes Internas)
- **Módulo:** `monitoring` & `sentinel_probe`
- **Motivación:** Permitir el monitoreo de endpoints LAN, bases de datos locales y VPCs privadas sin requerir apertura de puertos de entrada hacia internet.
- **Cambios en Backend:**
  - `backend/monitoring/models.py`: Modelos `AgentProbe` con token seguro hasheado y campo `runner_type` (`cloud` vs `agent`) en `MonitoringTarget`.
  - `backend/monitoring/services.py`: `AgentProbeService` para creación de tokens (`prb_live_...`), procesamiento de heartbeats y recepción de resultados.
  - `backend/monitoring/views.py`: Vistas REST `AgentProbeListView`, `AgentProbeDetailView`, `AgentProbeHeartbeatView` y `AgentProbeSubmitResultsView`.
  - `backend/monitoring/tasks.py`: Modificada la tarea `schedule_all_checks` para excluir targets asignados a probes (`runner_type="agent"`).
  - `sentinel_probe/agent.py`: Script Python autónomo ligero para ejecución en contenedor Docker o binario directo.
- **Cambios en Frontend:**
  - `frontend/src/components/monitoring/CreateProbeModal.tsx`: Modal para registrar agente satélite con comando Docker listo para copiar.
  - `frontend/src/components/monitoring/ProbeDirectoryDrawer.tsx`: Drawer de administración de sondas activas, métricas de host y estado.
  - `frontend/src/components/monitoring/TargetDetailDrawer.tsx` y `TargetCard.tsx`: Badges semánticos púrpura identificando objetivos sondeados por agente LAN.
- **Validaciones:**
  - Ejecutado script end-to-end [`backend/test_probe_e2e.py`](file:///c:/Users/feshernandez/GC_OPS_OBS/backend/test_probe_e2e.py) validando registro, despacho de tareas en heartbeat y actualización de latencia en base de datos.

---

### [2026-09-28] - Erradicación de N+1 Queries & Optimización de Base de Datos
- **Módulo:** `monitoring`, `alerts`, `incidents`, `config`
- **Motivación:** Resolver cuellos de botella severos bajo concurrencia en TimescaleDB y reducir la latencia p95.
- **Cambios en Backend:**
  - `backend/monitoring/serializers.py`: Prefetch optimizado con ventana de tiempo de 1 hora (`checked_at__gte=since_1h`) más `select_related('owner_team', 'agent_probe')`, reduciendo de 11 queries a 0 queries en serialización.
  - `backend/alerts/serializers.py`: Implementado `AlertListSerializer` con precarga en lote (`alert_id IN (...)`) y resolución en memoria O(1), reduciendo 40 queries a 1 sola query.
  - `backend/incidents/views.py`: Implementado `.annotate(alerts_count_annotated=Count('incident_alerts'))` suprimiendo queries COUNT(*) repetitivas.
  - `backend/config/settings/base.py`: Activado connection pooling `CONN_MAX_AGE=60` y `CONN_HEALTH_CHECKS=True`.
  - `backend/monitoring/views.py` & `backend/incidents/views.py`: Activada caché en Redis (DB 2) con TTL de 15 segundos para `/global-performance/` y `/incidents/stats/`.
- **Base de Datos:**
  - Creado índice B-Tree `incidents_incidentalert_alert_id_idx` sobre `alert_id` en `incidents_incident_alert`.
- **Validaciones:**
  - Benchmark con Grafana k6: Latencia promedio reducida a **22.36 ms** y p95 a **38.81 ms** (40.7% de mejora con 0% de errores).

---

### [2026-09-25] - Modernización Visual y Operativa del Dashboard NOC
- **Módulo:** `frontend/src/components/dashboard/` & `DashboardPage.tsx`
- **Motivación:** Estandarizar la interfaz según la paleta estricta Dark Mode (#090D11, #111720) y proporcionar máxima densidad operativa.
- **Cambios en Frontend:**
  - Creada arquitectura modular de 7 widgets bajo `frontend/src/components/dashboard/`:
    - `NOCDashboardHeader.tsx`: Reloj con segundero, selector de ventana temporal y contador dinámico.
    - `NOCExecutiveKpis.tsx`: 5 tarjetas KPI ejecutivas con sparklines SVG y donut gauge de seguridad.
    - `NOCPerformanceSection.tsx`: Gráfica de área Recharts multieje (Disponibilidad, Latencia, RPS) y barra de microservicios.
    - `NOCInfraHealthDonut.tsx`: Donut chart SVG proporcional de salud de infraestructura.
    - `NOCRecentActivityFeed.tsx`: Feed cronológico reactivo con badges por estado.
    - `NOCCriticalTargetsTable.tsx`: Tabla de servicios críticos priorizada por severidad.
    - `NOCLiveAlertsList.tsx`: Lista unificada de alarmas con enlace directo a incidentes.
- **Validaciones:**
  - Compilación limpia con Vite (0 errores TypeScript) y verificación visual en navegador.

---

### [2026-09-20] - Módulo de Ventanas de Mantenimiento Programadas (Fase 2)
- **Módulo:** `maintenance`, `status_page`, `alerts`
- **Motivación:** Evitar falsos positivos y proteger el SLA mensual durante labores de mantenimiento programadas en infraestructura.
- **Cambios en Backend:**
  - `backend/maintenance/models.py`: Modelo `MaintenanceWindow` con soporte de recurrencia (semanal, mensual) y alcance por organización o targets específicos.
  - `backend/maintenance/services.py`: Sincronización automática con `ScheduledMaintenance` de la Status Page pública.
  - `backend/alerts/services.py`: Supresión de notificaciones externas en `AlertService.create_alert` si el target está dentro de una ventana de mantenimiento activa.
  - `backend/reports/services.py`: Exclusión de minutos caídos en cálculo de disponibilidad para targets bajo mantenimiento.
- **Cambios en Frontend:**
  - `frontend/src/pages/MaintenancePage.tsx`: Vista completa con `NOCPageHeader`, 4 KPIs, `NOCToolbar`, persistencia de vista (Cards vs Tabla) y `MaintenanceDetailDrawer.tsx`.
