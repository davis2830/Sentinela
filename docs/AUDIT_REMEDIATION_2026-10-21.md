# Corrección de hallazgos — 2026-10-21

## Alcance y estado

Cambios locales posteriores a la [revalidación de main](PROJECT_REVALIDATION_2026-10-21.md), sobre `c856e4a`. Se conserva aquel informe como evidencia del estado anterior. No se ha desplegado, publicado ni aplicado una purga de datos. Esta revisión no acredita CI ni autoriza producción.

## Correcciones implementadas

| Hallazgo anterior | Cambio | Evidencia |
| --- | --- | --- |
| REV-001: mantenimiento legacy podía cambiar a un target ajeno | Target inmutable; alta vinculada al recurso de la URL; PATCH/DELETE filtran por organización | Regresiones para ambas rutas, creación, edición válida, Viewer y aislamiento de supresión de alertas |
| REV-002: HTTP/TCP delegaban un hostname validado a Blackbox | HTTP mediante `common.safe_http`; TCP conecta a una IP literal validada, sin segunda resolución | Servidor HTTP local aislado y contratos de resolución pública/privada |
| REV-004: configuración HTTP ignorada | Respeta método, cabeceras, cuerpo UTF-8 y código esperado; conserva umbral de latencia | GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS; respuesta lenta, código inesperado, redirección y cuerpo sin límite |
| REV-003: certifi/Pillow vulnerables | Mínimos `certifi>=2026.10.19`, `Pillow>=13.0.0`; reconstrucción local de backend/worker/beat | Inventario instalado y pip-audit del runtime sin hallazgos |
| REV-005: dependencias frontend de producción | React Router 7.18.4, follow-redirects corregido; Vite 7.3.7 y plugin compatible; lockfile actualizado | npm audit de producción sin vulnerabilidades y build aprobado |
| REV-006: smoke de 18 rutas compartía 30 segundos | Casos independientes por ruta y viewport; conserva cobertura y errores JS/overflow | Suite Chromium ampliada de 144 a 178 casos; resultado final en sección de verificaciones |
| REV-006: reloj E2E dependía del tiempo de navegación | Navegaciones controladas y comparación del contador con la fecha límite persistida | Conserva igualdad de la fecha límite y ausencia de POST de sondeo; no utiliza un texto fijo de 4:20 |

Las diez regresiones backend están en `monitoring/tests_runner_contracts.py` y entran en el descubrimiento normal. `common/audit_revalidation_20261021.py` conserva compatibilidad con la ejecución explícita anterior.

HTTP mide el tiempo hasta recibir las cabeceras y cierra la respuesta sin descargar cuerpos arbitrarios. No sigue redirecciones. Los targets privados continúan requiriendo un Guardián.

## Verificaciones locales

| Comprobación | Evidencia |
| --- | --- |
| Django completo | **244/244**, 173,137 s; base temporal creada y destruida |
| Migraciones | `makemigrations --check --dry-run`: sin cambios; `migrate --check`: exit 0 |
| Frontend | TypeScript y Vite 7.3.7 aprobados; build Docker con Node 24 aprobado |
| pip-audit del runtime | Sin vulnerabilidades conocidas; no cubre por sí solo el sistema operativo ni las dependencias vendorizadas del instalador |
| npm producción | `npm audit --omit=dev --audit-level=high`: 0 vulnerabilidades |
| Flake8 crítico | 0 incidencias en E9/F63/F7/F82 |
| Compose local y productivo | Configuraciones válidas; productivo con valores de ejemplo y certificados temporales |
| Nginx | Sintaxis del frontend y gateway aprobada con Nginx 1.30.6 |
| Chromium completo | **178/178**, 15,7 min, sin reintentos locales; 18 rutas en escritorio y móvil; pendiente de CI |
| CI remoto | Pendiente; no hay ejecución remota acreditada en esta revisión |

