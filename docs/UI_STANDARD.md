# Estándar UI/UX de Sentinel — v1.5

Actualizado: **2026-10-22**. Referencia para cambios nuevos de interfaz y revisiones de módulos existentes.

## Objetivo

En pocos segundos se debe reconocer **qué ocurre, qué dato lo demuestra y qué acción tomar**. Priorizar una vista operativa completa al entrar: último estado, vínculos y gráfica visibles juntos. Mantener cifras legibles dentro de una franja compacta; los detalles técnicos se consultan bajo demanda.

## Identidad y componentes

- Conservar Plus Jakarta Sans; JetBrains Mono para valores técnicos cuando aporte legibilidad. No añadir fuentes.
- Conservar Lucide y los iconos existentes de cada módulo. Acompañar los estados con texto; el color no es la única señal.
- Reutilizar los tokens `--sentinel-*` de `frontend/src/index.css` y `frontend/tailwind.config.js`. Mantener superficies grafito opacas y bordes discretos.
- `MetricCard` es la referencia reutilizable de indicador. `.ui-card`, `.ui-button`, `.ui-status` y `.ui-coverage` definen superficies, acciones y estados. Usar `data-tone` con `success`, `warning`, `danger`, `info` o `muted`.

## Jerarquía de una ficha

1. **Identidad:** nombre, URL y último estado medido. Un único botón principal de comprobación, actualización secundaria y control automático discreto.
2. **Navegación:** pestañas con estado activo claro y desplazamiento horizontal contenido en móvil.
3. **Indicadores:** máximo cuatro métricas principales en una franja, sin cards individuales; cifra de 32 px, etiqueta de 12–14 px, unidad menor y alcance explícito.
4. **Cuerpo operativo:** gráfica a la izquierda y panel de vínculos/atención a la derecha. Los cuatro vínculos permanecen visibles como filas con icono, resultado o estado real y acceso directo.
5. **Atención:** en el panel lateral, prioridad crítica primero; dos elementos iniciales y resto desplegable. Evitar otra fila de paneles antes de la gráfica.
6. **Histórico:** selector de período dentro de la cabecera de la gráfica en Resumen; leyenda y estadísticas avanzadas desplegables. Disponibilidad conserva el detalle ampliado.

**Criterio de aceptación:** con los detalles cerrados, la gráfica completa y los cuatro vínculos deben caber sin desplazamiento vertical en 1440×900 y 1366×768, incluso con incidentes activos. No utilizar columnas de cards grandes que releguen la gráfica al final. En móvil, mostrar primero los vínculos compactos y conservar el gráfico accesible debajo; no reducir el texto para intentar comprimir toda la ficha en una pantalla estrecha.

El estado de la última comprobación y el agregado histórico son conceptos distintos. Un endpoint puede estar operacional en la última medición y conservar baja disponibilidad en 24 horas; ambos datos deben ser reconocibles y no compartir una etiqueta ambigua.

## Tipografía, espacio y responsive

| Elemento | Referencia |
| --- | --- |
| Título de ficha | 24–30 px, peso 700 |
| Indicador principal | 32–40 px, números tabulares, unidad de 14 px |
| Valor de cobertura | 24 px; permitir salto de línea |
| Texto normal y acciones | 14 px; metadatos compactos de 12 px como mínimo |
| Espaciado | Múltiplos de 4 px; gaps de 8–16 px; secciones de 16–24 px |
| Card | Radio 16 px, borde de 1 px, padding 16 px |
| Acción principal/secundaria | Alto mínimo 44 px; icono de 16–20 px; foco visible |

En móvil: indicadores en dos columnas, vínculos en filas compactas, acciones que envuelven, URL y valores largos con salto. Mantener accesible la gráfica después de los vínculos. El documento no debe tener scroll horizontal. El scroll propio de pestañas debe permitir llegar a todas las secciones con teclado. Conservar foco visible, nombres accesibles para iconos y preferencia de movimiento reducido.

## Semántica de datos y color

