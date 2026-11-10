# Superadmin: implementación y validación — 2026-11-08

## Alcance

Cambios locales en las cinco pestañas de `/admin/platform`. Se conserva carga
automática al entrar salvo los eventos de Auditoría, cuya consulta es explícita.
No se desplegó, enviaron correos externos ni reclasificaron organizaciones operativas.
Las migraciones se aplicaron solo a la base `sentinel_audit`.

## Cambios

- Actualización administrativa independiente del portal y edad real de consulta.
- Pestaña en URL; filtros/páginas en memoria mientras se navega. No se guardan
  correos ni filtros en URL, localStorage o sessionStorage.
- Búsqueda de directorios a 300 ms, señales de cancelación y páginas de 25.
- `is_test=false` por defecto; clasificación manual con motivo y auditoría.
  Resumen excluye pruebas; directorio/exportación permiten todos/clientes/pruebas.
- Agregación de MRR por grupos, conteos mediante subconsultas y exportación sin
  tres consultas adicionales por fila. MRR sigue siendo estimación, no pago confirmado.
- Catálogo de planes desde API; confirmaciones con motivo y consecuencias visibles.
- Ficha por sección con totales reales y paginación de usuarios/infraestructura/auditoría.
- Usuarios filtrables por organización, rol, verificación y 2FA.
- Beta separa guardar cupos, admisiones e invitación; muestra reservas, disponibilidad,
  estados de envío traducidos y vigencia de invitación separada de la cuenta.
- Auditoría con selectores, rangos rápidos, detalle acotado sin metadata/credenciales,
  accesos desde usuario/organización y filtros aplicados distintos de los editados.
- Advertencia dos minutos antes de expirar; al vencer se limpia la sesión y sus datos.

## Fallos descubiertos y corregidos

1. Suspender producía 500: el código referenciaba `OrganizationSubscriptionStatus.SUSPENDED`
   sin existir en las choices. Se añade estado y migración 0009; suspensión/reactivación
   se ejercitan con API real y tienen regresión backend.
2. Filtros booleanos opcionales podían filtrar usuarios aun sin selección por la
   interpretación de QueryDict. Ausencia significa ahora no aplicar ese filtro.
3. Acciones de usuario podían dejar abierto un menú con datos anteriores. La mutación
   espera la actualización y el menú se reinicia al cambiar rol/estado.
4. El botón de recarga utilizaba claves tenant del portal; ahora observa y recarga
   las consultas activas del proveedor administrativo.
5. Rango invertido: reproducido con `datetime-local` en Chromium. La consulta queda
   bloqueada, y el backend rechaza el mismo rango; no se atribuye un defecto previo
   basándose en el primer intento de automatización inconcluso.

## Matriz funcional

| Opción | Resultado esperado y comprobación | Evidencia |
| --- | --- | --- |
| Acceso/2FA | Credenciales de fixture + TOTP real; sesión administrativa independiente | Chromium real; tests de autenticación Django |
| Resumen | Solo clientes por defecto, cifras coherentes y acceso filtrado | Tests de clasificación/estadísticas; Chromium de consola |
| Organizaciones: buscar/paginar | Página inicial de 25; búsqueda reduce a cliente exacto | Chromium real; límite/consultas constantes Django |
| CSV filtrado y completo | Descarga según alcance; celdas potencialmente ejecutables escapadas | Dos descargas Chromium; contenido/filtro Django |
| Clasificar prueba/cliente | Motivo obligatorio; cambia clasificación y métricas, no plan | Cambio reversible Chromium real; auditoría y permisos Django |
| Ficha: General | Datos base sin descargar listas de otras pestañas | Regresión lazy detail Django; Chromium real |
| Ficha: Usuarios | Listado y total de miembros | Chromium real; contrato paginado backend |
| Ficha: Infraestructura | Vacío explícito; estado y latencia separados | Chromium real; revisión del componente |
| Ficha: Auditoría | Eventos de esa organización, totales y navegación | Chromium real; filtros backend |
| Cambiar plan | Catálogo API; motivo; cambio persistido y límites recalculados | Chromium real; regresión Django |
| Extender prueba | Fin calculado desde máximo de ahora/fin anterior; estado trialing | Chromium real; regresión Django |
| Suspender/reactivar | Estados válidos y acciones auditadas | Chromium real; regresión Django |
| Usuarios: filtros y límites | Consulta de servidor por organización/rol/verificación/2FA | Django y Chromium de directorio |
| Activar/desactivar | Cambia estado; menú actualizado | Ambas acciones Chromium real; Django |
| Administrador/Viewer | Rol persistido y sesiones sujetas al nuevo rol | Ambas acciones Chromium real; Django |
| Revocar sesiones | Rechaza JWT anterior y registra operador | Chromium real; regresión JWT Django |
| Protecciones | No modificar superadmin ni retirar último administrador | Django y acceso Viewer Chromium |
| Beta: cupos/admisiones | Cada acción conserva el otro valor | Chromium real; regresión Django |
| Beta: invitación/reenvío | Crea outbox; entrega solo al backend locmem | Chromium real + pruebas de correo Django |
| Beta: revocar/rechazar | Transición válida con motivo | Chromium real y suite beta Django |
| Beta: suspender/reactivar | Cambia admisión de organización beta | Chromium real y suite beta Django |
| Auditoría manual | Cero consultas de eventos antes de confirmar o al editar | Contador de peticiones Chromium real |
| Auditoría: filtros/fechas | AND de filtros, fin exclusivo y validación de rango | Django y Chromium real |
| Auditoría: navegación | Conserva filtros, página y datos sin nueva consulta al volver | Chromium real |
| Evento | Carga al abrir; campos permitidos, sin metadata arbitraria | Chromium real; whitelist Django |
| Sesión | Aviso y salida al vencer con limpieza del contexto | Chromium con reloj controlado |
| Responsive | 1440×900 y 390×844; sin overflow del documento | Capturas y aserción Chromium |

