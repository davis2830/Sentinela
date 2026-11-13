# Revisión y distribución pública de Senti9 1.8.0

La imagen revisada para Docker Hub es `davis1924/senti9:1.8.0`, para `linux/amd64` y `linux/arm64`. Esta revisión no actualiza agentes instalados ni despliega el backend productivo. Windows utiliza Docker Desktop con contenedores Linux.

## Cambios anteriores a la publicación

- Base oficial de Python fijada por digest: `python:3.11-alpine@sha256:bb1d70c1df30d8ee1e05214dbe82d6cdfd29833c1f47ce917f20991aca93acaa`.
- Actualización de paquetes de Alpine: zlib 1.4-r0 y krb5-libs 1.22.3-r0.
- Retirados pip, setuptools y wheel: el runtime sólo usa la biblioteca estándar.
- Contexto de construcción limitado mediante `.dockerignore`; runtime con copias explícitas. No se incluyen cachés Python del host, tokens, CAs privadas, diarios, pruebas ni archivos del entorno.
- Ambas arquitecturas conservan UID/GID 10001. Se probaron con raíz de sólo lectura, capacidades retiradas, `no-new-privileges` y sin red.
- El workflow de paquetes se corrigió a candidato 1.8.0 y baseline 1.7.0; conserva su carácter manual y sin publicación automática.
- El portal presenta “Docker Hub / registro”; `docker login` se requiere únicamente para repositorios privados. El token y la cuenta de Sentinel siguen siendo necesarios aunque la imagen sea pública.

La inspección comprobó nueve archivos fuente, sus hashes frente al código actual, ausencia de credenciales en la configuración del contenedor, ausencia de diarios iniciales, CAs públicas y ausencia de herramientas de instalación. Esta comprobación del contexto y runtime no sustituye una auditoría general de todo el código de Sentinel.

## Vulnerabilidades y aplicabilidad

Docker Scout v1.25.0 detectó **12 avisos altos/críticos** en la candidata anterior. Después de reconstruirla detecta **dos altos, cero críticos**, en ambas arquitecturas. El análisis de todas las severidades devuelve esos mismos dos avisos. Se conservan los resultados originales; no se aplicó una exclusión general de CVEs.

