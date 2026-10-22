# Ficha integral de endpoints HTTP/HTTPS

## Presentación vigente — 2026-10-22

Aplica el [estándar UI/UX v1.2](UI_STANDARD.md): encabezado compacto, franja de indicadores y gráfica junto a los cuatro vínculos/atención en un panel lateral. La gráfica completa y los vínculos deben caber al entrar en escritorio, sin filas de cards grandes encima. Ejecutores, frecuencia y fechas exactas permanecen en **Detalles del monitoreo**. Las pestañas mantienen URL/retorno y admiten scroll contenido en móvil. El resumen y Disponibilidad comparten período; las estadísticas avanzadas de la gráfica se consultan en **Detalles de latencia**. Los huecos permanecen sin curvas inventadas. Véase [implementación y evidencia local del resumen](UI_STANDARD_IMPLEMENTATION_2026-10-21.md).

## Acceso y contenido

Las pestañas SSL/TLS, DNS, Dominio y Seguridad aplican el patrón de indicadores y detalle técnico desplegable; Actividad y Configuración usan distribución compacta. Consulte [la aplicación del 2026-10-22](ENDPOINT_TABS_UI_2026-10-22.md) y [el estándar UI v1.2](UI_STANDARD.md).

Desde Uptime & Latencia, abre un target HTTP/HTTPS y selecciona **Abrir vista completa del endpoint** en el drawer. La página `/monitoring/:targetId` conserva el contexto de retorno y admite enlaces con `?tab=ssl`, `dns`, `domain`, `security`, `availability`, `activity` o `config`. Un tab inválido vuelve a Resumen.

- Resumen: problemas detectados, cobertura vinculada y disponibilidad/rendimiento.
- Disponibilidad: períodos 24 h / 7 d / 30 d, curva, disponibilidad diaria, interrupciones y últimas comprobaciones.
- SSL/TLS: certificado, emisor, nombres alternativos, puerto, vencimiento y datos técnicos disponibles.
- DNS: registros asociados y sus cambios recientes.
- Dominio: información WHOIS del dominio configurado y seleccionado explícitamente.
- Seguridad web: score, controles y última evaluación de cabeceras, directivas y fugas.
- Actividad: alertas e incidentes de los recursos confirmados y auditoría con asociación estructurada al target. Las alertas de un incidente visible no se duplican.
- Configuración: selección explícita de recursos existentes y navegación a sus módulos.

Cada fuente conserva su propia fecha de medición. Recursos no configurados, pendientes de asociación, sin mediciones y no aplicables tienen mensajes distintos. Un fallo parcial no invalida el resto de la ficha; un período sin checks no presenta una disponibilidad calculada. Los registros de auditoría antiguos sin `metadata.target_id` no se asocian por coincidencia de texto.

## Asociaciones seguras

`TargetCoverage` almacena una asociación por target: SSL, dominio y Security Headers opcionales, y varios registros DNS. La migración `monitoring.0006_targetcoverage` es aditiva, sin backfill ni modificaciones de recursos existentes.

Los targets anteriores requieren confirmación del administrador en Configuración. El aprovisionamiento de nuevos targets registra únicamente los recursos SSL/DNS/seguridad que realmente utilizó y que cumplen la coincidencia; no deduce WHOIS automáticamente. Desvincular no elimina el recurso de su módulo.

| Sección | Regla de correspondencia |
| --- | --- |
| SSL | Misma organización, hostname exacto y puerto; únicamente HTTPS |
| DNS | Misma organización y hostname exacto, no el dominio padre |
| Seguridad web | Misma organización y URL normalizada exacta, incluidos ruta y parámetros; no se siguen redirects |
| WHOIS | Dominio configurado igual al hostname o ancestro con límite de etiqueta; selección explícita del dominio registrable |

No se implementa un resolvedor Public Suffix List ni se supone que las últimas dos etiquetas sean el dominio registrable. Por ejemplo, el administrador selecciona `example.co.uk` configurado para `portal.example.co.uk`. El modelo SSL existente conserva su unicidad por organización/dominio: no se vincula un certificado de un puerto distinto aunque tenga el mismo hostname.

Si un endpoint cambia o una asociación deja de cumplir estas reglas, los resultados anteriores se ocultan y se solicita revisar la asociación. No se exponen candidatos ni datos de otra organización. TCP y API quedan fuera de esta primera ficha HTTP/HTTPS; Sentinine no activa cobertura Cloud ni consultas a destinos privados. Los hosts IP no reciben DNS/WHOIS de dominio.