- **Verde saludable:** resultado positivo medido. El turquesa de marca identifica acciones y selección.
- **Ámbar:** advertencia o degradación. **Rojo:** fallo o condición crítica. **Neutro:** información descriptiva, ausencia de información, asociación pendiente o recurso no aplicable. No usar celeste/cian para mediciones ni gráficas.
- Distinguir `Sin configurar`, `Sin vincular`, `Revisar vínculo`, `Sin medición`, `Error de medición` y `No aplica`.
- No convertir un `null`, un error de consulta o cero comprobaciones en cero latencia, 100 % de disponibilidad o seguridad saludable. Mostrar `—` cuando el valor no se conoce.
- Una cifra de seguridad exige recurso vinculado, fecha de medición válida, score entre 0 y 100 y ausencia de error de medición. Una fuga conocida evita una presentación saludable.
- Disponibilidad: verde desde 99,9 %, ámbar desde 99 % y rojo por debajo. Son umbrales visuales de esta ficha; no representan un SLA contractual.
- Seguridad: rojo por debajo de 50, ámbar de 50 a menos de 70, verde desde 70, sujeto a los hallazgos conocidos. La latencia utiliza el umbral configurado del target; si falta, no se inventa uno.
- SSL: advertencia al quedar 30 días y crítico con 7 días o menos, o certificado inválido. Una cobertura parcial conserva su alcance; no atribuir salud global a un módulo incompleto.
- Los incidentes del indicador son activos dentro de la actividad vinculada devuelta por la API. No confundirlos con las interrupciones del período ni con un total ilimitado de la organización.

## Acciones y microcopy

- Un verbo y un objeto: **Comprobar ahora**, **Vincular**, **Configurar**, **Ver detalle**. Evitar instrucciones repetidas en cada bloque.
- En móvil, la acción principal puede abreviarse a **Comprobar** conservando el nombre accesible **Comprobar ahora**. Sus controles vecinos no deben superponerse ni recortar su texto.
- Carga: **Comprobando…**. Conservar mensajes de pendiente, cooldown, permisos y fallo junto al control correspondiente.
- `Actualizar datos` consulta resultados guardados. `Comprobar ahora` mantiene confirmación de admisión 202, espera de una medición nueva y cooldown real.
- Las cards sin asociación llevan al vínculo o a la configuración; una card vinculada abre su detalle. Viewer conserva navegación de lectura y no recibe acciones de mutación.
- Deduplicar alertas vinculadas a incidentes mediante IDs. Los avisos del mismo recurso ya representado por una alerta estructurada conservan la acción de esa alerta. No relacionar recursos por coincidencia de texto.
- Acortar el texto visible sin eliminar el contexto: títulos originales disponibles en el detalle, metadatos en **Detalles del monitoreo**, estadísticas en **Detalles de latencia**.

## Gráficas

- Título **Latencia**, selector **Media / Picos / Ambas** y unidad visible.
- Conservar huecos de medición como `null`; no dibujar ceros ni conectar intervalos sin datos. No sustituir un máximo ausente por la media.
- Interpolación lineal para evitar sugerir valores intermedios no medidos; los puntos representan agregados de sus intervalos.
- P50/P90/P99 y máximo disponibles bajo **Detalles de latencia**, con `—` cuando faltan.
- La línea de umbral proviene de `max_latency_ms`; sin metadato no se dibuja un umbral supuesto.
- No prometer “tiempo real” ni una frecuencia fija de 30 s. La lectura depende del plan y cada fuente conserva su fecha real de medición.

## Pestañas técnicas y operativas

Aplicar una única superficie compacta por recurso seleccionado, con fecha real y acciones, franja de hasta cuatro indicadores y contenido operativo. Los detalles extensos se abren bajo **Detalles técnicos**. Mantener la información principal dentro del primer viewport de escritorio, conservando el resumen con gráfica/vínculos definido arriba.