| Aviso restante | Evidencia | Evaluación para esta imagen |
| --- | --- | --- |
| CVE-2026-107891, musl | La imagen contiene 1.2.6-r3 en Alpine 3.24. El [tracker oficial de Alpine](https://security.alpinelinux.org/vuln/CVE-2026-107891) identifica exactamente 1.2.6-r3 como corregida en esa rama; Scout propone la revisión de edge 1.2.6-r6. | Parche del proveedor ya incorporado. La revisión de la rama estable difiere de edge. Revaluar si cambia la base o el paquete. |
| CVE-2026-119586, SQLite | [SQLite](https://www.sqlite.org/cves.html) sitúa el problema en la consola y el uso de `.recover` con salida canalizada a otra consola. Se verificó que el ejecutable `sqlite3` no existe; Senti9 usa la biblioteca mediante Python, con su diario propio y consultas parametrizadas. | El componente vulnerable de consola está ausente. No se importan bases entregadas por participantes ni se ejecuta `.recover`. Mantener esa separación. |

Estas evaluaciones se limitan a las imágenes exactas inspeccionadas. No significan que la imagen esté libre de vulnerabilidades desconocidas ni autorizan omitir otros avisos futuros. La [descripción de publicación](../sentinine/release/DOCKERHUB.md) no promete una certificación de seguridad.

## Evidencia local

| Control | Resultado observado |
| --- | --- |
| Pruebas del agente AMD64 | 61 aprobadas, 5,208 s. |
| Pruebas del agente ARM64 | 61 aprobadas, 7,683 s, bajo emulación de Docker Desktop. |
| Django completo en PostgreSQL/Redis aislados | 399 aprobadas, 97,560 s. |
| TypeScript/build y ESLint | Aprobados después del cambio de instrucciones del portal. |
| Auditoría del runtime | Aprobada en ambas arquitecturas; archivos/hash/UID/montajes/CAs y ausencia de credenciales. |
| Retorno a 1.7.0 | Cuatro fases seed → upgrade → rollback → resume aprobadas en AMD64 con los bytes de la imagen nueva. No se dispone de un baseline ARM64 de 1.7.0; esa variante cuenta con las 61 pruebas del agente. |
| SBOM | 52 paquetes identificados por arquitectura. |
| Chromium de Conectividad/Senti9 | 7 aprobadas, 1,0 min, con API aislada y casos controlados de error. |

El digest del índice revisado es `sha256:ea7b703fab4e855bfa9b3f4f91458c4bfd3123c0beb3ad9f3f68da30e68ba954`. Se publica una etiqueta versionada; no se crea `latest` ni se reemplazan imágenes de clientes. El repositorio se inspeccionó autenticado antes del cambio: era privado, sin etiquetas, y la cuenta `davis1924` tenía permiso administrativo.

## Estado de publicación

**Publicada y pública el 11 de noviembre de 2026 (America/Guatemala)**: [Docker Hub](https://hub.docker.com/r/davis1924/senti9). La etiqueta `1.8.0` devuelve el digest revisado y ambas arquitecturas. Se verificaron las dos descargas por digest con una configuración Docker nueva y vacía, sin credenciales. No se creó `latest`. No se actualizaron agentes instalados ni se ejecutó un despliegue productivo.

Docker Hub indexó la etiqueta con retraso después del push; se verificó mediante lecturas y no se repitió la subida. Su PATCH de metadatos actualiza la descripción pero no la visibilidad: se utilizó la operación específica de privacidad y después se comprobaron metadatos anónimos y descargas. La documentación pública incluye los dos avisos de seguridad y su evaluación.

CI remoto, firma criptográfica y un piloto en hardware ARM64 nativo o un host Linux independiente siguen sin acreditarse por esta ejecución. No se presentan como aprobados. El backend local se fija al digest publicado y su perfil de instalación indica distribución disponible.

Los archivos locales de preparación y logs están bajo `.tmp/senti9-public-*`. El paquete nuevo, sin alterar candidatos anteriores, está en `dist/senti9-1.8.0-public-20261111`. Sus hashes verifican integridad; no se creó una firma criptográfica con identidad externa. El paquete de retorno 1.7.0 permanece para recuperación local y no se publica como una nueva etiqueta.

Evidencia conservada: [publicación, descargas y controles](assets/senti9-public-20261111/publication.json), [runtime AMD64](assets/senti9-public-20261111/runtime-amd64.json), [runtime ARM64](assets/senti9-public-20261111/runtime-arm64.json), [análisis AMD64](assets/senti9-public-20261111/scout-amd64.sarif), [análisis ARM64](assets/senti9-public-20261111/scout-arm64.sarif), [SBOM AMD64](assets/senti9-public-20261111/sbom-amd64.json), [SBOM ARM64](assets/senti9-public-20261111/sbom-arm64.json) y [retorno AMD64](assets/senti9-public-20261111/compatibility.json).

## Uso

Tras confirmar la publicación:

```sh
docker pull davis1924/senti9:1.8.0
```

Referencia inmutable:

```sh
docker pull davis1924/senti9@sha256:ea7b703fab4e855bfa9b3f4f91458c4bfd3123c0beb3ad9f3f68da30e68ba954
```

Para instalaciones repetibles utiliza la referencia por digest registrada en esta revisión. El alta e instalación deben seguir el perfil de cada agente generado por Sentinel: archivo privado de token montado en lectura, servidor HTTPS remoto, volumen propio y sin publicar puertos. [Guía 1.8.0](../sentinine/release/RELEASE_1_8_0.md).

Se comprueba la disponibilidad pública con llamadas sin credenciales y descarga por digest. Docker documenta la [visibilidad pública](https://docs.docker.com/docker-hub/repos/manage/access/) y la [publicación de imágenes](https://docs.docker.com/docker-hub/repos/manage/hub-images/push/). Publicar permite descargar la imagen y leer el código Python que contiene; no concede acceso a organizaciones, tokens ni servidores de Sentinel.
