# Senti9 1.7.0 — preparación de distribución

## Destino y alcance

Repositorio privado confirmado por el usuario: **davis1924/senti9** en Docker Hub.
Se ajustaron Compose, instaladores Windows/Linux y plantilla backend a
`davis1924/senti9:1.7.0`. Las variables y nombres de servicio/volumen heredados se mantienen.
No se ejecutó publicación ni se reemplazó un agente instalado.

La etiqueta anterior `sentinel/sentinine:1.6.0` es un baseline local, no una imagen
que se presuma disponible en Docker Hub. Se incluye su archivo de imagen para retorno.
Alcance de este candidato: **Linux/amd64**. No acredita ARM64, servicio Windows nativo
ni conectividad de una instalación real.

## Herramientas implementadas

`sentinine/release.py` utiliza Python estándar y Docker CLI:

- `compatibility`: verifica versiones leyendo el código dentro de las imágenes; ejecuta
  cuatro fases en imágenes exactas y un volumen con nombre aleatorio y etiqueta propia.
  Los contenedores usan `--network none`, raíz de solo lectura y sin capacidades extra.
  Solo retira el volumen creado por esta prueba, comprobando nombre y etiqueta.
- `prepare`: exige reporte exitoso para esas imágenes, destino nuevo y referencia aprobada.
  Compara los hashes del código local con el código real del candidato antes de exportar.
  Copia únicamente archivos permitidos; no incluye `.env`, tokens, diario real ni claves.
  Exporta ambas imágenes con `docker image save` y crea manifiesto y `SHA256SUMS`.
- `verify`: rechaza hashes incorrectos, nombres con traversal, entradas repetidas,
  reportes faltantes y archivos adicionales no inventariados. Por defecto solo acredita integridad.
  Con `--public-key` requiere además que Cosign verifique el bundle del listado firmado.

El manifiesto indica `local_candidate_not_published` y no atribuye ejecución de CI.
Los ID de imágenes locales, hashes de archivos y futuros digests remotos se distinguen.
No se modifica un candidato existente ni se publica con `latest`.

## Prueba de actualización y retorno

Secuencia: **1.6.0 → 1.7.0 → 1.6.0 → 1.7.0**.

Se verificaron, con datos sintéticos:

1. Configuración/token persistentes y mismo nombre de diario derivado del servidor/token.
2. Tareas queued y resultados ready preservados entre versiones.
3. Tarea running interrumpida convertida en error, sin repetir la petición.
4. Nuevo acuse guardado por 1.7.0 y conservado al abrir el diario en 1.6.0.
5. Resultados creados en 1.7.0 accesibles después del retorno y vuelta al candidato.
6. Dedupe de IDs settled y liquidación final de pendientes con acuses sintéticos.
7. Marca de drenaje preservada. Volumen temporal retirado.

La prueba valida compatibilidad de almacenamiento y reconstrucción del runtime,
no realiza peticiones HTTP ni prueba efectos de una API real. Los acuses son fixtures.
El token/configuración son archivos ficticios, no credenciales reales. No acredita
una actualización automática ni restaura por sí sola parámetros de una instalación desconocida.
1.6.0 no reporta la telemetría interna añadida en 1.7.0.

## Paquete

Destino local: `dist/senti9-1.7.0/` (ignorado por Git).

- Imágenes exportadas 1.7.0 y 1.6.0 para Linux/amd64.
- `release.json`: referencias, ID, hashes de fuentes y requisitos backend.
- `compatibility.json`: reporte de cuatro fases.
- `SHA256SUMS`: listado de integridad.
- README, notas de versión, guía operativa, Compose e instaladores.

Las [instrucciones de operación](../sentinine/release/OPERATIONS.md) cubren drenaje,
respaldo detenido, actualización conservando volumen/proyecto/token, retorno y verificación.

## CI y pendientes de publicación

Workflow manual: `.github/workflows/senti9-package.yml`. Requiere una imagen baseline
1.6.0 accesible **por digest**, además de secretos GitHub `DOCKERHUB_USERNAME` y
`DOCKERHUB_TOKEN` para descargarla del registro privado. Usa entrada como variable
de entorno validada, ejecuta las pruebas y sube únicamente un candidato sin firma
como artifact. No publica imágenes. Los nuevos unit tests también entran en el
workflow CI habitual mediante discovery.

Este workflow no se ejecutó remotamente. Antes de publicación faltan:

- Elegir y custodiar una clave de firma de GcTechOps fuera del repositorio. El login
  Docker no acredita la autoría criptográfica de un archivo distribuido.
- Firmar `SHA256SUMS` y verificar con la clave pública obtenida por canal confiable.
- Publicar en el repositorio privado y comprobar descarga por digest remoto.
- Ejecutar CI remoto y piloto en infraestructura autorizada.

La firma no se inventa ni se reemplaza por un checksum. No se generaron claves
privadas ni se solicitaron contraseñas/tokens en el chat.

## Evidencia local

- Suite Django completa: **288/288**, 104,212 segundos, salida 0; base temporal nueva
  conservada al cierre y retirada tras verificar cero conexiones. Base de desarrollo conservada.
- Agente y empaquetado: **58/58**, 4,870 segundos, Docker sin red ni puertos publicados.
- TypeScript/build frontend aprobado; Vite: 19,41 segundos.
- Compatibilidad: cuatro fases aprobadas con imágenes reales locales, fixture aislado
  y volumen temporal retirado.
- `release.py verify`: integridad verificada, autenticidad no verificada (firma pendiente).
- Dos archivos tar (~20,45 MB cada uno) cargados de nuevo con `docker image load`;
  sus ID se conservaron y coinciden con `release.json`.
- `git diff --check` sin errores; no nueva ejecución de navegador ni CI remoto.
- No se inició un agente real, ni se publicaron imágenes ni se usaron credenciales reales en fixtures.

## Referencias oficiales

- [Docker image save](https://docs.docker.com/reference/cli/docker/image/save/).
- [Firma de archivos con Cosign](https://docs.sigstore.dev/cosign/signing/signing_with_blobs/).
