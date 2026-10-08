# Cierre local de pendientes beta — 2026-10-07

## Resultado

Continuación de la [auditoría integral](BETA_MODULE_AUDIT.md). Se cerraron los defectos locales reproducibles; la beta no queda aprobada para producción. No hay migraciones, cambio de planes, despliegue productivo ni ampliación de logs.

| Pendiente | Resultado local | Lo que todavía falta |
| --- | --- | --- |
| SLA y mantenimiento | Reportes/live excluyen muestras de ventanas aplicables; `slow` disponible pero degradado en reportes, Monitoring y Status Page | Disponibilidad ponderada por tiempo y evaluación contractual no implementadas |
| Notificaciones | Dos conexiones PostgreSQL concurrentes entregan una sola vez; cero mensajes aceptados implica fallo | Confirmación real del proveedor y casos de caída del proceso después de enviar |
| Caída → alerta → incidente → recuperación | Ciclo probado con correo locmem y servicios reales en BD de test; endpoints distintos no se agrupan por accidente | Proveedores externos y Sentinine real no certificados por esta prueba |
| Worker/Beat | Reiniciados localmente; smoke final crea reporte y check HTTPS por broker y persiste resultados | CI y reproducción en el entorno objetivo |
| Status Page | Agregación SQL por día/target, consultas constantes, días según zona activa y exclusión de checks futuros; lentitud ámbar; auditoría de 13 páginas sin referencias obsoletas/ajenas | Suscripción/baja pública |
| Dependencias | pip-audit sin vulnerabilidades conocidas en inventario instalado; Trivy fs sin High/Critical en lockfile frontend | Trivy de imágenes/OS y CI; dos avisos npm Moderate de React Router pendientes |
| Capacidad | Baseline k6 local de lectura aprobado, máximo cinco VUs y retención de salida | Soak representativo con sondeos y crecimiento diario de históricos |

## Reglas de disponibilidad

- `up` y `slow` cuentan como servicio disponible. `slow` mantiene estado degradado, no pasa a “saludable”. `down` y `error` no cuentan como disponibles.
- Los reportes SLA/availability/summary y métricas SLA live eliminan del denominador las muestras dentro de mantenimientos con `exclude_from_sla=True`, de la misma organización y target (o global).
- Ventanas absolutas son `[inicio, fin)`: una medición exactamente en el fin vuelve a contar. Canceladas y ventanas sin exclusión no alteran el resultado.
- Series semanales/quincenales usan día configurado o día inicial; mensuales usan el día inicial y no inventan una ocurrencia cuando ese día no existe. Se usa la zona horaria activa de Django. Una serie completada se corta en `updated_at`; no existe aún una bitácora inmutable de ocurrencias reales.
- Históricos operativos y Status Page describen las mediciones observadas, incluidos mantenimientos; no son el mismo indicador que SLA elegible. Reportes previamente guardados conservan su contenido original hasta regenerarlos.
- Los presupuestos de error siguen siendo estimaciones derivadas de muestras, no minutos de caída medidos continuamente. No se ofrece certificación contractual.
- Recuperar el servicio resuelve la alerta y genera aviso de recuperación. No cierra automáticamente el incidente: el cierre y RCA siguen siendo decisión del operador.

## Gates verificados

- **155/155 Django**, incluyendo concurrencia con dos conexiones PostgreSQL, límites/aislamiento de mantenimiento, recurrencia, correo cero, ciclo de caída/recuperación y lentitud coherente.
- **91/91 Playwright Chromium**. Algunas pruebas usan telemetría simulada; otras consultan el backend real. No equivalen a cobertura externa total.
- TypeScript/build Vite aprobado; Django `check`, detección de migraciones y `git diff --check` sin errores.
- Worker/Beat reiniciados con el código final; broker → worker → PostgreSQL: reporte `completed`, check público HTTPS `up`.
- Fixtures de Chromium/k6/smoke retirados, auditoría conservada. Ningún envío real de correo.

Auditoría Python instalada temporalmente fuera de las dependencias de la aplicación, sin cambiar requirements:

```powershell
docker compose exec -T backend python -m pip install --target /tmp/sentinel-audit-tools pip-audit
docker compose exec -T -e PYTHONPATH=/tmp/sentinel-audit-tools backend python -m pip_audit --path /usr/local/lib/python3.13/site-packages
```

Resultado: `No known vulnerabilities found`. pip-audit 2.10.1 auditó paquetes instalados, no una futura resolución de rangos de requirements. El directorio temporal desaparece al recrear el contenedor.

