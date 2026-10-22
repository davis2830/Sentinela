# Senti9 — Agente privado de Sentinel

Producto de GcTechOps. Plataforma: https://sentinel.gctechops.com.
Versión de código: 1.7.0. Nombre anterior: Sentinine.

## Telemetría interna en 1.7.0

Aplicar `monitoring.0008_agent_probe_telemetry` en el backend antes de actualizar
agentes. El panel muestra la cola local (espera/ejecución/envío), drenaje, último
acuse y diagnósticos acotados, separados del ledger del servidor. Agentes antiguos
siguen funcionando y muestran telemetría interna desconocida. No eliminar el volumen
al actualizar: el último acuse/rechazo persiste junto al diario. Los errores activos
son del proceso y se reinician al reiniciarlo. Un reporte con más de 45 segundos o
sin conexión se presenta como desactualizado.

Ver [contrato, criterios, actualización y evidencia](../docs/SENTI9_TELEMETRY_2026-10-22.md).
Imagen construida localmente; publicar en el registro autorizado antes de instalar
desde otro equipo. No se actualizaron agentes existentes automáticamente.

## Compatibilidad e instalación

Se mantienen `SENTININE_SERVER`, `SENTININE_TOKEN`, `SENTINEL_SERVER`,
`SENTINEL_TOKEN` y endpoints `/api/v1/agent-probes/`. El destino de distribución
aprobado es `davis1924/senti9`; las imágenes locales previas `sentinel/sentinine`
se conservan como baseline y no se asumen publicadas.

Construcción local desde la raíz: `docker build --target production -t davis1924/senti9:1.7.0 sentinine`.
La imagen se construyó localmente; no se publicó en un registry. Los instaladores,
Compose y las plantillas generadas usan 1.7.0, que debe estar disponible en el
equipo o registry autorizado antes de instalar. No asumir que latest contiene los cambios.

## Paquete de distribución y retorno

El repositorio Docker Hub privado confirmado es `davis1924/senti9`. Preparación
local desde la raíz, con Python 3.11+ y Docker, sin publicar ni iniciar el agente real:

```text
python sentinine/release.py compatibility --baseline sentinel/sentinine:1.6.0 --output .tmp/senti9-compatibility-1.7.0.json
python sentinine/release.py prepare --baseline sentinel/sentinine:1.6.0 --report .tmp/senti9-compatibility-1.7.0.json --output dist/senti9-1.7.0
python sentinine/release.py verify dist/senti9-1.7.0
```

Los destinos deben ser nuevos. La prueba usa imágenes locales exactas, cuatro fases,
un volumen temporal y red deshabilitada; lo retira al terminar. Los archivos tar
incluyen candidato y baseline para retorno sin registro. El manifiesto relaciona
las imágenes con el código y `SHA256SUMS` protege integridad. La firma requiere
una clave confiable externa; un checksum no acredita identidad.

Guía autocontenida: [release/OPERATIONS.md](release/OPERATIONS.md). En el paquete
distribuido se encuentra como `OPERATIONS.md`. Evidencia y límites en
[docs/SENTI9_RELEASE_2026-10-22.md](../docs/SENTI9_RELEASE_2026-10-22.md).

Configurar SENTININE_TOKEN_FILE como ruta de un archivo privado y montar en solo
lectura. Compose utiliza secrets; la plantilla UI requiere reemplazar
REEMPLAZAR_RUTA_TOKEN por una ruta absoluta. El token nunca se incrusta en esa
plantilla. El instalador Windows admite -TokenFile; el Linux usa
SENTININE_TOKEN_FILE. Se conserva el token por entorno como compatibilidad.

## Protocolos

- HTTP/HTTPS/API: método, headers, cuerpo de texto UTF-8 hasta 1 MiB y código esperado.
  Para JSON, configurar Content-Type: application/json y el cuerpo JSON explícito.
  Nunca seguir redirecciones. Un 301/302/303/307/308 puede ser el código esperado,
  pero no se visita Location.
- TCP: hostname/IPv4/IPv6, puerto estricto y fallback entre direcciones candidatas.
  Usar `[fd00::10]:5432` para IPv6 con puerto; `fd00::10` sin corchetes es una
  dirección completa sin puerto (por compatibilidad TCP usa 80 por defecto).
- DNS: resolución A/AAAA del sistema del agente, con timeout cancelable. Un nombre
  que solo tenga AAAA puede estar operativo. IP literal o hostname:puerto no son
  comprobaciones de resolución válidas: generan error de configuración.
- DNS no comprueba un servidor específico, registros MX/TXT/NS, DNSSEC ni un valor
  esperado. El resolver del contenedor/SO puede responder desde caché o hosts.
  TCP a puerto 53 solo comprueba conexión TCP, no una respuesta DNS.
- SSL y otros tipos no implementados: resultado error, nunca éxito ficticio.

