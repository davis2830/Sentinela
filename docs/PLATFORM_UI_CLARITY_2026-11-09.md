# Consola superadmin: claridad visual y flujos

Fecha: 2026-11-09. Evidencia local del refinamiento posterior a la consola de beta. Esta entrega modifica la presentación y sus recorridos; conserva endpoints, permisos, reglas de negocio y sesión administrativa.

## Problema corregido

La jerarquía anterior presentaba formularios, configuración y resultados con peso similar. No distinguía con rapidez qué requería atención, qué describía un estado y qué acción permitiría continuar.

La nueva interfaz da prioridad al directorio y utiliza secciones con propósito, títulos, iconos y estados explícitos. Una invitación se redacta en un diálogo; cupos y comentarios se configuran en un drawer propio. No hay formularios permanentes ocupando la cabecera del directorio.

## Cambios por sección

| Sección | Resultado |
| --- | --- |
| Resumen | Cuatro indicadores con alcance; mesa de seguimiento con envíos fallidos, accesos bloqueados e invitaciones vencidas. Verificación, recursos y mediciones se agrupan bajo Continuar incorporación. A la derecha, admisiones y recorrido explicado del participante. Comercial sigue desplegable y bajo demanda. |
| Beta | Admisiones y cupos en una franja; participantes como contenido principal. Búsqueda, etapa y último envío juntos; Atención y Orden bajo Más filtros. Cada fila separa etapa, correo, organización/acceso y próximo paso. Historial de envío bajo demanda. |
| Invitación | Diálogo enfocado: destinatario, explicación de lo que recibirá, cupos y confirmación auditada independiente. Tras éxito se puede volver al directorio. |
| Configuración | Drawer con Cupos y admisiones / Comentarios. Guardar cupos, cambiar admisiones y guardar enlaces conservan motivos y confirmaciones independientes. |
| Organizaciones | Identidad y contacto legibles, acceso separado de suscripción, plan sin partir palabras, búsqueda/filtros agrupados, exportación única, Ver ficha visible y resto en menú compacto. |
| Ficha de organización | Identidad y cuatro estados persistentes; pestañas con iconos; contacto agrupado; bloque administrativo separado de información y suspensión. Recursos siguen consultándose al seleccionarlos. |
| Usuarios | Identidad, acceso/rol y verificación distinguibles. Orden y filtros secundarios desplegables. La ficha separa cuenta, organización, seguridad y permisos efectivos. |
| Salud | Último diagnóstico con fecha y problemas nombrados arriba. Dependencias fallidas/no disponibles primero; propósito, estado y latencia por fila. Actualizar antes de copiar. No disponible conserva su significado. |
| Auditoría | Alcance de consulta dividido en identidad y período; filtros técnicos secundarios. Consultar visible antes de filtros en móvil. Consulta aplicada y eventos separados; resultado, actor y fecha reconocibles; detalle bajo demanda. |

Los botones principales, secundarios, de navegación y destructivos tienen pesos distintos. Los formularios usan etiquetas visibles, campos consistentes y errores cerca de la acción. Las confirmaciones muestran consecuencias y motivo auditado.

## Validación local

- Django completo con PostgreSQL/Redis aislados: **378 aprobadas**, sin cambios backend en este refinamiento.
- TypeScript completo, ESLint de src sin warnings y build Vite: **aprobados** después del último cambio de presentación.
- Chromium de consola: **17 casos aprobados** en una ejecución final de platform-admin, platform-beta, platform-shell, platform-clarity y platform-design.
- API real aislada: **4 recorridos aprobados**, incluidos fichas, CSV, cambio de plan, extensión, clasificación, suspensión/reactivación, usuarios, expiración, auditoría manual, cupos, admisiones, reenvío/revocación/rechazo e invitación nueva. Correo locmem, sin mensajes externos.
- Las repeticiones dirigidas no se suman como casos distintos.
- El flujo ampliado de reenvío de verificación ya tiene evidencia backend/API en [la entrega funcional](PLATFORM_BETA_CONSOLE_2026-11-09.md). En esta revisión no se volvió a consumir su presupuesto diario; su nueva acción visible y los demás estados se revisaron con fixtures.
- Las pruebas visuales recorren **1440×900, 1366×768 y 390×844**: seis secciones, fichas, formulario de invitación, configuración, auditoría inicial/consultada y detalle.
- Teclado, Escape, devolución del foco, tacto emulado, diálogos anidados, historial y persistencia de filtros comprobados. Sin overflow del documento, contenido principal ni diálogos en esos recorridos.
- Auditoría: **cero peticiones de eventos** al abrir/editar; una al consultar; conserva resultados al regresar. Directorios automáticos y páginas de 25 conservados.
- Un mock anterior devolvía un arreglo para el catálogo de auditoría; se actualizó al contrato real actions/modules, manteniendo la comprobación del evento visible.