Se separaron los casos de navegación por módulo y se ajustó el presupuesto de la fixture Vite a 60 s por caso y 15 s por aserción. Las ejecuciones intermedias se interrumpieron para corregir carga inicial, esperas de navegación y una suposición incorrecta del reloj. Además, el log de Vite confirmó recargas causadas por los HTML de las propias trazas: se excluyeron `.tmp`, `test-results*` y `playwright-report` del watcher. Sus trazas locales se conservan; no se presentan como suites completas aprobadas.

La ejecución final completa pasó 178/178. Antes de la limpieza se verificaron dos usuarios de fixture, cero targets habilitados y cero checks. Se retiró únicamente `remediation-20261021` mediante el comando protegido de fixtures, conservando auditoría. Los archivos temporales de imagen exportada se retiraron; los informes JSON y trazas locales permanecen fuera de Git y del contexto Docker.

## Contenedores y riesgos aún abiertos

- Dockerfiles y CI pasan a Node 24; frontend y gateway referencian Nginx 1.30.6. El Dockerfile frontend instala los parches Alpine disponibles. `.dockerignore` evita incluir dependencias locales, trazas y archivos `.env` en su contexto.
- Trivy sobre la imagen backend reconstruida detectó **48 entradas High/Critical**: 44 de Debian 13.7 sin versión corregida indicada y cuatro de dependencias internas de `pip` (msgpack, setuptools y urllib3). El urllib3 del runtime es 2.8.0, pero el incluido en pip es 2.7.0. No se silenciaron mediante exclusiones ni `--ignore-unfixed`.
- La primera imagen frontend actualizada aún tenía dos High corregibles de Alpine: libexpat y libx11. Se añadió actualización de paquetes. La imagen reconstruida y exportada pasó Trivy con **0 High/Critical**, sin exclusiones.
- El análisis usa archivos exportados montados solo en lectura. La revisión automática rechazó compartir el socket Docker con Trivy; se usó esta alternativa sin acceso al daemon.
- `npm audit` completo conserva **7 entradas de desarrollo: 5 High y 2 Moderate**, en la cadena Tailwind 3 y sus herramientas. El audit de producción es cero. La corrección ofrecida implica migración a Tailwind 4 y exige revisión visual propia; no se aplicó `npm audit fix --force`.

Imágenes analizadas: backend `sha256:21c128802987af154f69a59b7e9958f58d2167fca5394f41a729b1ceb8843ef6`; frontend parcheado `sha256:29afbc561aabd08227133399e1ca01e49564c214204a3493cd530f2ecb2a887d`. Los resultados corresponden a esas construcciones locales.

El nuevo `purge_telemetry --dry-run` contó **204.016 registros históricos** afectados por la política planeada en la base local: Monitoring 134.490, API Checks 53.646, Security Headers 12.777 y DNS 3.103; seis organizaciones requieren revisión. No ejecutó eliminaciones ni cambió `RETENTION_PLAN_CAP_ENFORCED`. Revisar ese impacto antes de aplicar la política.

### Siguientes cierres verificables

1. Corregir o sustituir la imagen backend cuando existan parches para sus paquetes base y para las dependencias vendorizadas de pip; repetir Trivy sin exclusiones. Validar también la imagen del gateway utilizada en el despliegue.
2. Migrar la cadena Tailwind de desarrollo con comparación visual de dashboard y módulos; repetir auditoría completa y build.
3. Ejecutar los gates remotos de CI con estas modificaciones antes de considerar Playwright acreditado.
4. Configurar y verificar el entorno objetivo: dominio HTTPS, origen público, Turnstile real, SMTP con TLS y remitente autorizado; comprobar SPF/DKIM/DMARC y entrega al destinatario de pruebas designado.
5. Repetir el dry-run de retención y revisar su impacto con el operador antes de activar límites históricos o aplicar eliminaciones.

## Integraciones externas

La configuración local solo identifica `http://localhost:3001`; no permite deducir la URL de preproducción. SMTP no tiene host configurado y no hay claves Turnstile reales. `check_beta_readiness` falla por esas carencias y por los requisitos de dominio/remitente. Se recibió un destinatario de pruebas del usuario, pero no se envió correo sin un servicio configurado. No se deben compartir contraseñas ni tokens en el chat.
