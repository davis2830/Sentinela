# Senti9 1.4.0: entrega persistente y heartbeat independiente

## Implementación

- Diario SQLite para tareas, resultados y rechazos; backpressure a 1.000 pendientes.
- Ejecución, envío y heartbeat separados; 10 workers y exclusión por target.
- Identificador vinculado a la reserva original y ledger AgentExecution aislado
  por organization_id/probe/target. Snapshot de política emitida por servidor.
- Acuse por resultado accepted/duplicate/rejected, seguro ante reintentos y acuse
  perdido. Marca local impide reejecución por heartbeat demorado posterior al acuse.
- Resultados antiguos conservan fecha y no pisan el estado actual ni consumen
  una reserva nueva. Ingestión v2 usa el evaluador de alertas existente para datos
  actuales; un fallo del evaluador se registra y no revierte la medición guardada.
- Recuperación de reinicios: queued ejecutable dentro de ventana; running genera
  resultado de interrupción sin repetir automáticamente la petición.
- Compatibilidad de protocolo anterior, sin permitir que un payload sin ID
  consuma una reserva emitida como v2.
- Volumen persistente en Compose, instaladores y comandos generados por backend.
- Ledger expira en 24 h y purge_telemetry lo retira sin borrar configuraciones.

## Despliegue y límites

Aplicar backend y migración 0007 antes del agente. Migración aplicada localmente.
No hay publicación de imagen, actualización de agentes externos ni despliegue de
producción en este cambio. No retirar el ledger al hacer rollback mientras queden
resultados v2; conservar backend compatible y volumen del agente.

Ver [operación y ventanas](../sentinine/README.md). La ventana de recepción es
24 h, la de inicio 10 min, el reloj tolera 5 min y las tareas running no se repiten.
La protección cubre inserción duplicada de mediciones y reintentos del mismo ID;
no garantiza exactamente una modificación de una API externa. Una nueva
comprobación periódica tiene otro ID.

## Evidencia local

19 pruebas del agente aprobadas en Python 3.11: protocolo HTTP, reintentos, reinicio,
cola llena, acuses ajenos/desconocidos, rechazo diagnosticable y heartbeat activo
mientras ejecución y envío están bloqueados.

17 casos backend dirigidos aprobados: 11 nuevos de entrega y 6 de diagnóstico
existentes. Incluyen respuesta heartbeat perdida, reserva nueva frente a resultado
antiguo, duplicados, contrato HTTP, validación parcial, tenant, timestamps,
política emitida, compatibilidad y retención.

Build frontend aprobado. Sin deriva de modelos en makemigrations --check.
Suite Django completa: **269/269**, 126,496 s. Prueba adicional de concurrencia
PostgreSQL: **1/1**, 5,456 s, ejecutada después de terminar la suite completa;
dos conexiones enviaron el mismo resultado y produjeron accepted/duplicate con
una sola medición. Total de casos Django distintos verificados: **270**.

La primera tentativa de ejecutar la prueba adicional mientras seguía la suite
completa falló al crear la misma base test_sentinel; PostgreSQL rechazó su borrado
por conexiones activas. Se repitió secuencialmente con éxito. No se alteró la base
de desarrollo ni se atribuye ese intento a un fallo de entrega.

Migración 0007 aplicada en desarrollo; sin deriva de modelos. No hay evidencia de
CI ni piloto LAN en este cambio. No se ejecutó Playwright porque no se modificó UI.

## Próximo bloque

TLS obligatorio con excepción de desarrollo explícita, CA corporativa, rotación,
DNS/IPv6 con límites, usuario sin privilegios, releases reproducibles y rollback,
telemetría de cola visible en producto y piloto representativo.
