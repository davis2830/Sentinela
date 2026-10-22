# Senti9: visibilidad operativa — 2026-10-22

**Actualización posterior:** la cola local, drenaje y diagnósticos que este documento
registró como pendientes ya están implementados en
[Senti9 1.7.0](SENTI9_TELEMETRY_2026-10-22.md). Las secciones siguientes conservan
la evidencia del primer bloque.

## Implementado

El directorio de agentes separa conexión de recepción de resultados. Conserva los iconos,
tipografía y colores semánticos del estándar UI; las métricas se muestran en una franja compacta.
Se visualizan versión instalada, última señal, objetivos, pendientes y última recepción confirmada.
La consulta se actualiza cada 10 segundos. Un error de consulta muestra una advertencia y permite reintentar;
los datos conservados no se presentan como una actualización exitosa.

La API añade `delivery` de solo lectura al serializer de agentes. La fuente es
`AgentExecution`, filtrada por agente y organización. No incluye tareas, credenciales ni errores crudos.
No requiere migración ni actualizar el binario del agente 1.6.0.

| Indicador | Criterio |
| --- | --- |
| Desconectado, gris | Última señal ausente o de hace más de 45 segundos |
| Entrega atrasada, rojo | Conectado y una ejecución sin aceptación tiene al menos 10 minutos |
| En proceso, amarillo | Conectado y hay ejecuciones sin aceptación, todas menores de 10 minutos |
| Sin pendientes, verde | Conectado, ninguna ejecución pendiente y existe una recepción conservada |
| Sin recepción registrada, gris | Conectado, sin pendientes ni recepciones conservadas |

El umbral de 10 minutos coincide con la ventana existente de inicio/redespacho. No es
el vencimiento de aceptación de 24 horas y no demuestra por sí solo una falla de red.
Una respuesta pendiente puede corresponder a una tarea aún ejecutándose, perdida o rechazada.
La API no inventa una causa cuando no tiene evidencia.

`last_received_at` es el máximo `accepted_at` del registro del servidor, no la fecha
reportada por el equipo. Confirma persistencia del resultado; no confirma que el agente
haya recibido el acuse. El resultado puede indicar que el endpoint está caído: entrega
correcta del agente y salud del endpoint son conceptos diferentes.

## Límites y trabajo siguiente

- Los indicadores corresponden al protocolo v2 y al histórico conservado. La retención
  de recibos puede volver el estado a «Sin recepción registrada» cuando no hay tareas recientes.
- Los pendientes son ejecuciones emitidas sin aceptación en el servidor, **no la cola SQLite local**.
- La cola local, modo drenaje y errores de transporte/disco todavía no viajan en heartbeat.
  Incorporar un contrato acotado de telemetría del runtime, con fecha de captura y estado desconocido
  para agentes anteriores, es el siguiente paso de este bloque.
- No se publicó imagen, no se expuso el equipo ni se realizaron conexiones externas de prueba.
- La verificación visual en navegador y la evidencia de CI continúan pendientes.

## Pruebas

`monitoring.tests_probe_operations` verifica separación entre conectado/sin recepción,
pendiente/atrasado/aceptado, desconexión y aislamiento de recibos por organización,
incluida la ausencia de payloads y secretos en la respuesta.

Suite Django completa local: **285/285**, 129,070 segundos, sin incidencias en el
system check. TypeScript y build Vite aprobados; compilación Vite final: 26,53 segundos.
La validación de navegador y CI no se ejecutó en este bloque.
