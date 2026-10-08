# Dashboards por área y módulos compactos

El Centro de Conectividad conserva `/dashboard` como destino después del login y del onboarding. Muestra estado actual, tendencias y contexto operativo de Web, API, TCP, SSL, DNS, dominios, Security Headers y Sentinine. El Resumen de gestión en `/gestion` concentra coordinación operativa sin sustituir los módulos especializados. Sistema mantiene su organización actual.

El onboarding se abre para administradores sin monitores y con habilitación operativa. Una prueba vencida no puede crear recursos ni ejecutar scans; el aviso explica la contratación y la confirmación de pago pendientes. Véase [suscripciones, onboarding y cobertura](SUBSCRIPTIONS_ONBOARDING.md).

## Jerarquía de información

Monitoring conserva el drawer rápido y permite abrir una página integral para cada endpoint HTTP/HTTPS, con disponibilidad, SSL, DNS, dominio/WHOIS, seguridad web, actividad y asociaciones explícitas. Véase [ficha integral del endpoint](ENDPOINT_DOSSIER.md). Esta ampliación tiene su propio endpoint de cobertura y una migración aditiva; no cambia los contratos originales de los dashboards por área.

La cabecera usa una barra compacta con período y controles de refresco. Los avisos de cuenta se muestran como franjas breves y los cuatro KPIs comparten un único panel dividido, reservando la primera pantalla para las gráficas. En la prueba local de 1440×900, rendimiento y dona completos caben con los avisos de suscripción y 2FA visibles.

La interfaz usa Plus Jakarta Sans como fuente principal. JetBrains Mono se reserva para datos técnicos; los KPIs usan números tabulares de la fuente principal. Los componentes compartidos de resumen reducen su altura y espaciado también en los módulos. En móvil, el menú lateral inicia contraído y se despliega sobre el contenido.

- Cuatro KPIs resumen salud actual, disponibilidad del período, latencia promedio y elementos que requieren atención.
- Rendimiento global presenta latencia, disponibilidad y comprobaciones/minuto en tres franjas con el mismo eje temporal y tooltip compartido. No superpone escalas ni áreas; los porcentajes completos caben en móvil. Referencias visuales: 500 ms de latencia y disponibilidad inferior a 99%; no son un SLO contractual.
- La dona clasifica recursos como saludables, degradados, caídos o sin datos. Muestra siempre los cuatro estados con conteos y porcentajes, incluido cero; cada segmento o control filtra la bandeja y el centro restablece el filtro. El centro presenta el porcentaje saludable con color semántico, no un score sin unidad. Sin recursos se muestra un aro neutro, no un segmento ficticio de un recurso. Si falla una fuente, se advierte estado incompleto y se deshabilitan los filtros de salud sin afirmar un porcentaje global.
- Las barras de Web, API, TCP, SSL, DNS, dominios, seguridad y Sentinine filtran por módulo y desglosan proporciones saludables, degradadas, caídas y sin datos. Los controles admiten teclado y `aria-pressed`; los segmentos tienen descripción accesible. Sin recursos, consulta pendiente y fallo del módulo tienen textos distintos; una fuente fallida no se presenta como cero ni saludable.
- En móvil, la bandeja de atención aparece antes que las gráficas analíticas.

El período `1h / 6h / 24h / 7d` afecta rendimiento y actividad. La bandeja conserva el estado actual para no ocultar incidentes activos fuera de la ventana elegida.

La gráfica de rendimiento usa exclusivamente históricos de Monitoring, no sondeos SSL/DNS/WHOIS ni resultados de API Checks nativos. `global-performance/` entrega `checks` y `checks_per_minute` por intervalo, y el promedio de comprobaciones/minuto del período en `summary`. Se mantiene `requests` como alias de compatibilidad. Los buckets inicial y actual usan su duración observada real; las tasas conservan seis decimales para no redondear a cero volúmenes pequeños. Horas sin checks tienen disponibilidad y latencia `null`, sin rellenado de 100% ni arrastre de latencias anteriores. Un período vacío o una consulta fallida muestra un estado explícito sin curvas. Metadatos de volumen ausentes se presentan como no disponibles, nunca `undefined`.

