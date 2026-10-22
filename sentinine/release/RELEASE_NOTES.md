# Senti9 1.7.0 — candidato de distribución

Destino: `davis1924/senti9:1.7.0` (Docker Hub privado).
Producto de GcTechOps para Sentinel. Linux/amd64; no acredita ARM64 ni instalación Windows nativa.

## Cambios

- Cola SQLite local reportada: espera, ejecución y envío.
- Último acuse accepted/duplicate conservado entre reinicios.
- Drenaje y diagnóstico de almacenamiento/entrega/control sin secretos ni mensajes crudos.
- Estados desconocidos y reportes antiguos diferenciados en Sentinel.
- Conserva HTTP/API, TCP IPv4/IPv6, DNS A/AAAA, TLS y protocolo de entrega v2 de versiones anteriores.

## Requisitos

- Backend con migraciones `monitoring.0007_agent_execution_delivery` y `0008_agent_probe_telemetry`.
- Mantener servidor, token, volumen y usuario 10001:10001 al actualizar.
- Registro privado: el equipo de instalación necesita permiso para descargar la imagen.
- Los nombres `SENTININE_*`, servicio y volumen heredados siguen siendo compatibles.

## Estado

Este paquete se prepara localmente y no publica imágenes. `SHA256SUMS` detecta alteraciones,
pero requiere firma verificada con una clave confiable para acreditar autoría.
El manifiesto registra las imágenes exactas y la evidencia de compatibilidad del diario.
CI remoto, firma y piloto en infraestructura autorizada se verifican por separado.

## Límites

El retorno 1.7.0 → 1.6.0 preserva el diario en la prueba aislada. La versión 1.6.0
no reporta telemetría interna ni actualiza su fecha de acuse; Sentinel muestra ese
reporte como desconocido. No se revierte el esquema del backend para retornar el agente.
No acredita compatibilidad con versiones anteriores a 1.6.0.
