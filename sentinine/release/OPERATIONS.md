# Verificar, instalar y retornar Senti9 1.7.0

Ejecutar instalaciones reales únicamente en infraestructura autorizada. La prueba
de compatibilidad del paquete usa datos ficticios y contenedores sin red; no inicia
el bucle del agente ni contacta Sentinel o endpoints reales.

## Integridad y firma

Con Python 3.11 o posterior y las herramientas del checkout:

```text
python sentinine/release.py verify RUTA_DEL_PAQUETE
```

Sin `--public-key` el resultado acredita integridad, no identidad del publicador.
La clave pública debe obtenerse de GcTechOps por un canal confiable, separado del paquete.
No confiar en una clave pública simplemente porque viene junto al archivo descargado.

Firma del listado, una vez elegida la clave de publicación fuera del repositorio:

```text
cosign sign-blob --key RUTA_SEGURA/cosign.key --bundle RUTA_DEL_PAQUETE/SHA256SUMS.sigstore.json RUTA_DEL_PAQUETE/SHA256SUMS
python sentinine/release.py verify RUTA_DEL_PAQUETE --public-key RUTA_CONFIABLE/cosign.pub
```

La clave privada y su contraseña no forman parte del paquete. La firma no se ejecuta
automáticamente durante preparación ni se sustituye por un checksum.

## Carga sin registro

Tras verificar el paquete, cargar ambos archivos con `docker image load --input ARCHIVO.docker.tar`.
El archivo 1.7.0 incorpora la referencia `davis1924/senti9:1.7.0`. El archivo 1.6.0
conserva la referencia de baseline indicada en `release.json`; es una reserva local
de retorno, no evidencia de que esa referencia esté publicada en Docker Hub.
`image_id` identifica la imagen local; no es un digest remoto de registro.

## Actualización en instalación Compose existente

1. Registrar imagen exacta actual, nombre real del volumen/proyecto Compose y archivo de token.
2. Obtener una copia de respaldo del volumen con el agente detenido, según la política del cliente.
3. Activar drenaje: `docker exec sentinine_agent python -m delivery drain`.
4. Consultar `docker exec sentinine_agent python -m delivery status` hasta pending=0.
   Si no entrega, conservar los pendientes y diagnosticar antes de continuar.
5. Aplicar primero las migraciones backend requeridas y actualizar el frontend.
6. Usar el mismo proyecto Compose, volumen y token. Definir `SENTININE_IMAGE=davis1924/senti9:1.7.0`.
7. Ejecutar `docker compose up -d --no-deps sentinine` desde el proyecto del agente.
8. Consultar estado, comprobar versión y reanudar: `docker exec sentinine_agent python -m delivery resume`.
9. Confirmar en Sentinel una nueva señal, recepción del servidor y acuse del agente.

Para instalaciones hechas con `docker run`, recuperar los parámetros de montaje y
red del contenedor original antes de sustituirlo. El instalador rechaza reemplazos
implícitos; la prueba de compatibilidad no reconstruye configuraciones desconocidas.

## Retorno 1.7.0 → 1.6.0

Repetir drenaje y conservar el volumen/token. Definir `SENTININE_IMAGE` con la
referencia baseline de `release.json`, cargada previamente desde el archivo 1.6.0,
y recrear solo el servicio con el mismo comando Compose. Reanudar y confirmar
entregas. El frontend mostrará telemetría interna desconocida para 1.6.0.
Conservar las migraciones del backend y el volumen del agente durante el retorno.
La simulación también verifica el caso de una interrupción forzada con pendientes;
no autoriza a repetir peticiones API que pudieron tener efectos.

## Publicación posterior

La preparación no ejecuta `docker push`. Tras verificar pruebas, firma y permisos:

```text
docker image push davis1924/senti9:1.7.0
```

Registrar el digest remoto devuelto por el registro y verificar una descarga por ese
digest. No reemplazar una etiqueta publicada con bytes diferentes. No equiparar el
hash del archivo tar, el ID local y el digest de registro: identifican objetos distintos.

Referencias: https://docs.docker.com/reference/cli/docker/image/save/
y https://docs.sigstore.dev/cosign/signing/signing_with_blobs/.