El eje X usa timestamps completos como coordenadas, no etiquetas horarias como categorías: las horas repetidas de días diferentes no eliminan las series de 24 h o 7 días. Los tres paneles comparten dominio temporal; el tooltip muestra la fecha completa. Una leyenda auxiliar informa cuántos intervalos contienen mediciones. No se recorta el período para esconder horas vacías ni se conectan puntos a través de huecos.

Los indicadores del cursor permanecen sincronizados en las tres franjas, pero solo se presenta un tooltip: en la franja que tiene el puntero o el foco de teclado. Al abandonar esa franja se oculta su contenido, evitando ventanas repetidas con los mismos datos.

El tooltip de la dona utiliza fondo opaco y una capa superior al botón central. El porcentaje y las etiquetas del centro no atraviesan su contenido; la ventana no captura clics y se conservan los filtros y el restablecimiento.

## Bandeja de atención

El frontend normaliza en tarjetas Monitoring, API Checks, SSL, dominios, DNS, Security Headers, alertas, incidentes y agentes Sentinine. Los problemas críticos se muestran antes que las advertencias; dentro de la misma prioridad se ordenan primero los problemas activos más antiguos o los vencimientos más próximos.

Las alertas vinculadas a un incidente visible se agrupan en la tarjeta del incidente. La vista `Atención` muestra problemas críticos y advertencias; `Todos` incorpora recursos saludables y sin datos. Nunca se interpreta “sin datos” como saludable.

Cada tarjeta abre un drawer unificado con resumen, última señal, valores relevantes y enlace al módulo. Administradores pueden comprobar recursos únicamente desde el detalle, si el backend indica disponibilidad, y reconocer alertas. Pausar, editar, resolver o gestionar incidentes continúa requiriendo el módulo especializado. Viewer no recibe controles de mutación.

## Actividad y resiliencia

Actividad operativa combina estados recientes, alertas, incidentes y `audit-logs/?limit=25`. Admite filtros `Todo`, `Operación` y `Cambios`, muestra hasta ocho eventos y respeta el período temporal.

Todas las fuentes se actualizan cada 30 segundos. Un fallo parcial no derriba el dashboard: se conserva la información disponible, se muestra una advertencia y el origen ausente permanece como no disponible.

## Resumen de gestión

Es el primer enlace del grupo Gestión. Consulta exclusivamente los GET existentes de alertas, incidentes, mantenimientos, notificaciones, reportes y páginas de estado; se actualiza cada 30 segundos y no introduce mutaciones directas.

- Franja de alertas sin resolver, incidentes activos, mantenimientos en curso y notificaciones fallidas en las últimas 24 horas.
- Barras de severidad y dona de estado enlazan al módulo con filtros visibles en la URL. Los filtros desconocidos vuelven a Todos.
- Pendientes ordenados por gravedad y antigüedad, con ocho visibles; las alertas de un incidente visible no se duplican. Incluye fallos de notificación y reporte de las últimas 24 horas.
- Agenda con cinco mantenimientos en curso o programados para los próximos siete días.
- Resumen de seis módulos; Status Page informa páginas configuradas y públicas, no una supuesta salud global.

En móvil los pendientes preceden a las gráficas. Si una fuente falla, su conteo aparece como no disponible, nunca como cero.

## Espacios de trabajo compactos

Los doce módulos conservan encabezado breve, franja de conteos y búsqueda/filtros. A petición del usuario, Conectividad recupera las tablas anteriores de Uptime & Latencia, SSL, DNS, dominios, API Checks y Security Headers, con sus columnas, indicadores y acciones de edición. Gestión mantiene las filas ligeras. Lista es el valor inicial; una preferencia guardada conserva Cuadrícula. Se mantienen selección, exportación, formularios y drawers. Status Page conserva su editor y configuración.

Las tablas de Conectividad contienen su desplazamiento horizontal dentro de la tabla en pantallas pequeñas; no ensanchan la página. La restauración es visual: no vuelve a introducir controles de sondeo en las filas ni elimina permisos administrativos, límites por plan o metadatos de disponibilidad. Las filas pueden abrir el detalle con teclado.