SENTININE_CHECK_TIMEOUT_SECONDS controla timeout de socket HTTP/TCP (15 s por
defecto, máximo 120). Es independiente de max_latency_ms, que clasifica respuestas
correctas lentas. Conexión TCP incluye resolución y fallback en ese presupuesto.
SENTININE_DNS_TIMEOUT_SECONDS limita resolución (5 s por defecto, 0,05–120 s),
acotado además por el presupuesto de conexión/check. No es un límite total de
lectura de respuesta HTTP ni garantiza tiempos de scheduling de un SO saturado.

El resolver corre como proceso Python aislado que se termina y recoge al vencer
el plazo. No se abandonan hilos bloqueados; no hereda token, ruta de secreto ni
PYTHONPATH. IPv4/IPv6 numéricos usan AI_NUMERICHOST sin consulta DNS. Se preservan
el hostname HTTP, SNI y validación de certificado al conectar a una IP resuelta.
El presupuesto de fallback se reparte entre candidatos; no se multiplica por IP.

Antes de conectar un target se bloquean loopback, link-local, multicast,
direcciones no especificadas y metadata conocida, incluidas sus formas IPv4
mapeadas. RFC1918 y ULA normales se permiten en el agente. Las pruebas loopback
usan una excepción aplicada solo por los mocks del test, no una bandera productiva.

Los nombres LAN se validan sintácticamente en el backend y se resuelven en el
agente asignado de la organización. La nube mantiene su resolución y validación
SSRF completas. Al cambiar de agente a Cloud se revalida el endpoint existente.

El transporte standalone `common.safe_http` permite destinos LAN privados,
rechaza esquemas ajenos a HTTP(S), credenciales embebidas y redirecciones, e ignora
proxies de entorno. No sustituye el transporte cloud de Django que bloquea LAN.
El canal de control exige HTTPS por defecto. HTTP solo se permite con
SENTININE_ENV=development **y** SENTININE_ALLOW_HTTP=true. Esto no cambia el
protocolo configurado de los targets LAN. Las URLs del control no admiten usuario,
contraseña, query ni fragmento. Las redirecciones siguen bloqueadas.

SENTININE_CONTROL_CA_FILE agrega una CA corporativa al canal de control;
SENTININE_TARGET_CA_FILE agrega una CA para los targets. No se reemplaza la
confianza pública del sistema ni se desactiva la verificación de hostname.
Montar certificados como archivos de solo lectura. El instalador PowerShell
admite -ControlCaFile y -TargetCaFile; Linux admite las variables equivalentes.
En Compose se pueden agregar esos montajes/variables con un override autorizado.
El bypass TLS de targets solo funciona en desarrollo explícito; nunca se aplica
al canal de control.

## Verificación y trabajo restante

`python -m unittest discover -s sentinine -p 'test_*.py' -v`

Las pruebas TLS requieren OpenSSL CLI. Alternativa aislada: construir
`docker build --target tests -t senti9-tests:1.7.0 sentinine` y ejecutar
`docker run --rm --network none senti9-tests:1.7.0`. Los certificados y claves
de prueba se generan dentro del contenedor, no se usan certificados reales.

La suite prueba cuerpos/headers reales en servidor local, redirects sin segundo
salto, token sin reenvío, respuestas lentas, protocolos inválidos y aislamiento de
configuración errónea. Se agrega al workflow CI; falta evidencia de ejecución remota.

Siguen pendientes publicación/firma de releases, actualización/rollback
ensayados y piloto LAN. Esta versión no declara producción lista.

## Contenedor sin privilegios y estado existente

La imagen usa UID/GID 10001 y prepara /data con modo 0700. Compose e instaladores
usan raíz de solo lectura, cap-drop ALL, no-new-privileges, 128 procesos, 256 MiB,
1 CPU y tmpfs limitado. /data permanece escribible para la cola. No se publican
puertos; la conectividad de los targets privados requiere red LAN autorizada.

Un volumen existente creado como root debe migrarse **con el agente detenido y
con copia de respaldo**: propietario UID/GID 10001, directorio 0700, diarios
0600. No se modificó ningún volumen real existente en esta tarea. La aplicación
no ejecuta chown como root ni corrige permisos elevando privilegios al arrancar.

El archivo de token debe ser legible por UID 10001 dentro del contenedor. En
Linux, usar por ejemplo propietario root/grupo 10001 y modo 0440 en un directorio
restringido. En Windows, restringir ACL al operador autorizado. Montarlo readonly
no sustituye proteger el archivo en el host. Archivos escribibles por grupo/otros
se rechazan en POSIX salvo que el propio montaje sea de solo lectura.

## Drenaje y rotación ordinaria de token