## Contratos y acciones

- `GET /api/v1/monitoring/:targetId/coverage/`: secciones con estado, recursos confirmados y candidatos resumidos; actividad relacionada. Máximo 50 candidatos por sección, 25 alertas, 10 incidentes y 25 cambios.
- `PATCH` en la misma ruta: `{ "ssl": ["uuid"], "dns": ["uuid", "uuid"], "domain": ["uuid"], "security": ["uuid"] }`. Se pueden enviar solo las secciones modificadas; `[]` desvincula. Validación tenant-aware y escritura transaccional, con auditoría. Requiere administrador y habilitación operativa vigente.
- Alias existente `monitoring-targets/` conserva el mismo contrato.

GET no crea recursos, reservas ni tareas y no realiza conexiones salientes. Reservas de sondeo se consultan por lote; las organizaciones de los recursos validados se reutilizan para evitar una consulta por registro DNS.

La lectura automática usa la cadencia del plan (Free 300 s, Pro 60 s; otros planes según sus metadatos). Si faltan metadatos, no se presupone un intervalo. La cabecera distingue consulta de interfaz y medición real; la frecuencia efectiva del target respeta también su intervalo más lento.

Recargar solo consulta datos guardados. `Comprobar ahora` conserva `scan_availability`, POST 202, polling de resultado nuevo y validación backend/429. Cada recurso tiene su propio cooldown; no existe comprobación masiva de cobertura. Viewer puede consultar y navegar, pero no comprobar ni guardar asociaciones.

## Evidencia local — 2026-10-05

Django completo **117/117**, Playwright Chromium **82/82**, TypeScript/build Vite aprobados. Doce pruebas de backend cubren asociaciones, aislamiento, ausencia de escrituras/red en GET, WHOIS multietiqueta, protocolo/puerto/ruta, permisos, drift, auditoría y consultas constantes con varios registros DNS. Seis flujos de interfaz nuevos cubren acceso desde drawer, tabs, confirmación, Viewer, fallos parciales, cooldown, 202, retorno con filtros y viewport móvil sin desbordamiento.

Las pruebas de interfaz usan cuentas aisladas y respuestas controladas para escenarios de cobertura; las pruebas Django ejercitan los endpoints reales con una base de prueba independiente. Revisión visual local 1440×900 y 390×844. Migración aplicada y worker recargado localmente; fixtures retirados conservando auditoría. No constituye evidencia de CI ni aprobación de producción.

### Disponibilidad — mejora del 22 de octubre de 2026

Bitácora compacta con duración visible y diagnóstico desplegable. Últimas comprobaciones con filtro local de estado, cinco registros iniciales y ampliación de cinco en cinco, hasta los 20 consultados por la ficha. El filtro de comprobaciones es independiente del período histórico. La ausencia de latencia se conserva. Los intervalos de interrupción se presentan como estimados porque el backend también genera un fin cuando no encontró una recuperación.

### Panel lateral compacto — 2026-10-22

El drawer es una consulta rápida: estado actual, tres métricas, curva media de 24 horas y tres comprobaciones. Las pestañas del drawer se reemplazan por enlaces a Disponibilidad y Configuración de la ficha HTTP/HTTPS, conservando los filtros del listado. El menú Más mantiene exportación, creación de alertas y edición según permisos. Los demás protocolos conservan detalles operativos desplegables y edición en el panel. No se muestran cabeceras personalizadas en esta consulta rápida.

### Fuente de verdad de mediciones — v1.3

Los estados históricos registrados tienen prioridad sobre el umbral actual. Las medias históricas son descriptivas, la línea de umbral se identifica como actual y los intervalos vacíos son no_data/null. El calendario calcula su propio agregado de 30 días en fecha local. Los detalles de criterio y evidencia están en [criterios unificados](MEASUREMENT_CRITERIA_IMPLEMENTATION_2026-10-22.md).

### Límite aplicado y diagnóstico — v1.4

El listado muestra límite actual y diagnóstico estructurado. Los fallos usan guion para latencia; el panel conserva Tiempo del intento y el límite aplicado cuando existe. Cloud captura su política de ejecución y Sentinine 1.2.0 la reporta; los registros antiguos indican No registrado. Detalles en [límites y diagnóstico](MONITORING_DIAGNOSTICS_2026-10-22.md).
