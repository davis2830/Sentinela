# Aplicación de criterios unificados — 2026-10-22

## Implementado

- Históricos: se eliminó el corte fijo de 300 ms. El estado guardado define el resultado; fallo tiene prioridad sobre degradado y operacional. Vacíos: no_data y latencia null. Un cambio actual de umbral no modifica históricos.
- Calendario: estado degraded compatible con la UI, promedio ausente null, días en zona local y porcentaje propio de sus 30 días. Conserva teclado y visualización bajo demanda. La ausencia de datos no se convierte en verde ni en cero ms.
- Dashboard: eliminado el juicio global de 500 ms; media descriptiva. API añade operational_checks, degraded_checks, failed_checks y operational_percentage en summary, y conteos por intervalo. La UI muestra proporción operacional y cantidades degradadas/fallidas; tooltip conserva los tres conteos. Se mantiene caché por organización y período con versión v3.
- Umbrales: creación y actualización requieren max_latency_ms >=1. Ninguna configuración existente fue migrada o sobrescrita.
- Seguridad: nuevos contadores healthy/warning/critical/unmeasured con límites 70/50 y tratamiento de fugas. El frontend consume esos grupos y preserva filtros URL antiguos por grado. Las propiedades API grade_a/grade_bc/grade_df siguen siendo grupos por letras por compatibilidad. Las letras técnicas se mantienen, con A+ desde 95 también en el fallback frontend; B verde y D amarillo.
- Se conservan las reglas explícitas de alerta, incluyendo sus umbrales y severidades; no se migran silenciosamente. El asistente para heredar dinámicamente umbrales en reglas nuevas queda como mejora de producto posterior, no se agregó una nueva semántica de alertas en esta entrega.
- No se requieren migraciones de esquema. Se actualizó UI_STANDARD.md a v1.3.

## Pruebas nuevas

Ocho contratos backend cubren: estado up por encima de 300 ms sin reinterpretación al cambiar el umbral; slow aunque el promedio sea bajo; prioridad del fallo; vacíos neutrales; conteos globales aislados por organización; porcentajes sin datos; límite positivo de configuración; rangos de seguridad con fuga/ausencia y compatibilidad por letras; calendario local antes del cambio de día UTC (este último caso en una prueba adicional al conjunto inicial de siete).

Dos casos Chromium nuevos cubren el calendario de 30 días independiente de un resumen de 24 h y los filtros de seguridad de 70/50/sin medición. Se ejecutan junto a las regresiones de gráficas, paleta, panel y disponibilidad.

Primera ronda backend: 251/251 en 75.575 s. Se añadió después la prueba de fecha local. Primera ronda navegador: 11/12; una prueba existente midió un punto SVG antes de ser visible, sin esperar renderizado. Se añadió una espera de visibilidad antes de leer sus coordenadas, sin relajar las verificaciones del tooltip.

## Límites

Los agregados son por comprobaciones y su ponderación depende de la frecuencia de ejecución. La duración de interrupciones sigue estimada. La vista de calendarios distingue presencia de fallos de porcentaje de disponibilidad; un día con un fallo puede tener alta disponibilidad. Las letras de seguridad representan evaluación de cabeceras, no seguridad integral. Evidencia local; CI sigue pendiente.

## Cierre de verificación

- Django completo final: **252/252**, 85.118 s (ocho pruebas nuevas respecto de las 244 previas).
- Build frontend final: correcto.
- Chromium local: **13 casos únicos aprobados** entre regresiones y tres casos nuevos de calendario, filtros de seguridad y cumplimiento global. Primera ronda 11/12; repetición de tooltip/calendario/seguridad 3/3 tras esperar la visibilidad de los puntos; caso global adicional 1/1.
- Captura revisada: frontend/test-results/criteria-calendar.png; badge 99,50% amarillo calculado a partir de 200 comprobaciones propias del calendario, mientras el resumen de 24 h reporta 100%. Día degradado amarillo y día sin datos neutro, accesible por teclado.
- Fixture criteria-20261022 retirada con el comando de limpieza verificado; auditoría conservada.
- git diff --check correcto. Ejecución CI y despliegue fuera de esta verificación local.
