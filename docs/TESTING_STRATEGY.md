# Estrategia de pruebas

## Suite actual

Seguimiento local del **2026-10-07**: **155/155 Django, 91/91 Chromium y TypeScript/build Vite aprobados**. Siete regresiones backend adicionales cubren SLA/mantenimiento, recurrencia/aislamiento, lentitud, Status Page por lote/zona horaria, ciclo de caída/recuperación, correo cero y concurrencia de dos conexiones. Worker/Beat reiniciados y smoke repetido. pip-audit del inventario instalado sin hallazgos, Trivy fs frontend sin High/Critical y baseline k6 de lectura aprobado. Imágenes, CI, integraciones externas y soak representativo siguen pendientes; véase [evidencia y límites](BETA_VALIDATION_FOLLOWUP.md).

Auditoría local integral del **2026-10-07**: **148/148 Django, 91/91 Playwright Chromium y TypeScript/build Vite aprobados**. Añade 28 regresiones backend y cuatro Chromium sobre Gestión, aislamiento, GET sin publicación implícita, SMTP y métricas sin mediciones. Smoke con broker/worker reales: reporte completado y check HTTPS persistido. Fixtures retirados, auditoría conservada. CI, capacidad e integraciones externas pendientes; véase [alcance, correcciones y límites](BETA_MODULE_AUDIT.md). npm aprobó el umbral High con dos avisos Moderate; pip-audit no disponible en el contenedor.

Revalidación local del 2026-10-06 tras corregir tooltips duplicados y las capas de la dona: **120/120 Django, 87/87 Playwright Chromium y TypeScript/build Vite aprobados**. Se ampliaron pruebas existentes, sin aumentar el conteo: un solo tooltip en la franja bajo puntero/foco, tres indicadores sincronizados, desaparición al salir y navegación por teclado. La dona comprueba fondo opaco y orden real de capas en el cruce con el centro, sin interceptar clics; capturas desktop/móvil. Fixtures aislados retirados; CI y producción pendientes.

Última suite completa local (2026-10-06, rangos largos y gráficos de estado): **120/120 Django, 87/87 Playwright Chromium y TypeScript/build Vite aprobados**. Tres regresiones UI nuevas reproducen rangos largos con horas repetidas y datos dispersos, verifican ejes/puntos/barras en los cuatro períodos, filtros de teclado y ausencia de recursos ficticios o salud global ante fallos parciales. Los controles de la dona muestran cuatro estados, incluido cero, y las barras de módulos describen su distribución. Se corrigieron selectores de etiquetas SVG para comprobar realmente su contenido y límites. Capturas desktop/móvil y fixtures aislados retirados. CI y producción pendientes; flake8 no se repitió.

Suite anterior local (2026-10-06, rendimiento global): **120/120 Django, 84/84 Playwright Chromium y TypeScript/build Vite aprobados**. Tres regresiones nuevas de backend cubren el contrato real, nulos sin checks, buckets parciales y exclusión de datos ajenos/futuros/vencidos. Dos flujos de interfaz cubren franjas y tooltip, eje temporal alineado, ejes sin recorte, móvil sin overflow y estados vacíos/fallidos o tasas ausentes. Se repitió la regresión de alineación tras el ajuste final. Fixtures aislados retirados; CI y producción pendientes, sin nueva ejecución de flake8.

