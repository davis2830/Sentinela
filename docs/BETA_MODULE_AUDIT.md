# Auditoría integral de módulos — 2026-10-07

Actualización posterior: varios pendientes locales se cerraron con **155/155 Django, 91/91 Chromium**, build, auditorías y baseline k6. Este documento conserva la primera auditoría; el estado vigente y sus límites están en [el seguimiento de pendientes](BETA_VALIDATION_FOLLOWUP.md).

## Resultado y alcance

Se ejecutó la auditoría local y se corrigieron problemas reproducibles de permisos, aislamiento, publicación y métricas. **No equivale a aprobar producción ni a certificar todos los recorridos externos.** No se desplegó a producción, no se enviaron correos reales ni se modificaron cuentas de clientes. La ampliación del sistema de logs continúa fuera de esta fase.

Las pruebas Django usan una base aislada. Chromium utiliza cuentas dedicadas; algunos recorridos consultan el backend real y otros simulan respuestas para cubrir estados difíciles de reproducir. No se presentan las simulaciones como integraciones reales.

## Cobertura por área

| Área | Evidencia local | Límite de la evidencia |
| --- | --- | --- |
| Planes, registro y onboarding | Suite completa: verificación, cuotas, Free/Pro, suscripción vencida, reservas concurrentes, cobertura por protocolo y confirmación | Pago real y reputación/entrega sostenida de correo pendientes |
| Monitoring, API, SSL, DNS, dominios, cabeceras y Sentinine | Regresiones de aislamiento, permisos, 202/429, disponibilidad, SSRF, UI, filtros y dossier; sondeo HTTPS real persistido por worker | No se probó cada proveedor DNS/WHOIS ni un agente externo real en esta ejecución |
| Alertas e incidentes | Viewer bloqueado en mutaciones; ciclo de incidente, asociación de alertas sin duplicación y referencias tenant-aware | Simulación de una interrupción prolongada y recuperación completa pendiente |
| Mantenimientos | Relaciones a página, usuario, equipo y targets validadas; fechas inválidas rechazadas | Exclusión efectiva de períodos de mantenimiento del cálculo SLA no certificada |
| Status Page | GET sin creación; selección explícita; aislamiento; desconocido sin mediciones; suscripción pública solo en página pública; escritorio/móvil | Historial por recurso todavía requiere revisión de rendimiento y límites de día/zona horaria |
| Notificaciones | Canales y alertas de la misma organización; diagnóstico sujeto a suscripción/beta; envío local, fallo e idempotencia; SMTP configurable valida IP y exige TLS | Entrega simultánea con dos workers y proveedores webhook/SMS/correo reales pendientes |
| Reportes | Seis generadores, worker real, aislamiento, rangos acotados, HTML escapado, CSV protegido, métricas desconocidas sin checks | Disponibilidad basada en proporción de muestras, no certificación contractual ni disponibilidad ponderada por duración |
| Organización, usuarios, perfil, tokens, auditoría y plataforma | Suite completa y regresiones previas de permisos, sesión, tokens con hash, invitaciones, membresía y configuración beta | No se ejercitó manualmente cada formulario administrativo |

## Hallazgos corregidos

1. Gestión tenía rutas que exigían autenticación pero no impedían mutaciones de Viewer. Se aplica membresía organizacional y rol de administrador también en acciones y diagnósticos.
2. Algunas relaciones aceptaban identificadores ajenos a la organización. Se validan asignados, canales, alertas, targets, equipos y páginas antes de escribir.
3. Consultar Status Page creaba una configuración y podía publicar todos los targets. Ahora la creación es explícita y una selección vacía no publica recursos ni incidentes.
4. Status Page y reportes podían afirmar 100% sin checks. Ahora devuelven nulos/estado desconocido, respetan frescura y los muestran como “Sin mediciones”. MTTD sin evidencia se muestra no disponible.
5. La exportación denominada PDF devolvía HTML y llevaba JWT en la URL. Ahora usa autenticación por cabecera, descarga HTML para imprimir y escapa contenido controlado por el usuario. CSV neutraliza fórmulas en celdas de texto.
6. Viewer y tokens de lectura podían obtener configuración sensible de canales o payloads API. Esos campos se vacían para lectores; administradores conservan acceso para configurar recursos.
7. Diagnosticar un canal sin guardarlo podía evadir controles de suscripción/beta. Se aplican antes del envío; el SMTP configurable bloquea destinos privados y fija la IP validada al conectar.
8. Repetir una entrega podía duplicar envíos. Se bloquea la fila antes de decidir y se conserva el estado enviado. La prueba local verifica repetición; no certifica aún dos workers concurrentes.
9. Cambiar el orden de respuestas DNS generaba cambios falsos. La comparación es independiente del orden y no registra el primer valor como cambio.