La franja de Uptime & Latencia muestra Targets, Online, Lentos, Caídos y Pausados en una barra compacta con iconos, contadores tabulares y color semántico. El estado seleccionado se destaca y actúa como filtro de la tabla, también mediante teclado. No incorpora nuevas tarjetas KPI ni mediciones inventadas; un valor ausente conserva el indicador no disponible.

SSL, DNS, dominios, API Checks y Security Headers usan el mismo estilo de barra, con iconos y colores para sus conteos existentes. Se mantienen los filtros propios de cada módulo, sin añadir nuevos filtros o acciones. En móvil los textos largos se distribuyen en dos columnas.

`Actualizar datos` recarga solo las consultas activas de la pantalla y organización. La hora de consulta no representa una nueva medición. No hay controles de sondeo masivo en cabeceras o barras de selección; los endpoints existentes siguen protegidos por el backend.

En los seis módulos de Conectividad, `En vivo` y el polling GET siguen el mínimo contractual de la suscripción (Free 5 min, Pro 60 s), no 15 segundos. La recarga manual muestra que no ejecutó un sondeo. El contador es de consulta de resultados, no de la próxima medición individual; el recurso conserva su programación y cooldown. Sin metadatos válidos no se activa el polling. Los dashboards conservan su lectura global de 30 segundos.

Los GET de Monitoring, API Checks, SSL, DNS, dominios y Security Headers incluyen `scan_availability`, de solo lectura. La precedencia es suscripción, permisos, pausa, Sentinine, reserva pendiente, cooldown y disponible. Solo cooldown devuelve `next_allowed_at` y `retry_after_seconds`; pendiente no promete una fecha de finalización. GET no crea reservas y las listas cargan reservas por lote. Tokens de solo lectura reciben `read_only`.

`Comprobar ahora` aparece únicamente para administradores en el detalle. Si falta disponibilidad o falla su consulta, queda deshabilitado con recarga disponible. El contador es informativo: cada POST continúa validando admisión y puede devolver 429 por concurrencia. Free respeta 300 s y Pro 60 s, además de intervalos configurados más lentos.

## Implementación y evidencia local

- Piloto visual de Uptime & Latencia aprobado y extendido el 2026-10-05 a los módulos de Conectividad, Gestión y Sistema, navegación y portales de formularios/detalles. Marca emerald, Online verde y latencia cyan; textos secundarios blanco suave `#E2E8F0`, auxiliares `#CBD5E1`. Las gráficas de ambos dashboards conservan su semántica y filtros con colores más vivos. Sin cambios de permisos, cadencia por plan ni scans.
- Últimos gates locales de extensión: Django 105/105, Chromium 76/76 y TypeScript/Vite aprobados; estilos comprobados en 17 rutas y revisión visual 1440×900 y 390×844. Contraste probado para texto secundario de tabla en fixture, no certificación global. CI y producción pendientes.
- `DashboardPage.tsx` coordina consultas, filtros, drawer y mutaciones.
- `dashboardModel.ts` contiene normalización, deduplicación, prioridad y tipos compartidos.
- Los componentes visuales viven en `frontend/src/components/dashboard/` y conservan Recharts y los tokens NOC existentes.
- `ManagementDashboardPage.tsx` presenta Gestión y `managementModel.ts` normaliza pendientes y agenda.
- Cabeceras, franjas, filas, recarga, foco de drawers y disponibilidad se comparten entre módulos. Las claves de consulta incluyen organización y filtros.
- No se agregaron dependencias, endpoints ni migraciones; se ampliaron los GET existentes con metadatos de sondeo.
- Validación local del 2026-10-03: Django 65/65, Chromium 56/56 y build TypeScript/Vite aprobados. Se revisaron desktop 1440×900 y móvil 390×844. Las pruebas de interfaz combinan autenticación/alta reales con telemetría aislada mediante fixtures; no certifican datos productivos.
- CI sigue pendiente; producción está fuera de esta fase.
