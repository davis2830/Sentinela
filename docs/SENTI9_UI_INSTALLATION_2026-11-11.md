# Senti9: directorio y guía de instalación

Revisión local del 11 de noviembre de 2026. Se conservan permisos, API, tokens, identidad y runtime del agente. Esta entrega cambia el frontend; no publica otra imagen ni actualiza agentes instalados.

## Resultado

El directorio prioriza identidad, estado de conexión, monitores asignados, última señal y versión reportada. Cada agente indica el siguiente paso y ofrece ficha, instalación y acceso a sus monitores según permisos. La guía lateral explica el recorrido; en móvil permanece accesible desde la cabecera.

La guía previa al registro permite revisar Docker Engine/Linux o Docker Desktop/Windows y sus requisitos sin crear agentes ni consultar perfiles. El registro mantiene tres pasos: registrar ubicación, guardar token e instalar, comprobar primera señal.

La instalación usa el perfil generado por el backend y la imagen pública [davis1924/senti9](https://hub.docker.com/r/davis1924/senti9). No requiere `docker login`. Respeta la imagen, servidor, volumen y nombre propios configurados en el perfil, en vez de duplicarlos en el frontend.

1. Comprobar Docker en modo contenedores Linux.
2. Descargar la imagen configurada; el paquete local sigue disponible como alternativa avanzada.
3. Indicar la ruta absoluta del archivo de token guardado y preparar permisos en Linux.
4. Ejecutar el comando personalizado del contenedor. Los controles de copia se habilitan después de guardar el token e indicar una ruta válida.

Las rutas se entrecomillan para Bash/PowerShell, admiten espacios y apóstrofes y rechazan rutas relativas, comas y saltos de línea. No se envían al servidor ni se guardan en almacenamiento del navegador. Los comandos conservan token montado en lectura, ejecución sin privilegios y volumen persistente. La copia confirma éxito únicamente si el portapapeles acepta el comando.

El detalle de un agente permite volver a consultar sus instrucciones con el archivo ya guardado: no crea, revela ni rota credenciales. Los revocados conservan ficha e historial y no ofrecen instalación. Diagnóstico, actualización, CA corporativa y descarga del perfil están bajo opciones avanzadas.

La primera señal confirma comunicación, no una medición saludable. La espera consulta cada diez segundos durante dos minutos, sin solicitudes superpuestas y abortando la petición al expirar o cerrar. Se puede volver a instrucciones y reintentar sin registrar otro agente ni volver a descargar su secreto. La ficha ofrece **Revisar conexión**, sin iniciar monitores.

## Comprobación por opción

| Opción | Resultado esperado y obtenido | Límite |
| --- | --- | --- |
| Directorio y filtros | Búsqueda y estado conservan API paginada de 25; identidad y acciones legibles | La cuota procede de la suscripción; no es un conteo del filtro |
| Guía | Apertura, cambio de plataforma, teclado, Escape y retorno del foco; cero escrituras y cero consultas de perfil | Instalar Docker es una tarea externa |
| Registrar | Alta contra API aislada; versión desconocida hasta señal real | Sólo administradores |
| Archivo de token | Descarga coincide con el secreto; no aparece en DOM ni almacenamiento | Guardarlo sigue siendo responsabilidad del operador |
| Windows/Linux | Perfil real, copia condicionada, rutas con espacios/apóstrofes y expansión literal segura | Pruebas de navegador; no equivalen a instalación en cada SO |
| Primera conexión | Heartbeat real de fixture confirma conexión; timeout y reintento conservan el agente | El heartbeat de la prueba no ejecuta un servicio de cliente |
| Instalar un agente existente | Cero mutaciones y ningún secreto regenerado; ruta limpia al cerrar | Requiere el archivo previamente guardado |
| Lector | Consulta ficha y guía, sin registro, instalación, rotación ni creación de monitor | Backend mantiene la autorización |
| Retirar | Flujo real aislado revoca token y lo rechaza posteriormente | No se retiraron agentes reales |
| Responsive | 1440×900, 1366×768 y 390×844 sin scroll horizontal del documento | Los comandos tienen desplazamiento horizontal propio |

Se corrigieron durante la revisión el nombre comprimido en móvil, la intercepción del radio de plataforma por su icono y el estado del asistente al volver después del timeout.

## Evidencia visual

| Vista | Antes | Después |
| --- | --- | --- |
| Escritorio | [1440×900](assets/senti9-ux-20261111/before-1440.png) | [1440×900](assets/senti9-ux-20261111/after-1440.png) · [1366×768](assets/senti9-ux-20261111/after-1366.png) |
| Móvil | [390×844](assets/senti9-ux-20261111/before-390.png) | [390×844](assets/senti9-ux-20261111/after-390.png) |
| Guía | — | [Escritorio](assets/senti9-ux-20261111/guide-1440.png) · [Móvil](assets/senti9-ux-20261111/guide-390.png) |
| Instalación Windows | — | [Escritorio](assets/senti9-ux-20261111/install-windows-1440.png) · [Móvil](assets/senti9-ux-20261111/install-windows-390.png) |
| Instalación Linux | — | [Escritorio](assets/senti9-ux-20261111/install-linux-1440.png) · [Móvil](assets/senti9-ux-20261111/install-linux-390.png) |

Capturas con cuentas y agentes aislados, sin tokens. Las instrucciones HTTP del laboratorio se identifican expresamente; para clientes remotos se necesita el servidor de control HTTPS accesible desde su red.
El entorno habitual sigue configurado con `http://host.docker.internal:8000`; esta entrega no lo sustituye por una dirección pública ni despliega el servidor.

## Validación local

- Django completo: **399 pruebas aprobadas** en base aislada.
- Chromium dirigido: **13 pruebas aprobadas**, API aislada, alta, archivo, primera señal, retiro, errores, permisos, plataformas y tres resoluciones.
- TypeScript, build, ESLint sin advertencias, formato de archivos modificados y reproducibilidad de tipos OpenAPI: aprobados.
- `localhost:3001` sirve los módulos nuevos del directorio y de las instrucciones con HTTP 200.

Las pruebas viven en `frontend/e2e/connectivity-senti9.spec.ts` y `frontend/e2e/senti9-installation-ux.spec.ts`. Registros locales: `.tmp/senti9-ux-*`. Sin cambios de contratos, migraciones, dependencias o runtime. No se repite la certificación de la imagen: su evidencia independiente está en [publicación y revisión de imagen](SENTI9_PUBLIC_IMAGE_2026-11-11.md).
Una repetición inicial alcanzó el límite de accesos de la cuenta fixture. El test se corrigió para reutilizar la sesión; se reiniciaron únicamente los dos contadores de correo de prueba en `sentinel_audit`, sin alterar la política, los contadores de clientes ni el entorno habitual.

Estos resultados son locales. CI remoto, despliegue y una instalación en un equipo de cliente no se acreditan en esta entrega.