| Pestaña | Primero visible | Bajo demanda |
| --- | --- | --- |
| SSL/TLS | Días restantes, válido/inválido, TLS, evaluación; emisor legible, hostname y vencimiento local | Emisor original, titular, algoritmo, puerto, huella y SAN |
| DNS | Tipo configurado, respuesta medida, TTL medido, último cambio; valor y cambios recientes | Cambios adicionales y todos los campos técnicos |
| Dominio | Vigencia, bloqueo de transferencia, DNSSEC/país cuando consten; registrador, dominio y servidores | Estados WHOIS, servidor, fechas y resto del registro |
| Seguridad | Score, evaluación, controles presentes y fuga; HSTS/CSP/Frames y cabeceras ausentes | Cabeceras presentes, directivas, fugas y metadatos completos |
| Actividad | Conteos de actividad vinculada, incidentes, alertas sin duplicar y cambios recientes | Más eventos de cada grupo; destino individual del evento |
| Configuración | Formularios de asociación en dos columnas en escritorio y una en móvil | Reglas y ayuda específica de cada asociación |

- Números: 32 px; estados textuales: 22 px para no expandir la superficie con nombres largos. Fechas legibles en hora local, sin ISO crudo como dato principal.
- Las métricas de evaluación requieren fecha válida y ausencia de error de medición. Un booleano ausente conserva `—` o `Sin dato`. DNS puede mostrar el tipo configurado sin mediciones; TTL y latencia requieren una medición válida.
- Los controles presentes de Seguridad cuentan únicamente HSTS, CSP y Frames cuyos booleanos estén disponibles. Indicar ese alcance; no presentarlos como una evaluación de todas las cabeceras.
- Cuando hay varios registros DNS, usar un selector de recurso y mostrar su valor, historial y acciones correspondientes. El enlace **Abrir módulo** debe abrir el registro seleccionado. Cambiar de selección solo consulta datos.
- Mantener todos los campos originales accesibles, incluso cuando se resume un nombre de emisor. No interpretar el formato visual como una validación TLS nueva.
- Mostrar tres eventos/cambios recientes inicialmente y expandir el resto. Conservar deduplicación de alertas por ID de incidente. Los conteos se limitan a la actividad vinculada disponible.
- No cambiar permisos, asociaciones, cadencia del plan, cooldown ni admisión 202 al aplicar el patrón visual.

## Alcance implementado y continuidad

Referencia aplicada en `/monitoring/:targetId`: encabezado, indicadores, atención, cobertura, navegación, pestañas técnicas, Actividad y Configuración. La gráfica compartida también alcanza el drawer de Monitoring. Los modos compactos de recarga y auto-refresco son opcionales para conservar el contexto de los otros módulos.

Para la siguiente migración de un módulo: reutilizar estos componentes, declarar el alcance de cada cifra, verificar roles/ausencias/errores y revisar escritorio y móvil. No dar por migradas las pantallas que aún mantienen su presentación anterior.

## Verificación

Antes de cerrar: revisar desktop 1440×900 y móvil 390×844; también ancho mínimo soportado cuando cambie la estructura. Verificar teclado, métricas desconocidas, datos malos con estado actual bueno, fallos parciales, enlaces de acción y ausencia de escrituras al abrir/recargar. Ejecutar Django completo y build según `AGENTS.md`. Los resultados locales se documentan por fecha; Playwright y producción requieren evidencia de CI.

Contexto funcional: [ficha de endpoints](ENDPOINT_DOSSIER.md). Evidencia de esta aplicación: [implementación del estándar](UI_STANDARD_IMPLEMENTATION_2026-10-21.md).

Aplicación a pestañas: [contexto y evidencia del 2026-10-22](ENDPOINT_TABS_UI_2026-10-22.md).

## Disponibilidad: bitácora y comprobaciones

- Historial compacto: cinco filas iniciales, más recientes primero y ampliación explícita.
- Estado con texto y color; latencia destacada y ausencia explícita, nunca sustituir por cero.
- Diagnóstico bajo demanda con controles nativos `details/summary`, foco visible y ajuste móvil sin desbordamiento.
- Últimas comprobaciones: filtro local sobre los últimos 20 registros cargados; independiente del período del gráfico. Mostrar el alcance y el número de coincidencias.
- Bitácora: indicar que duración y fin del intervalo son estimados. El contrato actual no distingue un cierre confirmado de uno estimado; no afirmar recuperación automática ni estado activo.
- Mostrar únicamente código HTTP y mensaje diagnóstico; no volcar objetos arbitrarios, cabeceras o cuerpos completos.