## Entorno reproducible

Proyecto Docker separado `sentinel-audit-superadmin`, Compose `docker-compose.audit.yml`.
PostgreSQL/Redis propios, API localhost:31800, Vite localhost:31801, worker sin Beat.
El comando `seed_platform_audit` exige base `sentinel_audit` y correo locmem;
sus credenciales/TOTP son fixtures públicas exclusivamente para ese entorno.

Preparar esquema y fixtures desde el backend aislado:

```text
python manage.py migrate --noinput
python manage.py seed_platform_audit
python manage.py test --noinput
python manage.py makemigrations --check --dry-run
```

Con Vite apuntando a `VITE_API_URL=http://127.0.0.1:31800/api/v1`:

```powershell
$env:E2E_BASE_URL='http://127.0.0.1:31801'
$env:PLATFORM_ISOLATED='1'
node node_modules/@playwright/test/cli.js test platform-real.spec.ts --reporter=list
```

La suite real requiere fixtures restablecidas y operadores independientes para
respetar la prevención de reutilización de TOTP; no se deshabilitan rate limits ni 2FA.
Capturas locales: `frontend/.tmp/platform-validation/` (ignoradas por Git).

## Gates y límites

### Ajuste visual posterior de navbar

Portal y consola comparten `NavbarFrame`: marca, superficie, borde, alturas y
alineación comunes. Cada consumidor conserva su autenticación y acciones; el
superadmin no monta la búsqueda ni las consultas del portal. La cabecera incorpora
la actualización junto a las exportaciones; las pestañas usan iconos y subrayado,
con scroll horizontal propio en móvil. Organizaciones agrupa búsqueda, planes,
estado y clasificación en una sola superficie; las acciones de fila tienen 44 px.
Verificación posterior: TypeScript/build, 10 regresiones de sesión/consola y tres
recorridos con API real aprobados localmente; capturas 1440×900 y 390×844 revisadas.

| Gate local final | Resultado |
| --- | --- |
| Django completo | **332/332**, sin fallos; BD de pruebas eliminada por Django |
| Chromium general | **223 aprobadas**, 3 casos aislados excluidos de esa invocación por requerir fixtures propias |
| Chromium superadmin con API real | **3/3**, ejecutados aparte con las fixtures aisladas |
| TypeScript y build Vite | Aprobados |
| Migraciones `--check --dry-run` | Sin deriva |
| Guard de repositorio y contratos Node | Guard aprobado; **10/10** pruebas rápidas |
| `git diff --check` | Aprobado |

La primera ejecución general detectó que los filtros ampliados de Usuarios
ocultaban la primera fila en móvil: se agruparon en Filtros avanzados y se repitió
la suite completa, en verde. Durante las repeticiones reales se alcanzó el límite
diario de reenvío de una misma invitación de fixture: se conserva esa invitación y
se crea otra de prueba; no se borran presupuestos ni se debilita la protección.

Contratos nuevos: `platform-admin/catalog/`, `audit-options/`,
`audit-logs/{id}/`, `organizations/{id}/classification/`.
Detalle de organización acepta `section=general|users|infrastructure|audit` y
`page`; conserva arrays y añade `counts`/`has_next`. Usuarios acepta `organization`,
`role`, `verified`, `mfa`. Directorio/exportación aceptan `classification` y
`trial_expiring`; stats acepta clasificación y devuelve `trial_expiring_7d`.

Capturas revisadas: escritorio 1440×900 (Organizaciones y Beta), móvil 390×844
(Auditoría); guardadas en `.tmp/platform-validation/` dentro de frontend.
Servicios temporales y Vite aislado detenidos al finalizar; volúmenes conservados.

Ejecuciones locales; no acreditan CI remoto ni aprobación productiva. El proveedor
real de correo y la política Access del dominio administrativo quedan fuera de este entorno.
Actualización local posterior: se aplicaron organizations.0008 y 0009 en el entorno
de desarrollo (`DEBUG=True`) después de confirmar el 500 por columna `is_test`
ausente. El acceso real vuelve a aceptar las credenciales y solicitar 2FA. No hubo
despliegue productivo ni clasificación automática de organizaciones existentes.