No hay nuevas migraciones ni cambios de planes. Los GET de administradores siguen ofreciendo los secretos necesarios para editar canales; no se afirma que absolutamente todas las respuestas GET estén libres de credenciales.

## Gates y reproducción

Desde la raíz del repositorio:

```powershell
docker compose exec -T backend python manage.py test --noinput
docker compose exec -T backend python manage.py check
docker compose exec -T backend python manage.py makemigrations --check --dry-run
docker compose config --quiet
```

Desde `frontend`:

```powershell
npm.cmd run build
$env:E2E_FIXTURE_SUFFIX='audit-20261007'
npm.cmd run test:e2e
npm.cmd audit --omit=dev --audit-level=high
```

El fixture debe crearse explícitamente antes de Chromium y retirarse al finalizar. Estos comandos exigen DEBUG local y no reutilizan organizaciones de usuarios:

```powershell
docker compose exec -T -e SENTINEL_E2E_FIXTURE=1 backend python manage.py seed_e2e_accounts --suffix audit-20261007
docker compose exec -T -e SENTINEL_E2E_FIXTURE=1 backend python manage.py audit_beta_smoke --suffix audit-20261007
docker compose exec -T -e SENTINEL_E2E_FIXTURE=1 backend python manage.py seed_e2e_accounts --suffix audit-20261007 --cleanup
```

Smoke real observado: broker → worker → PostgreSQL, reporte completado y check de `https://example.com/` persistido con estado `up`. No prueba que todos los nuevos cambios de servicios estuvieran cargados en procesos worker de larga duración; se requiere reiniciar workers en el siguiente rollout local y repetir el smoke. Los recursos del smoke se eliminan al finalizar; el fixture de Chromium también se retiró, conservando auditoría.

Resultados finales de esta ejecución: **148 pruebas Django**, **91 Chromium** y **TypeScript/build Vite** aprobados; check Django y detección de migraciones sin novedades; Compose local válido. Las 28 regresiones Django nuevas y cuatro Chromium nuevas complementan las suites previas.

`npm audit --omit=dev --audit-level=high` pasó el umbral High, pero reportó dos avisos Moderate asociados a React Router. No se ejecutó una migración mayor automática. `pip-audit` no está instalado en el contenedor: su gate sigue pendiente. No se repitieron Trivy, builds productivos, `nginx -t`, carga k6 ni CI.

## Pendientes antes de aprobar beta

- **P1 — Semántica SLA:** comprobar y corregir la exclusión de mantenimientos; definir si `slow` cuenta como disponible. Los porcentajes actuales son proporciones de checks, no tiempo de servicio certificado. Reportes históricos no se regeneran automáticamente.
- **P1 — Integración operativa:** reiniciar worker/Beat con estos cambios, repetir smoke y verificar alerta → incidente → notificación → recuperación con destinos controlados, incluidos Sentinine y proveedores externos.
- **P1 — Seguridad de dependencias:** ejecutar pip-audit y Trivy, repetir gates en CI; evaluar migración de React Router en un cambio independiente con regresiones.
- **P2 — Status Page:** medir consultas del historial, resolver semántica de lentitud y límites de fecha según zona horaria; revisar configuraciones anteriores con referencias obsoletas. Las nuevas escrituras sí validan organización.
- **P2 — Notificaciones:** comprobar concurrencia real entre workers y entrega efectiva cuando el backend de correo devuelve cero mensajes enviados; revisar recuperación de suscripción pública y baja por correo.
- **P2 — Capacidad beta:** ejecutar carga aislada creciente y prueba sostenida, registrar CPU/RAM, tamaño diario de PostgreSQL, latencia API y atraso de colas. Fijar cupos según mediciones, no según benchmarks históricos.
- **Preproducción:** backup/restauración, HTTPS externo, rollout controlado y checklist. Producción continúa fuera de esta fase; logs ampliados permanecen pendientes.

La aprobación requiere cerrar los P1, repetir las suites en CI y registrar evidencia de capacidad e integraciones. Esta auditoría entrega correcciones y evidencia local, no una promesa de ausencia total de fallos.