## Panel lateral de endpoint: consulta rápida

- Una sola vista; sin pestañas que repliquen la ficha completa.
- Cabecera con nombre, URL, estado actual y fecha de última medición. Protocolo y frecuencia como metadatos.
- Tres métricas en franja: disponibilidad de 24 h, latencia actual e interrupciones estimadas de 24 h. No confundir este último conteo con incidentes activos.
- Gráfica compacta de latencia media de 24 h, seguida de tres comprobaciones recientes. Análisis de picos, percentiles, bitácora, calendario y configuración en la ficha completa.
- «Comprobar ahora» y enlace a la ficha visibles; exportación y acciones administrativas dentro de «Más», conservando permisos y cooldown.
- Los enlaces profundos conservan returnTo con los filtros del listado. Cerrar por Escape, botón o fondo y mantener el manejo del foco.
- En protocolos que aún no tienen ficha completa, conservar ajustes operativos y detalles básicos desplegables dentro del panel.

### Corrección de paleta de mediciones — 2026-10-22

- Estados y métricas evaluables: verde (#4ade80), amarillo (#fbbf24), rojo (#ff7384). Datos ausentes o descriptivos sin criterio evaluable: neutro. No asignar salud a TTL, país, conteos o versión por tener un valor.
- Latencia: resultado registrado down/error rojo; slow amarillo; up verde. Solo cuando falta un estado registrado y existe un umbral válido, superar ese umbral es amarillo y estar dentro es verde. Sin ambos, neutro. Ausencia o valor negativo siempre neutro.
- No utilizar cortes fijos de 400/1000 ms en las cards y tablas de targets: utilizar el umbral y estado del target. El dashboard presenta la media como dato descriptivo y los resultados registrados agregados; no aplica un límite global fijo de 500 ms.
- Gráfica de endpoint: curva media verde, picos amarillos y fallos rojos. Estas series identifican magnitudes; el tooltip evalúa cada valor con el estado y umbral disponibles. No interpretar el color de toda la curva como salud de todos sus puntos.
- La gráfica de volumen usa neutro: el número de comprobaciones no determina por sí solo salud. Cian queda fuera de métricas y gráficas; enlaces y acciones conservan la identidad visual existente.
- `info` en componentes de medición se representa neutro para evitar reintroducir cian. La función compartida latencyTone centraliza el criterio en ficha, panel y listado.

### Criterios unificados — v1.5

- Los estados históricos registrados son la fuente de verdad. Los intervalos sin comprobaciones usan no_data/null, y cambiar un umbral no reclasifica el pasado. El backend no usa cortes fijos de 300 ms en días ni intervalos.
- Calendario: 30 días según la zona local del servidor (America/Guatemala por defecto), porcentaje calculado desde sus propias comprobaciones, independiente del selector de 24 h/7 d/30 d. Bloques rojos indican existencia de fallos, amarillos presencia de slow y grises falta de datos. El porcentaje usa 99,9/99 como referencia visual, y mide disponibilidad por comprobaciones.
- Latencia media histórica y global descriptivas/neutras; la línea del umbral del endpoint se etiqueta como actual. El resultado de una comprobación conserva prioridad sobre un umbral actual distinto.
- Dashboard: resultados operacionales, degradados y fallidos registrados; porcentaje operacional ponderado por comprobaciones. La frecuencia de cada target afecta su peso; no es cumplimiento contractual por tiempo. No crear una regla crítica global de 500 ms para protocolos diferentes.
- Seguridad operativa: >=70 sin fugas verde; 50–69 o >=70 con fuga amarillo; <50 rojo; sin medición válida neutro. Las letras siguen A+ desde 95, A desde 80, B desde 70, C desde 60, D desde 50 y F debajo; no cambian el significado del score ni reemplazan una auditoría integral.
- Las alertas explícitas conservan umbral y severidad propios. Una regla más estricta que el presupuesto del target debe interpretarse como tal, no como reclasificación del estado del target.
- Los nuevos umbrales max_latency_ms deben ser enteros positivos. No se alteran automáticamente configuraciones de organizaciones existentes.

### Límites y diagnóstico breve — v1.5

- Mostrar Límite actual junto a latencia en tabla/cards. El estado pertenece a la medición registrada y no se reclasifica con configuraciones posteriores.
- Down/error: guion neutro en latencia del resumen/listado. El estado rojo conserva su etiqueta y un diagnóstico breve cuando exista evidencia; no repetir Caído en la columna de latencia.
- Tiempo del intento disponible en detalles. No borrar el dato porque el chequeo haya fallado; un HTTP inesperado puede responder rápidamente.
- Distinguir límite actual, límite aplicado y límite aplicado no registrado. Los registros antiguos nunca heredan retroactivamente la configuración actual como si fuera la aplicada.
- Diagnóstico estructurado y acotado: HTTP recibido/esperado, categoría confirmada o fallo sin causa conocida. No deducir causas de texto libre ni publicar excepciones arbitrarias en el listado.

## Dashboard: alcance y lectura — v1.5

- Diferenciar Ahora/todos los módulos de Histórico/solo Monitoring/período seleccionado. El selector temporal no cambia los datos de estado actual.
- Recursos saludables ahora: fracción como cifra principal, porcentaje secundario. Contar recursos de los módulos consultados, sin presentar ese porcentaje como disponibilidad histórica.
- Disponibilidad del período: proporción de comprobaciones con respuesta correcta, incluidas las lentas; no SLA temporal contractual.
- Tiempo medio: intentos con latencia registrada, incluidas respuestas fallidas con duración conocida. Valor y curva neutros, sin celeste ni juicio contra un límite global supuesto.
- Resultados de comprobaciones en una banda independiente: cantidades operacionales/degradadas/fallidas con un total común. No mezclar un porcentaje operacional con cantidades bajo una cifra de latencia.
- La banda no deriva resultados a partir de porcentajes ni del estado actual. Si falta el desglose o sus conteos no cuadran con el total, mostrar Desglose no disponible. Con cero comprobaciones no declarar salud.
- Disponibilidad histórica: curva y puntos verdes >=99,9; amarillos >=99 y <99,9; rojos <99. Las barras de frecuencia permanecen neutras. Los huecos siguen vacíos, sin conectar muestras ausentes ni crear puntos sintéticos.
- Donut compacto con total de recursos y filtros por estado. Prioridad actual muestra dos pendientes de todos los módulos sin filtros; los accesos a la bandeja restablecen filtros y conservan las acciones/permisos del detalle existente.
- La bandeja completa mantiene su navegación y filtros. En móvil permanece antes del análisis; los paneles compactos se adaptan por ancho disponible sin desbordamiento del documento.

### Latencia del endpoint y resolución DNS — ajuste 2026-10-22

- La gráfica de latencia dibuja puntos amarillos para resultados lentos registrados o valores que superan el umbral actual. El tooltip usa el mismo criterio y muestra «Umbral actual». Un fallo registrado conserva prioridad roja. Esta comparación visual no modifica el estado histórico ni afirma cuál era el umbral aplicado al registro antiguo.
- DNS muestra Resolución DNS: Resuelve (verde) cuando existe una medición con valores; Sin respuesta (amarillo) si la medición quedó vacía; Error (rojo) cuando el recurso proporciona error_message; Sin medición (gris) sin fecha válida.
- Resuelve significa que existen valores guardados, no que coincidan con un valor esperado ni que se haya certificado la salud integral del DNS. El modelo DNS actual no persiste una categoría de error de resolución.
- Tiempo DNS, TTL y fechas permanecen neutros: no hay un umbral DNS propio configurado ni un juicio de salud válido por TTL. El tipo se conserva en el subtítulo «Registro A/AAAA/etc.».
- Verificación local: build frontend y 258 pruebas Django aprobados; seis casos Chromium aprobados entre la ejecución dirigida y la repetición del caso de regresión. CI pendiente.
