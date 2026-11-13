# Análisis de Conectividad: funcionalidad, confianza y facilidad de uso

Fecha: 2026-11-10, America/Guatemala. Revisión sobre main, commit 46e1787. Alcance: Uptime & Latencia, SSL/TLS, DNS, Dominios, API Endpoints y Security Headers; incorporación, colas, permisos, Senti9 y alertas cuando afectan ese recorrido.

## Conclusión

La base existente se puede reutilizar: seis módulos, diagnóstico de configuración, controles de sondeo 202, límites en servidor, aislamiento por organización, lector/custom, nube/Senti9 y ficha integral con asociaciones explícitas. Sin embargo, existen errores de interpretación y de comportamiento que deben corregirse antes de ampliar el producto.

La prioridad debe ser que una persona pueda registrar un servicio, obtener su primera medición, entender su estado y resolver una incidencia sin conocer la arquitectura de Sentinel. Un cambio visual aislado no consigue ese resultado.

Este trabajo es un análisis con reproducciones. No modifica código de aplicación, permisos, planes ni datos del entorno habitual.

## Evidencia y límites

- Suite Django completa actual: **378 aprobadas** en PostgreSQL/Redis aislados (105,975 s).
- TypeScript y build Vite actuales: aprobados.
- Selección de regresiones Chromium de Conectividad: **27 aprobadas** (49,8 s). Combina lectura de listas/API y creación de un monitor desactivado reales en fixtures, con estados de medición y recorridos simulados. No son 27 comprobaciones de red reales.
- Inspección adicional de los seis directorios a 1440×900 y 390×844, más fallos 500 de cinco módulos y casos específicos de API. Sin errores JavaScript en los escenarios; sin overflow del documento ni del main. Las tablas de cinco módulos siguen siendo anchas y requieren desplazamiento interno.
- Reproducciones DNS y API en sentinel_audit, con red simulada y transacciones revertidas. No se comprobaron destinos de clientes, no se enviaron correos y no se alteró el entorno habitual.
- Las pruebas existentes aprobadas no cubren todas las reproducciones nuevas de este informe.
- Los logs remotos de main muestran que el job Playwright falló **en npm ci por EACCES en node_modules/@alloc**, antes de instalar/ejecutar Playwright. Esto es un fallo de preparación de CI, no evidencia de una prueba funcional fallida. [Log remoto](https://github.com/davis2830/Sentinela/actions/runs/42754311139/job/129627143366).

## Hallazgos prioritarios

P1 significa corregir antes de considerar fiable el flujo afectado. P2 significa mejora relevante de operación/usabilidad. No se ha demostrado una vulneración de aislamiento o autorización.

| ID | Prioridad / evidencia | Problema y consecuencia | Cambio recomendado |
| --- | --- | --- | --- |
| C01 | P1, reproducido backend | API con esquema esperado recibe HTML 200 y se registra pass: json_valid=false deja schema_valid=null y schema_ok=true. El validador también admite true como integer y omite tipos desconocidos. | Si se exige esquema, JSON inválido debe fallar. Validar el contrato de tipos al guardar; distinguir boolean/integer, tipos no soportados y error por campo. Después ampliar a estructuras anidadas sólo con contrato explícito. |
| C02 | P1, reproducido tarea DNS | Timeout de resolución sustituye el valor previo por vacío y crea DNSChangeHistory como si hubiera cambiado el registro. No se persiste TIMEOUT/NXDOMAIN/NO_ANSWER de forma diferenciada. | Separar intento de medición, último resultado válido y cambio real de respuesta. Un timeout no prueba eliminación del registro. Conservar valor/TTL anteriores identificados como datos anteriores. |
| C03 | P1, reproducido navegador | Bulk API devuelve 503 y el frontend emite dos DELETE individuales, oculta sus errores y borra selección. No demuestra elusión de permisos: el backend sigue autorizando cada llamada. | Quitar el fallback automático tras un fallo ambiguo. Mostrar aplicados/fallidos/no determinados y permitir reintento explícito sólo de lo pendiente; reconciliar estado servidor. |
| C04 | P1, reproducido navegador | Con GET 500, Monitoring muestra No se encontraron objetivos; DNS, Dominios, API y Security muestran No hay recursos. SSL ya tiene manejo explícito correcto. | Distinguir carga, error sin datos, datos anteriores y vacío real. Reutilizar el comportamiento de SSL; Reintentar conserva filtros y evita sugerir duplicar recursos. |
| C05 | P1, reproducido navegador | Última Latencia de API sin medición muestra 2000 ms, que es el límite configurado. SSL sin TLS medido muestra TLS 1.3 y sin SAN muestra 1 SAN. | Ausencia como Sin medición/—; límites y valores esperados en su contexto propio. Auditar todas las métricas derivadas con null/0/error. |
| C06 | P2, reproducido navegador | Pulsar GET en API guarda method=all y conserva GET+POST. El hook permite GET en mayúscula y el toolbar envía get en minúscula. | Un único catálogo/código de métodos en filtros, URL y comparación; comprobar los seis métodos y navegación directa. |
| C07 | P1, reproducido función | Una CSP arbitraria not-a-valid-directive recibe sus 25 puntos y estado optimal. El análisis actual busca patrones peligrosos, sin exigir directivas válidas. | Validar sintaxis y alcance efectivo, explicar qué se evaluó y marcar no evaluable lo desconocido. El score no debe presentarse como certificación de seguridad. |
| C08 | P2, comprobado código/presentación | SSL usa 15 días en lista/filtros y la ficha/estándar usa advertencia a 30 y crítico a 7. Se agrupan inválidos y vencidos; grado A/A+ se calcula con TLS negociado y días, no con auditoría TLS completa. | Política única de vigencia y etiquetas coherentes. Separar certificado vencido, confianza/hostname inválido y error de conexión; explicar el alcance de la evaluación. |
| C09 | P1, comprobado código; riesgo de cola sin reproducir carrera | Cuatro servicios crean/actualizan dentro de transaction.atomic y llaman delay antes del commit; capturan el fallo de encolado con pass. waitForFreshScan termina a 30 s devolviendo null sin indicar timeout funcional. | Encolar después de commit, persistir/registrar fallo de admisión, permitir reintento seguro y mostrar progreso duradero por comprobación. Cancelar espera al salir; no confundir aceptado, ejecutado y terminado. |
| C10 | P2, comprobado contratos | Los seis listados devuelven colecciones completas; búsqueda/filtros se hacen mayormente en cliente. Hay agregaciones que recorren modelos completos. | Paginación servidor, búsqueda y filtros con totales de alcance explícito; mantener exportación independiente y selección por página. Medir tamaño/tiempo con 25, 100 y 1000 recursos. |
| C11 | P2, comprobado código y referencias oficiales | Dominios depende de python-whois. _parse_date ignora cadenas y elige el primer valor de listas. Sin vencimiento conocido, el fallback del KPI puede contar el dominio como activo; errores y expiración se mezclan en navegación. | RDAP como fuente principal cuando proceda, fallback WHOIS por proveedor/TLD, procedencia/fecha visibles y datos ausentes explícitos. No inferir vencimiento, bloqueo ni salud desde ausencias. |
| C12 | P2, comprobado navegador | Cinco módulos tienen botones de selección de fila sin nombre accesible; a 390 px conservan tablas anchas. Monitoring ya tiene tarjetas móviles con identidad y acciones útiles. | Reutilizar su patrón móvil: identidad, estado, última medición y Ver detalle primero. Selecciones con nombre/estado, controles táctiles y foco. |
| C13 | P2, comprobado código | Al registrar recursos relacionados, el worker calcula created/existing/failed, pero el onboarding sólo remite a consultar módulos; no muestra el resultado parcial. Promete una red de alertas que todavía requiere configuración aparte. | Mostrar lista de pasos/resultados por módulo y acceso a completar alertas/canal. Reanudar sólo fallos; no crear duplicados ni afirmar que un correo está entregado. |
| C14 | P2, comprobado código/presentación | Se mezclan Target, API Check, Schema, FQDN, Squad y nombres promocionales con tareas simples. Existen dos caminos para HTTP/API/DNS/SSL que exigen comprender la diferencia de antemano. | Entrar por lo que se desea vigilar, ayuda breve de qué comprueba cada opción y parámetros avanzados progresivos. Reutilizar asistente y ficha existentes en lugar de añadir otro producto paralelo. |

### Fuentes de código para reproducir

- C01: [tarea y validador API](../backend/api_checks/tasks.py), especialmente condiciones json_valid/schema_ok y _validate_schema; [serializers](../backend/api_checks/serializers.py).
- C02: [tarea DNS](../backend/dns_monitor/tasks.py) y [update_record_scan](../backend/dns_monitor/services.py). La simulación de TIMEOUT produjo value vacío y una entrada de cambio; se revirtió la transacción.
- C03/C06: [directorio API](../frontend/src/pages/APIChecksPage.tsx); [useUrlFilter](../frontend/src/hooks/useUrlFilter.ts). Observación: methodAfterGetClick=all; dos filas conservadas; tras bulk503, dos DELETE.
- C04: hooks [DNS](../frontend/src/pages/workspaces/useDNSRecordsWorkspace.tsx), [Dominios](../frontend/src/pages/workspaces/useDomainsWorkspace.tsx), [Security](../frontend/src/pages/workspaces/useSecurityHeadersWorkspace.tsx) y páginas [API](../frontend/src/pages/APIChecksPage.tsx)/[Monitoring](../frontend/src/pages/MonitoringPage.tsx).
- C05: [drawer API](../frontend/src/components/api_checks/APICheckDetailDrawer.tsx) y [tabla SSL](../frontend/src/components/ssl/SSLCertificateTableView.tsx).
- C07: [análisis de directivas](../backend/security_headers/services.py). También revisar los snippets generados en [workspace](../frontend/src/pages/workspaces/useSecurityHeadersWorkspace.tsx): plantillas genéricas con unsafe-inline, includeSubDomains y preload necesitan contexto del servicio.
- C08: [workspace SSL](../frontend/src/pages/workspaces/useSSLCertificatesWorkspace.tsx), [servicio](../backend/ssl_monitor/services.py) y [estándar](UI_STANDARD.md).
- C09: create/update en servicios SSL, DNS, Dominios y API; [espera de resultado](../frontend/src/utils/scanPolling.ts). Monitoring ya usa on_commit para aprovisionamiento y ofrece un patrón reutilizable.
- C10: GET list de las seis views; [serialización de disponibilidad](../backend/common/scan_serializers.py) ya acota crecimiento de consultas backend, pero no pagina la carga.
- C11: [Dominios](../backend/domain/services.py) y [workspace](../frontend/src/pages/workspaces/useDomainsWorkspace.tsx).
- C13: [aprovisionamiento](../backend/monitoring/tasks.py) y [asistente](../frontend/src/components/onboarding/QuickStartWizardModal.tsx).

## Qué debería poder hacer cada módulo

| Módulo | Pregunta que debe resolver sin ayuda | Pulido funcional / UX recomendado |
| --- | --- | --- |
| Uptime & Latencia | ¿Mi servicio responde desde donde están mis usuarios, qué falló y desde cuándo? | Configuración básica nombre/destino/origen; red privada guiada con Senti9; diagnóstico DNS/conexión/TLS/HTTP/latencia; antigüedad visible; horario de mantenimiento; incidente y alerta accesibles. Conservar diagnóstico técnico bajo demanda y comparación entre estado actual e histórico. |
| SSL/TLS | ¿Mi certificado es válido y cuándo debo renovarlo? | Puerto y hostname claros; vencimiento exacto; aviso 30/7 coherente; confianza/hostname/caducidad separados; cambio de certificado identificado; origen y fecha de medición. No atribuir una auditoría criptográfica completa a un handshake. |
| DNS | ¿Resuelve como espero y cambió algo realmente? | Errores persistidos por categoría, última respuesta válida, comparación antes/después, resolver utilizado, baseline esperado opcional y revisión de cambios legítimos. Distinguir DNS de disponibilidad frente a auditoría de registros. |
| Dominios | ¿Cuándo vence mi dominio y sus datos de registro requieren atención? | RDAP/WHOIS con fuente/estado; datos parciales legibles; error de consulta separado de expiración; recordatorios configurables y acceso al registrador verificado. Revisión por TLD, incluida disponibilidad de datos en ccTLD. |
| API Endpoints | ¿La operación devuelve la respuesta y los datos que exige mi negocio? | Corregir validación JSON/esquema; criterios visibles HTTP/latencia/cabeceras/campos. Diferencias esperado/recibido por campo. Autenticación guiada y secretos protegidos. Advertir que métodos mutadores programados tienen efectos reales; preferir endpoints de salud o datos de prueba. |
| Security Headers | ¿Qué control falta, qué significa y cómo lo corrijo sin romper la aplicación? | Evaluación explicable y acotada; diferencias frente al escaneo anterior; hallazgos priorizados; propuestas por tecnología con vista previa y validación posterior. No aplicar CSP/HSTS genéricos automáticamente. |

### Comportamiento común esperado

- Una unidad de atención por servicio aprovechando la ficha/coverage existente: Uptime, SSL, DNS, dominio y seguridad vinculados explícitamente. Enlaces entre módulos sin perder búsqueda/filtros/posición.
- Crear desde un punto consistente con dos niveles: básico y avanzado. Autodetectar sólo como sugerencia; selección explícita de módulos y vista previa de límites/recursos reutilizados.
- Mostrar por recurso: estado medido, fecha, origen de ejecución y calidad/frescura del dato. Una última medición buena de hace días no acredita estado actual saludable.
- Diferenciar: sin configurar, esperando primera medición, en cola, comprobando, resultado válido, error de medición, datos anteriores, pausado y sin permiso.
- Una comprobación aceptada 202 no es una comprobación terminada. Actualizar datos sigue siendo lectura, Comprobar ahora sigue sujeto a permisos/cooldown.
- Acciones específicas, errores junto a la tarea, una acción principal y confirmación sólo cuando aporte control; evitar confirmaciones repetidas de lecturas.
- Configurar una alerta y su canal desde el recurso. Probar el canal explícitamente, mostrar aceptación/entrega conocida sin prometer recepción; recuperación y supresión por mantenimiento verificables.
- Evitar fatiga de alertas: proponer umbrales/persistencia y agrupación con evidencia; no introducir reintentos ciegos ni desactivar las protecciones contra SSRF/red privada.

## Flujo propuesto

1. **Añadir servicio:** introducir URL, dominio o host/puerto.
2. **Elegir desde dónde:** Internet o red privada; guía Senti9 cuando corresponda.
3. **Comprobar configuración:** resultado comprensible, corrección sugerida y parámetros avanzados opcionales. Una redirección exige confirmación explícita y nueva prueba.
4. **Elegir cobertura:** qué módulos se crearán/reutilizarán, cuotas y frecuencia efectiva por módulo.
5. **Guardar y acompañar:** progreso de cada recurso hasta primera medición o error recuperable; sin esconder fallos parciales.
6. **Elegir aviso:** regla y canal, con configuración pendiente si se omite.
7. **Operar:** problema → dato que lo demuestra → causa conocida o diagnóstico acotado → acción → nueva comprobación → recuperación.

No exigir una nueva entidad Service ni una reescritura para empezar. El asistente y la ficha de endpoints ya resuelven parte del recorrido; completar y unificar esos flujos es el primer paso.

## Orden de ejecución recomendado

1. **Confianza del resultado:** C01–C05 y C07; casos de ausencia, error, medición falsa, operaciones parciales y DNS sin falsas mutaciones. Convertir cada reproducción en regresión antes de corregir.
2. **Ejecución observable:** C09; estados persistentes de admisión/ejecución, antigüedad, primer resultado y fallos de aprovisionamiento. Extender pruebas de cambio de configuración durante una comprobación a los seis módulos.
3. **Recorrido sencillo y coherente:** C06, C08, C12–C14; campos básicos/avanzados, lenguaje, móvil, configuración de alertas y parámetros compartidos.
4. **Capacidad y evolución:** C10/C11; directorios servidor, agregaciones y RDAP. Asegurar la compatibilidad de contratos y consumidores; mantener las cuotas/permisos.
5. **Piloto de usabilidad y fiabilidad:** participantes representativos resuelven tareas sin ayuda, con tiempos y errores registrados. Corregir CI de instalación para obtener evidencia remota de la revisión final.

### Aceptación y métricas propuestas

Son metas de producto a medir, no resultados obtenidos:

- Crear un primer monitor público sin ayuda en unos tres minutos; medir también tasa de finalización y abandonos por paso.
- Identificar qué falló y dónde continuar en menos de treinta segundos usando una incidencia preparada.
- Ningún desconocido o fallo de consulta se presenta como saludable, vacío real o medición inventada.
- Todas las acciones visibles tienen resultado verificable y recuperación; ningún fallo ambiguo provoca nuevas mutaciones automáticas.
- Matriz funcional por módulo: crear/editar/pausar cuando exista/eliminar; permisos; cuotas; red privada; destinos inválidos; primer sondeo; timeout; error broker/worker; recuperación; selección masiva parcial; histórico; alerta y mantenimiento.
- Fixtures con 25/100/1000 recursos y varias organizaciones; consultas, payload, tiempos y cancelación medidos. No imponer un SLA de rendimiento sin medir una referencia.
- 1440×900, 1366×768 y 390×844; teclado, nombres de selección, foco y controles. Pruebas específicas de lector/custom y datos de otra organización.
- Recorrido controlado con servicios de prueba HTTP/TCP/TLS/DNS y API, fallos inyectados y Senti9 real; no sustituirlo por mocks ni ejecutar pruebas destructivas contra clientes.

## Referencias de producto y protocolos

- [GOV.UK: recuperación de validaciones](https://design-system.service.gov.uk/patterns/validation/) y [revisión antes de enviar](https://design-system.service.gov.uk/patterns/check-answers/): errores concretos y contexto antes de cambios.
- [Carbon: estados vacíos](https://www.carbondesignsystem.com/building-blocks/core/patterns/empty-states): ausencia, filtro sin coincidencias y problema del sistema deben diferenciarse.
- [W3C: identificación de errores](https://www.w3.org/WAI/WCAG22/Understanding/error-identification) y [mensajes de estado](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html): texto comprensible y resultados anunciados sin mover el foco innecesariamente.
- [ICANN: transición a RDAP](https://www.icann.org/en/announcements/details/icann-update-launching-rdap-sunsetting-whois-27-01-2025-en): desde el 28 de enero de 2025 RDAP es fuente definitiva de datos de registro gTLD; [requisitos y excepciones](https://www.icann.org/en/contracted-parties/registry-operators/resources/registration-data-access-protocol). No extender esa obligación a todos los ccTLD.
- [Chrome: despliegue gradual de HSTS](https://developer.chrome.com/docs/lighthouse/best-practices/has-hsts) y [MDN: alcance de HSTS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security): las plantillas requieren validar subdominios y consecuencias.

## Capturas del análisis

Datos ficticios; las capturas no representan clientes ni mediciones externas:

- [API: última latencia sin medición](assets/connectivity-review-20261110/api-unmeasured-detail.png).
- [SSL: TLS/SAN sin medición](assets/connectivity-review-20261110/ssl-1440.png).
- [API móvil: tabla ancha](assets/connectivity-review-20261110/api-checks-390.png).
- [DNS: error 500 presentado como vacío](assets/connectivity-review-20261110/failure-dns.png).
- [Dominios: error 500 presentado como vacío](assets/connectivity-review-20261110/failure-domains.png).
- [Observaciones estructuradas de navegador](assets/connectivity-review-20261110/observations.json).

Scripts de reproducción y logs locales permanecen en .tmp, excluidos de Git. El informe no da por corregidos sus hallazgos ni certifica accesibilidad o producción.