1. `docker exec sentinine_agent python -m delivery drain`: deja de pedir tareas.
2. `docker exec sentinine_agent python -m delivery status`: esperar pending=0.
   El estado solo muestra conteos, nunca tareas ni secretos. Esperar que terminen
   las comprobaciones en curso dentro de sus presupuestos configurados.
3. Detener el agente; esperar que pasen más de 45 s desde el último heartbeat.
4. Un administrador de la organización hace POST a
   `/api/v1/agent-probes/{id}/rotate-token/`. Online, reservas activas o resultados
   v2 pendientes producen 409. Una ejecución no recibida puede bloquear la
   rotación hasta su resolución o vencimiento de 24 h.
5. Guardar el nuevo token (solo se revela una vez) en el archivo protegido;
   recrear el contenedor con el mismo volumen y nuevo montaje de secreto.
6. `docker exec sentinine_agent python -m delivery resume`; verificar heartbeat.

El token anterior deja de autenticar inmediatamente en nuevas solicitudes. El
endpoint de rotación está aislado por organización y registra auditoría sin
guardar el secreto en ella. DELETE del agente sigue siendo la revocación de su
identidad; no confundirlo con rotación conservando el agente.

El token se carga al iniciar el proceso; no hay recarga silenciosa en caliente.
El diario mantiene separación por servidor/token: rotar únicamente después de
drenar para no abandonar pendientes del token anterior. Los archivos anteriores
se conservan. Los instaladores no reemplazan un contenedor existente de forma
implícita y no declaran conexión confirmada solo porque docker run devuelva éxito.

## Entrega persistente en 1.4.0

- Actualizar backend y aplicar `monitoring.0007_agent_execution_delivery` antes
  de actualizar agentes. Se conserva el protocolo anterior para agentes antiguos.
  Senti9 1.4 requiere confirmación explícita del protocolo 2 y no ejecuta trabajo
  nuevo de un backend antiguo que no ofrezca esa confirmación.
- Heartbeat, ejecución y envío corren en bucles independientes. Máximo 10 workers;
  no se ejecutan simultáneamente dos tareas del mismo target en un proceso.
- Cada tarea lleva execution_id, run_before y una política guardada por servidor.
  Una respuesta heartbeat perdida puede reenviarse con el mismo identificador.
- Diario SQLite WAL con synchronous=FULL en SENTININE_STATE_DIR. Docker usa /data
  y requiere volumen persistente. Compose, instaladores y comando generado montan
  sentinine_state. En Python nativo, el directorio predeterminado es
  ~/.local/state/senti9. No eliminar el volumen al actualizar el contenedor.
- La cola se separa por servidor/token, con archivo modo 0600 y directorio nuevo
  modo 0700. No mover resultados de otra organización ni cambiar token esperando
  que migre automáticamente la cola. Usar un único proceso por archivo; el agente
  toma un bloqueo de proceso para impedir recuperaciones concurrentes.
- Hasta 1.000 tareas/resultados pendientes. Al alcanzar el límite se anuncia
  capacidad cero, sin borrar pendientes para hacer espacio. El límite no incluye
  rechazos históricos, cuya tabla conserva los últimos 1.000 registros.
- Solo accepted/duplicate eliminan un resultado confirmado. rejected lo mueve a
  diagnóstico local con motivo. Acuses ausentes o desconocidos conservan el
  resultado. Una marca local durante 48 h evita reejecutar un heartbeat demorado
  que llegue después del acuse. Estas marcas caducan por tiempo.
- Al reiniciar, tareas queued pueden ejecutarse si siguen dentro de su ventana;
  tareas running se convierten en error de interrupción. No se repiten peticiones
  que pudieron haber tenido efectos. Esto evita reintentos automáticos de API,
  pero no garantiza exactamente una ejecución de un efecto externo.
- Ventana de inicio/reentrega: 10 min. Recepción de resultados: hasta 24 h desde
  emisión. Relojes sincronizados (tolerancia 5 min); finalización dentro de los
  primeros 15 min. Un resultado tardío válido conserva su fecha, no reemplaza un
  estado más reciente y nunca libera una reserva posterior. Fuera de contrato se
  rechaza explícitamente y se conserva el diagnóstico local.
- El ledger backend se purga al vencer mediante purge_telemetry. Payload de tarea
  puede contener headers/cuerpo configurados; se vacía al aceptar el resultado.
  No publicar el diario local ni incluirlo sin revisión en paquetes de soporte.
- SIGTERM/SIGINT detienen admisión y esperan los workers para guardar resultados.
  Un cierre forzado recupera running como interrumpido. DNS está acotado por su
  proceso descartable; una respuesta HTTP completa no tiene deadline global.

No es una garantía de retención ilimitada: disco averiado, eliminación del
volumen, ventana vencida o revocación pueden impedir la entrega. Los errores no
se presentan como éxito y los pendientes no se descartan por un fallo de red.
