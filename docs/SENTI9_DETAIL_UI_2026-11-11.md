# Detalle operativo de Senti9: superficies y jerarquía

Revisión local del 11 de noviembre de 2026. Se rediseña la pestaña **Operación** y la navegación del drawer; no cambian API, permisos, consultas, credenciales ni runtime.

## Cambios

- Fondo base oscuro con tres tarjetas elevadas independientes: conexión, entrega del servidor y cola local. Bordes blancos discretos, radio de 12 px y padding de 20 px.
- Estados en píldoras: conexión junto a la identidad y evaluación de telemetría a la derecha del título de cola. El pulso respeta movimiento reducido. Datos anteriores, desconexión, drenaje y errores conservan su significado y color.
- Pestañas segmentadas con selección de mayor contraste. La variante es opcional en `NOCDrawer`: los consumidores existentes conservan sus pestañas por defecto.
- Crear monitor privado y Ver monitores asignados se presentan como botones con iconos, agrupados al pie de Conexión. Conservan navegación mediante enlaces y la capacidad `monitoring.create`.
- Métricas en tres columnas con cajas internas, etiquetas pequeñas en mayúsculas, contadores monoespaciados de 24 px y fechas monoespaciadas en hora local, formato de 24 horas.
- Capacidad de cola con barra accesible y último acuse. El total suma únicamente En espera, Ejecutando y Por enviar del agente; no incluye pendientes del servidor. Una cola o capacidad desconocida no produce porcentaje ni contadores saludables ficticios.
- Notas secundarias con icono Info. Red y sistema permanece plegado bajo demanda.

La presentación se concentra en `Senti9Operation` y primitivas pequeñas en `Senti9DetailUI`. `ProbeTelemetry` comparte las mismas reglas de vigencia y diagnóstico entre la nueva variante de tarjeta y la presentación compacta anterior.

## Evidencia visual

| Resolución | Inicio del drawer | Cola y capacidad |
| --- | --- | --- |
| 1440×900 | [Operación](assets/senti9-detail-20261111/operation-1440.png) | [Cola](assets/senti9-detail-20261111/queue-1440.png) |
| 1366×768 | [Operación](assets/senti9-detail-20261111/operation-1366.png) | [Cola](assets/senti9-detail-20261111/queue-1366.png) |
| 390×844 | [Operación](assets/senti9-detail-20261111/operation-390.png) | [Cola](assets/senti9-detail-20261111/queue-390.png) |

Las capturas usan cuenta aislada y un fixture de presentación sobre el contrato de lectura real: conexión activa, cuatro monitores, dos pendientes del servidor y cola local vacía. Son datos controlados para inspección visual, no evidencia de mediciones de clientes. No se enviaron mutaciones desde el recorrido visual. [Resultado del recorrido](assets/senti9-detail-20261111/visual-validation.json).

## Validación local

- Django completo: **399 pruebas aprobadas**, base aislada.
- Chromium: **18 regresiones aprobadas** de Senti9, instalación y telemetría. Incluyen alta y token real aislado, primera señal, retiro, permisos de lectura, tres resoluciones y estados de telemetría.
- Después del ajuste final de formato horario: **5 regresiones de telemetría repetidas y aprobadas**, más capturas renovadas y recorrido de las pestañas con teclado, Escape y devolución del foco en las tres resoluciones.
- Regresión adicional del drawer habitual de Monitoring: **1 aprobada**, conserva filtros, selección, apertura y cierre después de actualizar. Total: 19 escenarios Chromium distintos aprobados.
- TypeScript/build, ESLint, formato de archivos modificados y reproducibilidad de tipos OpenAPI: aprobados.
- La variante compacta de telemetría conserva sus regresiones de drenaje, errores, datos anteriores y ausencia de datos. La nueva tarjeta comprueba ocupación actual, retirada de la barra al perder vigencia y capacidad desconocida.
- `localhost:3001` sirve el componente operativo y sus estilos con HTTP 200; los cambios del frontend ya están disponibles en el entorno habitual.

Registros locales: `.tmp/senti9-detail-*`. No se modificaron agentes reales ni se publicó otra imagen. CI remoto y despliegue no forman parte de esta revisión.

## Extensión a las tarjetas del directorio

La composición posterior del listado sustituye las cajas de métricas por una tira compacta y reduce el ruido de cabecera y acciones: [revisión vigente del directorio](SENTI9_DIRECTORY_COMPOSITION_2026-11-11.md). Las capturas siguientes conservan la fase previa.

Las filas del listado reutilizan ahora `DetailBadge`, `DetailStat`, `DetailTimestamp` y `DetailNote`: tres métricas en cajas con fondo negro tenue, contadores grandes, nombre destacado, host monoespaciado y estado en píldora. Se retiran las separaciones por líneas y la barra morada de la explicación. Todas las acciones se presentan como botones de 44 px: Crear monitor tiene énfasis emerald; detalle, instalación y monitores usan borde secundario.

En móvil, monitores y versión comparten la primera fila y la última señal ocupa la segunda. Se conservan búsqueda, filtros, página de 25, condiciones de visibilidad de las acciones y destinos de navegación. Los datos anteriores tras una consulta fallida se identifican y no muestran un pulso de conexión vigente.

| Resolución | Antes | Después |
| --- | --- | --- |
| 1440×900 | [Tarjeta](assets/senti9-list-20261111/before-card-1440.png) | [Tarjeta](assets/senti9-list-20261111/after-card-1440.png) · [Pantalla](assets/senti9-list-20261111/after-page-1440.png) |
| 1366×768 | [Tarjeta](assets/senti9-list-20261111/before-card-1366.png) | [Tarjeta](assets/senti9-list-20261111/after-card-1366.png) · [Pantalla](assets/senti9-list-20261111/after-page-1366.png) |
| 390×844 | [Tarjeta](assets/senti9-list-20261111/before-card-390.png) | [Tarjeta](assets/senti9-list-20261111/after-card-390.png) · [Pantalla](assets/senti9-list-20261111/after-page-390.png) |

Comparación con un fixture visual idéntico antes y después, sobre la lectura de API aislada, sin cambiar agentes reales. El recorrido comprueba ausencia de scroll horizontal, apertura de detalle e instalación, Escape, devolución del foco, destinos de monitores y áreas táctiles. [Resultados visuales](assets/senti9-list-20261111/visual-validation.json). Registros específicos: `.tmp/senti9-list-*`.

Validación posterior del listado: **399 pruebas Django y 13 regresiones Chromium aprobadas**; build/TypeScript, ESLint, formato y tipos OpenAPI vigentes aprobados. `localhost:3001` sirve el módulo actualizado con HTTP 200. Sin cambios de API, dependencias, permisos ni agentes instalados; CI remoto y despliegue permanecen separados.
