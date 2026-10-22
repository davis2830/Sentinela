# Sentinine: revisión de preparación para producción

## Séptimo bloque: candidato para davis1924/senti9

Implementados empaquetado local, manifiesto, hashes, verificador y prueba aislada
1.6.0 → 1.7.0 → 1.6.0 → 1.7.0 con diario persistente. El destino privado es
`davis1924/senti9:1.7.0`. Guía y workflow manual preparados; firma, publicación y
CI remoto siguen pendientes. Ver [alcance y evidencia](SENTI9_RELEASE_2026-10-22.md).

## Sexto bloque: telemetría interna Senti9 1.7.0

Implementados cola local, último acuse persistente, drenaje, diagnóstico acotado y
vigencia del reporte en el directorio. La migración 0008 se aplicó localmente.
Ver [contrato, pruebas y límites](SENTI9_TELEMETRY_2026-10-22.md).
El quinto bloque inferior conserva su alcance histórico; su pendiente de telemetría
queda resuelto en este bloque. Publicación de imagen y CI remoto siguen pendientes.

## Quinto bloque: visibilidad operativa en Sentinel

El directorio separa conexión, pendientes de recepción, entregas atrasadas y última
recepción conservada; muestra la versión instalada y fallos de actualización de la consulta.
Usa el ledger existente y no requiere cambiar el agente 1.6.0. La telemetría de cola
SQLite, drenaje y errores locales sigue pendiente. Ver
[criterios, alcance y pruebas](SENTI9_OPERATIONS_2026-10-22.md).

## Cuarto bloque: Senti9 1.6.0

DNS acotado por proceso cancelable, TCP IPv4/IPv6 con presupuesto compartido,
resolución acotada de HTTP/HTTPS, validación runtime de IPs y formulario IPv6
implementados. Ver [contrato, evidencia y límites](SENTI9_DNS_IPV6_2026-10-22.md).
Las secciones de versiones anteriores son la línea base histórica.

## Tercer bloque: Senti9 1.5.0

HTTPS obligatorio, CA separadas, token por archivo, drenaje y rotación controlada,
contenedor UID 10001 y configuración sin privilegios implementados. Ver
[evidencia y límites](SENTI9_SECURITY_2026-10-22.md). Validación aislada, sin
Cloudflare Tunnel ni exposición del equipo corporativo. CI/piloto pendientes.

## Segundo bloque: Senti9 1.4.0

Implementados outbox persistente, acuse por ejecución, ledger backend,
compatibilidad, protección de reservas posteriores y heartbeat independiente.
Ver [contrato, límites y pruebas](SENTI9_DELIVERY_2026-10-22.md).
Las tablas de hallazgos inferiores se conservan como línea base de la revisión.

## Avance: Senti9 1.3.0 (2026-10-22)

Nombre visible aprobado: **Senti9 — Agente privado de Sentinel**, producto de
GcTechOps. URL predeterminada del agente: https://sentinel.gctechops.com.
Se conservan nombres técnicos y variables heredadas. README operativo:
[sentinine/README.md](../sentinine/README.md).

Primer bloque implementado: protocolos desconocidos devuelven error; HTTP envía
cuerpo UTF-8 y headers; ningún salto de redirección se sigue en chequeos/control;
timeout HTTP/TCP independiente del umbral de lentitud; errores de configuración
aislados. UI renombrada a Senti9. Tests del agente añadidos al workflow CI.
No implica publicación de imagen ni actualización de agentes instalados.

