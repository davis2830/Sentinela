# Revisión de criterios de medición — 2026-10-22

Revisión estática del código vigente. Este documento propone cambios; no modifica reglas, umbrales de clientes, históricos ni estados del sistema.

## Hallazgos comprobados

1. Latencia usa referencias distintas: max_latency_ms del target (2.000 ms inicial), 300 ms en agregados diarios e intervalos, 500 ms en el dashboard y 1.000 ms en la alerta inicial. Una regla explícita de alerta puede ser intencionalmente más estricta; no sobrescribirla automáticamente.
2. Los intervalos vacíos del histórico reciben status up aunque total_count sea cero y latency sea null. La UI preserva huecos actualmente, pero el contrato no debe declarar salud sin datos.
3. El backend devuelve slow en el resumen diario y UptimeAvailabilityBar solo reconoce degraded. Un día lento puede terminar verde.
4. Disponibilidad: ficha usa 99,9/99, calendario 99/95 y dashboard dibuja referencia 99. El calendario de 30 días recibe además el porcentaje del período seleccionado, por lo que su badge puede representar 24 h o 7 d bajo un título de 30 d.
5. Seguridad: ficha usa >=70, >=50; estadísticas del módulo agrupan >=80, 60–79 y <60. Las notas A+/A/B/C/D/F son independientes y deben conservarse identificadas como calificación de cabeceras, no auditoría global de seguridad.
6. Creación y actualización de max_latency_ms usan IntegerField sin min_value; se debe impedir cero y negativos antes de guardar. No se verificaron ni alteraron valores ya guardados en organizaciones.

## Criterio recomendado

- Por comprobación: error de conexión/código esperado incumplido => rojo; respuesta válida que supera max_latency_ms => amarillo; respuesta válida dentro del límite, inclusive => verde; sin medición => neutro.
- Históricos: priorizar estados realmente registrados. Un intervalo con fallos conserva esos fallos; con respuestas slow indica degradación, aunque el promedio la oculte. Sin muestras => no_data y null. No reclasificar históricos con un umbral actual cambiado sin guardar la política aplicada a cada comprobación.
- Global: mantener promedio de latencia como dato descriptivo. Evaluar cumplimiento por comprobación contra su presupuesto o estado registrado, mostrando porcentajes y cantidades operacional/degradado/fallido. Evitar comparar una media entre protocolos con un límite fijo de 500 ms. Mostrar muestras, período y cobertura; la frecuencia de comprobación influye en el peso del agregado.
- Disponibilidad: usar provisionalmente la misma política visual de >=99,9 verde; >=99 y <99,9 amarillo; <99 rojo en todas las vistas. Son referencias de producto, no SLA contractual. Slow cuenta disponible, aunque degradado. Identificar la medida como disponibilidad por comprobaciones, no disponibilidad temporal exacta. El calendario distingue porcentaje diario de existencia de fallos durante ese día.
- Seguridad: mantener provisionalmente >=70 verde, >=50 y <70 amarillo, <50 rojo porque coincide con la alerta inicial <70; alinear las agrupaciones del módulo, conservando las notas técnicas separadas. Hallazgos conocidos pueden elevar severidad. No atribuir seguridad integral a un score de cabeceras.
- SSL/dominio: >30 días verde; >7 y <=30 amarillo; <=7 rojo; SSL inválido rojo. Mostrar separado validez del certificado y proximidad de vencimiento. Las reglas personalizadas de alerta conservan umbral y severidad propios.
- Alertas nuevas: ofrecer heredar el umbral del target o declarar explícitamente un umbral propio. No migrar silenciosamente las reglas existentes. Definir persistencia y recuperación con comprobaciones consecutivas según servicio antes de automatizar notificaciones.

## Prioridad y aceptación

P1: estados sin datos, contrato slow/degraded, eliminar referencias fijas de latencia en históricos/global y validar umbral positivo.
P2: uniformar disponibilidad y período del badge, agrupaciones de seguridad y explicación de reglas propias frente a criterios de UI.
P3: políticas por organización/servicio, cumplimiento agregado y presupuesto de disponibilidad; persistencia de la política histórica si se requiere reinterpretación auditable.

Pruebas requeridas al implementar: límite exacto y superación de umbral; fallo con latencia numérica y sin latencia; mezclas up/slow/down dentro de un intervalo; cero muestras; cambio de umbral sin reinterpretación de históricos; coincidencia entre día y calendario; alcance 24 h/7 d/30 d; aislamiento de organización; reglas explícitas conservadas. Ejecutar suite Django completa, build frontend y casos Chromium locales; CI sigue siendo necesario para afirmar su gate.

## Seguimiento

La aplicación posterior se documenta en [criterios unificados](MEASUREMENT_CRITERIA_IMPLEMENTATION_2026-10-22.md), manteniendo esta revisión como evidencia del estado previo.
