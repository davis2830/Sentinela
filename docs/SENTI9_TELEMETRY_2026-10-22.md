# Senti9 1.7.0 — telemetría interna

## Alcance

Completa el [panel de entregas del servidor](SENTI9_OPERATIONS_2026-10-22.md) con
un reporte del runtime del agente. No mezcla salud del endpoint, recepción del
servidor y acuse recibido por el agente.

La migración `monitoring.0008_agent_probe_telemetry` añade un snapshot JSON nullable
y una fecha de recepción del servidor. Se aplicó localmente. El heartbeat requiere
protocolo de entrega v2 cuando incluye telemetría; agentes anteriores siguen funcionando
sin el nuevo contrato. Un heartbeat sin telemetría borra el reporte anterior para no
mostrar como vigente la información de una versión previa.

## Datos mostrados

| Dato | Fuente y significado |
| --- | --- |
| Pendientes del servidor | Ejecuciones emitidas todavía sin aceptación en el ledger |
| Última recepción confirmada | `accepted_at` del servidor; no se puede modificar con el snapshot |
| En espera / Ejecutando / Por enviar | Estados queued/running/ready del único diario SQLite del runtime |
| Último acuse del agente | Último accepted/duplicate válido de un resultado existente en ese diario |
| Modo drenaje | Termina pendientes; anuncia capacidad cero y el servidor no entrega tareas nuevas |
| Rechazos conservados | Historial local acotado a 1.000 rechazos; no es un fallo activo |

El último acuse y la fecha del último rechazo se escriben en una pequeña tabla
`health` del diario, dentro de la misma transacción que procesa los acuses.
Sobreviven a reinicios. Un acuse ajeno, desconocido, faltante o rechazado no actualiza
la fecha de aceptación. La cola y el historial no se eliminan para presentar cifras sanas.

## Diagnósticos y colores

- Verde: reporte vigente, cola vacía y sin errores reportados. No significa que los endpoints estén arriba.
- Amarillo: trabajo pendiente o modo drenaje.
- Rojo: almacenamiento local, envío no confirmado, acuse incompleto o consulta de tareas sin confirmar.
- Gris: agente anterior, reporte antiguo, desconexión, consulta del panel fallida o contador desconocido.

Se permiten únicamente códigos enumerados y contadores de fallos consecutivos por
componente. No se transmiten excepciones crudas, rutas, tokens, cuerpos HTTP ni headers.
Los errores de transporte se limpian después de un lote con todos sus acuses válidos;
los rechazos terminales se conservan como historial. Un acuse parcial mantiene pendientes
y diagnóstico. Un error de almacenamiento requiere una escritura exitosa para limpiarse;
leer la cola no es prueba de recuperación de disco.

Heartbeat, chequeos y entrega siguen en bucles independientes. Si SQLite no puede
consultarse, heartbeat intenta reportar cola desconocida y almacenamiento con capacidad cero.
El servidor también impone capacidad cero para drenaje, cola desconocida o fallo de almacenamiento.
El modo drenaje puede activarse localmente con `python -m delivery drain`, sin exponer
un control remoto adicional.

## Contrato y vigencia

`telemetry.schema_version=1`: queue (tres enteros o null), queue_limit 1..1000,
draining booleano, rejected_retained 0..1000 o null, last_ack_at y last_rejection_at
ISO8601 o null, errors (máximo tres componentes únicos, códigos permitidos, contador
1..1.000.000). Se rechazan campos extra, contadores incoherentes, booleanos usados
como números y fechas más de cinco minutos en el futuro. La cola null exige diagnóstico
de almacenamiento. Un payload inválido devuelve 400 y no renueva el heartbeat.

La vigencia usa `telemetry_received_at` del servidor y el límite de conexión existente
de 45 segundos. Los datos guardados pueden consultarse como históricos, pero el panel
no muestra sus contadores como actuales. El servidor consulta solo el agente autenticado
y el directorio conserva el aislamiento por organización.

El snapshot se toma antes de la petición heartbeat. Por eso la recuperación del propio
heartbeat puede verse en la siguiente consulta, no en la misma que la confirma. Los
errores consecutivos viven en memoria y se reinician al reiniciar el proceso; las fechas
de acuse/rechazo sí persisten. El diagnóstico identifica la operación fallida, no inventa
una causa raíz de red. Los relojes del agente deben estar sincronizados.

## Actualización

1. Actualizar backend y aplicar la migración 0008.
2. Actualizar frontend.
3. Drenar el agente, conservar volumen y token y actualizar a 1.7.0.
4. Reanudar con `python -m delivery resume` y comprobar reporte y entregas.

La imagen `sentinel/sentinine:1.7.0` se construyó **localmente**. No fue publicada ni
se actualizaron agentes instalados. Antes de usar las plantillas fuera de este equipo
se requiere publicar la imagen versionada en el registro autorizado. El empaquetado,
firma, recuperación de versión, CI remoto y piloto autorizado siguen pendientes.

## Evidencia local

- Migración 0008 aplicada y `makemigrations --check --dry-run` sin cambios faltantes.
- Suite Django final desde base nueva: **288/288**, 93,426 segundos, salida 0
  con `python manage.py test --noinput --keepdb`.
- TypeScript/build Vite aprobados; Vite: 25,16 segundos.
- Agente: **54/54** pruebas aprobadas, 5,67 segundos. Incluye persistencia del acuse,
  retención ante fallos/acuses parciales, ausencia de secretos, rechazo histórico y
  recuperación de almacenamiento solo tras escritura exitosa.
- Tres pruebas Chromium dirigidas del componente, 14,9 segundos: cola/drenaje/errores,
  reportes antiguos o consulta fallida, y almacenamiento desconocido/historial sin overflow a 390px.
- Las pruebas de agente se ejecutaron sin red, sin puertos publicados, filesystem raíz
  de solo lectura y sin capacidades Linux adicionales.
- No se ejecutó la suite completa de navegador ni se acredita evidencia de CI.

### Incidencia del runner de Django

Una corrida completó las 288 pruebas pero falló al eliminar `test_sentinel` por
dos conexiones transitorias. Al finalizar el proceso no quedaban sesiones. El
intento de reutilizar esa base con `--keepdb` encontró que faltaba el singleton
BetaControl creado por migración: las limpiezas de pruebas no lo recrean.
Se verificó el nombre y ausencia de conexiones y se eliminó **exclusivamente**
`test_sentinel` para repetir con una base nueva. La base de desarrollo no se eliminó.
Para esta suite no reutilizar una base de pruebas anterior sin recrear sus datos iniciales.
La corrida final desde base nueva terminó con salida 0. Después de finalizar el proceso
y verificar cero conexiones, se retiró la base temporal `test_sentinel`.