Suite anterior local (2026-10-05, ficha integral HTTP/HTTPS): **117/117 Django, 82/82 Playwright Chromium y TypeScript/build Vite aprobados**. Añade doce regresiones backend de asociaciones y seis flujos de interfaz. Incluye aislamiento, GET sin efectos secundarios, WHOIS explícito, puerto/ruta exactos, consultas por lote, Viewer, fallos parciales, confirmación, retorno con filtros, cooldown y 202. Se conservaron las regresiones previas. Revisión visual 1440×900 y 390×844; fixtures aislados retirados. CI y producción pendientes; no se repitió flake8 en esta ejecución. Véase [evidencia y alcance de la ficha](ENDPOINT_DOSSIER.md#evidencia-local--2026-10-05).

Suite anterior local (2026-10-05, extensión de paleta compartida): **105/105 Django, 76/76 Playwright Chromium y build TypeScript/Vite aprobados**. Las regresiones visuales verifican marca/estado, contraste de texto secundario de tabla, herencia de tokens en portales, lista/cuadrícula/drawer y filtros móviles sin overflow. La extensión comprueba textos secundarios más blancos en 17 rutas de Conectividad, Gestión y Sistema y registra capturas desktop/móvil. Se mantienen las regresiones de cadencia y permisos. CI y producción pendientes; no se repitió flake8 en esta ejecución. El piloto previo tenía 75 pruebas Chromium.

Validación anterior de beta del 2026-10-05: **102/102 Django**, **60/60 Playwright Chromium**, TypeScript/Vite y flake8 crítico aprobados. El conteo histórico de 65/56 corresponde al 2026-10-03. No es evidencia de CI ni de producción. La suite incorpora verificación, hash de desafíos, fallos de correo, resends, Turnstile simulado, capacidad/confirmación/cuotas concurrentes, presupuestos, transición y política de correos temporales. Para la evidencia posterior de SMTP/Turnstile, ver [gates beta](BETA_EMAIL_VERIFICATION.md).

La suite histórica del 2026-10-03 contenía 65 pruebas. Cubren autenticación, hash y revelado único de tokens, revocación de sesiones, confianza de proxy, SSRF sin redirects y con conexión fijada contra DNS rebinding, registro y ejecución directa de schedules SSL/DNS/WHOIS, aislamiento multi-tenant, cuotas, RBAC, contrato 202, cuarentena y retención. Incluyen bloqueo por suscripción y fecha de prueba, tareas encoladas y schedulers, Sentinine, pago verificado y cobertura por protocolo con opt-outs e idempotencia. El diagnóstico de conexión conserva HTTP 308 y Location sin visitar el destino. Las regresiones de frecuencia comprueban Free/Pro e intervalos más lentos, alias y masivos, aislamiento organizacional, duplicados de worker, firmas Celery, rechazo del broker, diagnósticos y resultados de agente. Una prueba TransactionTestCase usa dos conexiones concurrentes PostgreSQL: solo una reserva es admitida. Se verifican los siete estados de scan_availability en los seis GET de lista y detalle, tokens de solo lectura, ausencia de reservas y secretos en GET y número de consultas constante al aumentar recursos.

Comando:

```powershell
docker compose exec -T backend python manage.py test
```

La última ejecución local completa debe quedar verde antes de actualizar este documento; CI vuelve a ejecutarla sin limitar aplicaciones.

## Frontend

Última validación de cadencia de Conectividad (2026-10-05): **105/105 Django, 73/73 Chromium y build TypeScript/Vite**. Reloj virtual comprueba en los seis módulos que Free no consulta a los 15 segundos y sí a los 300, sin POST de sondeo; cubre Pro 60 s, cambio de plan, metadatos ausentes y mensaje de recarga manual. CI pendiente.

Última regresión local de correo (2026-10-05): **105/105 Django y 65/65 Chromium**, más build TypeScript/Vite. Incluye confirmación con campo captcha opcional ausente/vacío, rechazo de reenvío sin captcha real, cooldown calculado en servidor, cuerpo exacto del POST de confirmación, recuperación de enlace expirado/incompleto y revisión visual desktop/móvil. Los errores HTTP y estados de envío usan fixtures aislados en navegador; la lógica de tokens y envío se comprueba en Django. No sustituye CI ni certifica la entrega de todos los mensajes. Flake8 no pudo repetirse porque falta en el contenedor reconstruido.

`npm run build` ejecuta TypeScript y Vite. El build local está aprobado en la rama actual.

## Playwright

Existen suites Chromium aisladas en `frontend/e2e/critical-flows.spec.ts`, `frontend/e2e/auth-session.spec.ts` y `frontend/e2e/beta-flows.spec.ts` para:

- login y carga del dashboard con telemetría;
- filtro por salud y módulo, agrupación de alertas y drawer unificado;
- re-escaneo y reconocimiento de alerta por administrador;
- ausencia de controles de mutación para Viewer;
- recuperación ante un endpoint parcial fallido;
- orden operativo utilizable en viewport móvil;
- creación de un target por administrador;
- rechazo HTTP 403 de una mutación Viewer.

La última ejecución local del 2026-10-03 aprobó 56/56 casos, incluyendo gráficas completas dentro del primer viewport de 1440×900 con avisos visibles, controles de período/auto-refresh y ausencia de desbordamiento horizontal en móvil. También valida onboarding con opt-outs, ausencia de aprovisionamiento frontend duplicado, confirmación persistente y bloqueo de onboarding para suscripción vencida. Las regresiones de sesión comprueban renovación concurrente única, credenciales ausentes o revocadas, refresh sin rotación, fallos temporales y login sin Bearer obsoleto. Se verifica el aviso de redirección con lenguaje sencillo, detalles técnicos desplegables y copia de la URL sugerida sin visitarla ni marcarla verificada antes de una nueva prueba explícita. También se comprueban textos de ayuda de al menos 12 px, onboarding móvil sin overflow y selectores de ejecutor sin emojis. Monitoring verifica que `Actualizar datos` no envía un scan, que el 429 muestra el tiempo de espera y que no hay controles de sondeo masivo en las cabeceras ni barras de selección. También se verifican los doce módulos compactos, preferencias Lista/Cuadrícula, filtros URL, navegación a Gestión, deduplicación, agenda y recuperación parcial, disponibilidad individual y metadatos ausentes, y conservación de filtros, selección y drawer durante la recarga. Las cuentas y altas de target son reales y aisladas; las pruebas de presentación utilizan fixtures de telemetría, no datos productivos. El estado de cumplimiento definitivo continúa sujeto a ejecución verde en CI.

Se considera gate implementado únicamente después de pasar en CI. Hasta entonces su estado es “configurado, pendiente de CI”.

## Seguridad e infraestructura en CI

- `flake8` falla por errores de sintaxis o nombres indefinidos.
- `npm audit --omit=dev --audit-level=high` y `pip-audit` no silencian fallos.
- Trivy falla ante High/Critical.
- Se validan Compose, Dockerfiles productivos y `nginx -t`.

## Rendimiento

Los resultados k6 existentes son históricos. No hay benchmark oficial vigente hasta repetir el escenario documentado después del hardening; consulte [tests_perf/README.md](../tests_perf/README.md).