Trivy fs usó imagen digest `sha256:af6acf9a6b85dfe389a1941505c0ce9efef52a4719635e1a962f022a3d855daa`, repositorio solo lectura, sin socket Docker, omitiendo `.env`, `.git`, `.venv` y node_modules; scanners `vuln`, severidad High/Critical, exit-code 1. Encontró un inventario soportado: `frontend/package-lock.json`, cero hallazgos en esas severidades. **No escaneó imágenes ni confirmó ausencia de avisos Moderate.** El primer intento falló por espacio temporal; la repetición con caché en disco terminó correctamente.

La caché temporal de Trivy se retiró después del escaneo; es regenerable y no contiene datos de la aplicación. Auditoría de referencias de publicación, solo lectura: `docker compose exec -T backend python manage.py audit_publication_links` → `Pages checked=13; findings=0; changes=0`.

## Baseline de capacidad, no benchmark oficial

Escenario: [06_beta_read_baseline.js](../tests_perf/scenarios/06_beta_read_baseline.js). Salida: [beta-read-baseline-20261007.json](../tests_perf/reports/beta-read-baseline-20261007.json).

- Solo localhost:8000 y fixture Viewer explícito `pending-20261007`; dos GET (`monitoring/`, directorio Status Page), una autenticación inicial, pausa de 3 segundos por iteración.
- Diez targets de prueba deshabilitados, además de recursos de Chromium. Sin generar sondeos durante la carga. No se usó una cuenta de cliente.
- Rampas 1/3/5 VUs y dos minutos sostenidos a cinco; duración 3 min 30 s, 264 iteraciones, **529 solicitudes HTTP, 0 errores, promedio 27,75 ms, p95 28,79 ms**. Máximo 2,88 s, incluido login. Todos los umbrales del escenario pasaron.
- k6 1.7.1, Windows, Ryzen 7 6800H (8 cores/16 threads), RAM física 24.951.414.784 bytes; Docker reportó límite 11,31 GiB. Backend Django/gunicorn de desarrollo con reload, PostgreSQL 16, Redis y Celery locales.
- Base Git `0627c685e325b49b4e0f5ff56fc1d74f1abc48e1` **más cambios no comprometidos de ambas auditorías**. Hubo otras pruebas y auditorías concurrentes: no es un entorno de rendimiento dedicado ni una imagen productiva inmutable.
- Muestra durante carga: backend CPU 10,13%/326,7 MiB; PostgreSQL 1,20%/77,96 MiB; Redis 0,41%/8,672 MiB; worker 0,04%/384,8 MiB. Son muestras, no máximos.
- Tamaño total de BD observado: 27.294.743 → 27.311.127 bytes. Esa diferencia incluye fixtures/auditoría y no mide crecimiento diario de checks. Cola: cero trabajos activos/reservados en la muestra posterior; no es un registro continuo de atraso.

No se extrapolan clientes soportados ni almacenamiento mensual a partir de estos resultados. Para fijar cupos: repetir con imagen productiva, tráfico representativo de dashboards y sondeos según Free/Pro, dataset de históricos y retención; subir carga gradualmente y sostenerla varias horas en un entorno aislado, con métricas continuas y límites de aborto.

## Pendientes externos o que requieren decisión

1. **CI:** ejecutar gates tras publicar los cambios. No se hizo commit/push ni se activó un pipeline remoto en esta fase.
2. **Imágenes:** builds productivos, Trivy de backend/frontend/OS y `nginx -t` con configuración objetivo; no confundir Trivy fs con ese gate.
3. **Integraciones:** prueba controlada de Sentinine y proveedores externos. Definir agente y destinos de prueba antes de enviar mensajes reales.
4. **React Router:** resolver dos avisos Moderate mediante migración mayor con regresiones; no ejecutar `npm audit fix --force` a ciegas.
5. **Status Page público:** diseñar confirmación y baja autenticada por enlace de suscripción. Referencias antiguas revisadas localmente sin hallazgos; repetir la auditoría en el entorno objetivo sin cambiar publicaciones automáticamente.
6. **Capacidad:** soak representativo y crecimiento/retención de telemetría. El baseline de lectura ya existe, la capacidad global sigue sin certificar.
7. **Preproducción:** backup/restauración, HTTPS externo y checklist cuando se habilite esa fase. Producción y logs ampliados siguen fuera de alcance.