Estas pruebas no acreditan una auditoría WCAG formal, CI remoto ni despliegue. La suite general y las pruebas del agente de la entrega funcional no se presentan como una nueva ejecución de este refinamiento.

## Comparación visual

Las capturas nuevas utilizan datos ficticios explícitos para mostrar distintas etapas, problemas y próximos pasos sin consultar clientes reales. Las anteriores provienen de fixtures aisladas de la entrega funcional. Mismo viewport; los conjuntos de datos no son idénticos.

| Sección a 1440×900 | Antes | Después |
| --- | --- | --- |
| Resumen | [Anterior](assets/platform-beta-console/summary-1440.png) | [Actual](assets/platform-ui-clarity/summary-1440.png) |
| Beta | [Anterior](assets/platform-beta-console/beta-1440.png) | [Actual](assets/platform-ui-clarity/beta-1440.png) |
| Organizaciones | [Anterior](assets/platform-beta-console/organizations-1440.png) | [Actual](assets/platform-ui-clarity/organizations-1440.png) |
| Usuarios | [Anterior](assets/platform-beta-console/users-1440.png) | [Actual](assets/platform-ui-clarity/users-1440.png) |
| Salud | [Anterior](assets/platform-beta-console/health-1440.png) | [Actual](assets/platform-ui-clarity/health-1440.png) |
| Auditoría | [Anterior](assets/platform-beta-console/audit-1440.png) | [Actual](assets/platform-ui-clarity/audit-1440.png) |

También se incluyen las seis pantallas a 1366 y 390 px; [invitación](assets/platform-ui-clarity/invite-1440.png), [configuración](assets/platform-ui-clarity/configuration-1440.png), [ficha de organización](assets/platform-ui-clarity/organization-dossier-1440.png), [ficha de usuario](assets/platform-ui-clarity/user-dossier-1440.png), [auditoría consultada](assets/platform-ui-clarity/audit-results-1440.png) y [detalle del evento](assets/platform-ui-clarity/audit-event-1440.png).

## Archivos y reproducción

Presentación compartida: PlatformSectionHeader, PlatformUI, PlatformActionModal, PlatformRefresh y platform-console.css. Pantallas: PlatformAdminPage, PlatformBetaSummary, BetaAdminPanel, PlatformUsers, PlatformUserDetail, TenantDetailDrawer, EditOrganizationContact, PlatformHealth y PlatformAudit.

Con Vite apuntando a la API aislada en 31800 y servido en 31801, ejecutar desde frontend:

```powershell
$env:E2E_BASE_URL='http://127.0.0.1:31801'
node node_modules/@playwright/test/cli.js test e2e/platform-admin.spec.ts e2e/platform-beta.spec.ts e2e/platform-shell.spec.ts e2e/platform-clarity.spec.ts e2e/platform-design.spec.ts --project chromium
```

platform-clarity prepara fixtures, visita cada sección y genera capturas. platform-design comprueba estados vacíos, contexto/filtros, foco y tacto en los tres tamaños. Para los recorridos reales, usar las fixtures y variables del [informe funcional](PLATFORM_BETA_CONSOLE_2026-11-09.md); requiere PLATFORM_ISOLATED=1.

No se aplicaron migraciones al entorno habitual ni se reclasificaron clientes. La migración accounts.0011 de la entrega funcional sigue teniendo su procedimiento independiente. No se añadieron dependencias ni se alteró el buscador retirado.