Validación de nombre: búsquedas web exactas con software/monitoring y marca no
mostraron un producto claramente coincidente. No se obtuvo resultado registral.
El [buscador oficial RPI](https://busquedas.rpi.gob.gt/home/external) requiere
código de verificación. La consulta registral y de similitud sigue pendiente;
la ausencia de resultados web no acredita disponibilidad de marca.

Pendientes del primer bloque: HTTPS obligatorio con excepción explícita de
desarrollo, política LAN y validación extendida de configuración. El timeout de
socket no es un presupuesto total ni limita la resolución DNS del sistema.
Outbox/acuse por ejecución y heartbeat independiente implementados en 1.4.0.

Fecha: 2026-10-22. Revisión estática del checkout actual; no certifica un despliegue ni sustituye CI o un piloto LAN.

## Base implementada

- Agente 1.2.0 sin dependencias Python externas, polling saliente, ejecución concurrente HTTP/HTTPS/API, TCP y resolución DNS básica del sistema.
- Alta por organización, token almacenado como hash y revelado al crear, asignación de targets, reservas y límites por plan, ingestión restringida a organización/agente/target habilitado.
- Resultados validados, política de evaluación reportada, evaluación de alertas y watchdog de desconexión.
- Docker e instaladores Linux/Windows. Dos pruebas aisladas del agente cubren umbral y preservación de fallo HTTP.

## Plan y criterios de aceptación

| Prioridad | Hallazgo en código | Acción y cierre verificable |
|---|---|---|
| P0 | `_execute_target` devuelve up/1 ms para un tipo no implementado, incluido SSL | Rechazar tipos desconocidos y anunciar capacidades; probar que ningún protocolo sin ejecutor produce éxito |
| P0 | `urlopen` sigue redirecciones tanto en chequeos como en comunicación de control | Desactivar redirects, validar destino HTTPS y política de salida; nunca reenviar token a otro destino; probar 301/302/307/308 |
| P0 | El timeout se deriva del umbral de lentitud, con mínimo 1 s | Separar presupuesto de respuesta lenta del timeout de conexión/lectura; probar respuesta correcta lenta y timeout real |
| P0 | Se entrega request_body al agente, pero el Request no lo envía | Respetar método/cuerpo/headers con límites y pruebas locales de POST/PUT y status esperado |
| P0 | No hay cola persistente ni confirmación por ejecución; submit ignora el contenido de la respuesta | Añadir execution_id, lease vinculado a ejecución, timestamp, acuse individual y outbox acotada; probar reintentos, duplicados, resultados tardíos y reinicio |
| P0 | Heartbeat espera la ejecución y envío del lote; watchdog considera offline a los 45 s | Separar heartbeat del trabajo, limitar lote/concurrencia y endurecer timeouts; probar carga sostenida sin falsos offline |
| P1 | Un future que lanza excepción aborta la construcción del lote | Aislar errores por tarea y conservar las demás respuestas; probar tarea malformada junto a tareas válidas |
| P1 | TCP usa AF_INET y split(':'); DNS usa gethostbyname sin timeout explícito propio | Parseo host/puerto IPv6, getaddrinfo, cierre de sockets y DNS con presupuesto verificable; declarar alcance de resolver/record_type |
| P1 | Imagen latest, Dockerfile sin USER, instaladores reemplazan contenedor y Windows no valida exit code | Releases versionadas y digest, usuario sin privilegios, recursos mínimos, instalación comprobable, actualización y rollback |
| P1 | Falta rotación explícita de token y configuración de CA propia | Rotación/revocación operativa, secretos por archivo y CA corporativa; HTTPS requerido salvo desarrollo explícito |
| P1 | Fallos al evaluar alertas se silencian y faltan métricas de entrega | Logs estructurados sin secretos, errores observables, cola pendiente, último envío aceptado y versión/capacidades visibles |
| P2 | No se encontró pipeline específico del agente en CI | Pruebas de protocolo, contrato backend/agente y publicación verificable de imagen; piloto LAN con corte de red, reinicio, revocación y carga |

## Límites detectados en la revisión inicial (1.2.0)

- DNS actual comprueba resolución IPv4 con el resolver del sistema; no equivale a consultar un servidor DNS configurable ni a validar todos los tipos de registro.
- SSL como tipo de target carece de ejecutor en el agente actual.
- La reserva de backend existe, pero el payload no incluye su identificador; no se debe asumir correlación inequívoca de un resultado tardío con su ejecución original.
- No se verificó disponibilidad pública de la imagen, firma, registry, despliegue real ni resultados de CI en esta revisión.

## Orden propuesto

1. Exactitud y seguridad de protocolos: tipos soportados, redirects, cuerpo HTTP y timeout independiente.
2. Entrega confiable: ejecución identificable, cola/acuse y heartbeat independiente.
3. Instalación y operación: release reproducible, CA/secretos, rotación, diagnóstico y rollback.
4. Gate de CI y piloto representativo de 48–72 horas antes de habilitar clientes de producción.

## Nombre candidato: Senti9

Recomendación editorial: «Senti9 — Agente privado de Sentinel». Corto y diferenciable visualmente; requiere fijar pronunciación («Senti nueve») y aclarar que 9 es parte del nombre, no una versión.

Renombrar primero la presentación. Mantener variables SENTININE_*, endpoints y compatibilidad de instalaciones existentes; introducir aliases nuevos con pruebas antes de deprecar nombres. La búsqueda web general no constituye comprobación de disponibilidad de marca, dominio o registro de contenedores.
