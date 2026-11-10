# Calidad, seguridad y SOLID: implementación de F01–F09

Implementación local del plan aprobado, con verificación final del 9 de noviembre de 2026. Entorno PostgreSQL/Redis separado mediante `docker-compose.audit.yml`, base `sentinel_audit`, identidades de fixture y correo locmem. No se desplegó ni se activaron permisos personalizados en organizaciones reales.

## Matriz de entrega

| Hallazgo | Cambio implementado | Evidencia |
|---|---|---|
| F01 · aislamiento | Caché privada del portal separada de la pública y de plataforma; identidad, organización y generación en el hash de consultas. Cancelación y desmontaje al cambiar de sesión, sincronización entre pestañas y protección de respuestas/refrescos anteriores. Logout retira datos antes de esperar la red. | `quality-session.spec.ts`, `auth-session.spec.ts`; comparación visual de A→B. |
| F02 · facturación | API devuelve `data: []` y `meta.billing_available: false`. Se retiró el recibo sintético, su modal, tarjeta ficticia, importes históricos y acciones de comprobante. | Pruebas con suscripción activa, prueba, pendiente y cancelada; recorrido real de Facturación. |
| F03 · contrato | Referencia regenerada con el comando oficial; rutas administrativas previas y nuevas rutas incorporadas. Se conserva la comparación obligatoria de CI. | Generación reproducible y comparación JSON; tipos generados reproducibles. |
| F04 · errores | Handler DRF para validación, permisos, ausencia, conflictos, límites y 500 seguros con correlación. Capturas concretas en vistas; operaciones de organización y su auditoría son atómicas. Fallos de autenticación por infraestructura no se presentan como credenciales inválidas. Los fallos de evaluación marcan el trabajo como fallido y cada regla tiene su transacción. | Inyección de errores, conflicto 409, diagnóstico 429/`Retry-After`, liberación de recursos y rollback de contraseña. |
| F05 · directorios | Páginas de 25 activadas mediante `page`; consultas anteriores sin página siguen devolviendo arreglo. Búsqueda/filtros en servidor, cancelación y selectores paginados. Unión ordenada de identidades en SQL antes de cargar relaciones; invitaciones deduplicadas antes de paginar. Roles/equipos precargados. | Directorios de 5, 25 y 30 integrantes con costo constante; más de una página, invitaciones duplicadas y filtros; UI real con 31 integrantes. |
| F06 · autorización | Política central por módulo/acción, comprobación de acciones masivas y denegación de operaciones sin política para usuarios personalizados. Modo `legacy` por defecto; activación individual administrativa con motivo, vista previa y auditoría. Roles operativos, sesiones invalidadas al cambiar acceso y tokens API con permisos vigentes. | Matriz permitida/denegada de 12 módulos, protección de administradores, aislamiento, perfiles, tokens de lectura y recorrido real de activación/revocación. |
| F07 · responsabilidades | Diez pantallas/formularios separan presentación de datos, mutaciones y estado del flujo mediante controladores React. Los formularios/detalles existentes se conservan. Directorios, autorización, catálogo y traducción HTTP tienen límites propios en backend. | TypeScript, lint, compilación y regresiones de portal/superadmin. |
| F08 · políticas y registros | Catálogo de planes/beta en backend y ruta autenticada del portal. Desaparecen precios/prestaciones duplicados y reemplazos de textos del modal. Registro permitido de transportes compartido por envío/prueba y evaluadores de alertas separados por condición. | Límites beta equivalentes al modelo; paridad de transportes; alertas/recuperación, mantenimiento y pruebas del agente. |
| F09 · herramientas | OpenAPI con parámetros, entradas, salidas de serializers y errores; tipos mediante `openapi-typescript`, conservando Axios/React Query. Errores externos pasan por `unknown` validado; DTOs y tipos específicos reemplazan los `any` identificados. ESLint/Hooks, comprobaciones de símbolos sin usar, Ruff y formato gradual incorporados a CI. | TypeScript estricto, lint sin advertencias, formato de módulos nuevos, generación reproducible y auditoría de dependencias. |

## Permisos y compatibilidad

- La administración de integrantes, equipos, roles, planes y seguridad mantiene su control administrativo. Los permisos operativos no conceden acceso al superadmin.
- `legacy` conserva la lectura anterior. Los roles almacenados se conservan y sólo se aplican operativamente cuando un administrador activa `custom` por integrante.
- El portal incorpora **Usuarios → Roles y permisos**: definición del rol, búsqueda paginada del integrante, acceso actual, vista previa, motivo y confirmación de activación. Los controles visuales por capacidad acompañan la comprobación obligatoria del servidor, incluidos menús compactos, diagnósticos, escaneos y acciones que necesitan permisos de dos módulos.
- Se mantienen aislamiento por organización, suscripción, cuotas, mantenimiento y alcance de lectura de tokens API.
- Administrador/Viewer establece explícitamente `legacy` y conserva asignaciones personalizadas inactivas.
- Los cambios de roles efectivos invalidan sesiones web mediante `session_version`; los tokens API consultan derechos actuales.
- La creación de un target por un operador personalizado no crea recursos de otros módulos de forma implícita. `auto_coverage=true` habilita únicamente los módulos compatibles que el operador puede crear; una selección explícita requiere sus permisos correspondientes. El worker vuelve a comprobarlos al ejecutar la tarea. El comportamiento administrativo previo se conserva.
- La ficha del endpoint oculta recursos, candidatos y actividad de módulos sin permiso. Los selectores de Status Page respetan permisos de origen. Completar, iniciar o cancelar mantenimientos y resolver incidentes exige la acción específica también en rutas de edición y lote.
- El buscador global exige lectura de todos los módulos que devuelve; no se muestra a un operador que carece de alguno.

## Contratos y migración

- Migración aditiva: `accounts/0010_user_authorization_mode`. Los registros existentes reciben `legacy` sin cambios en sus asignaciones.
- La reversión de esa migración se bloquea si existe cualquier usuario `custom`. Para revertir se necesita revisar y restaurar su modo mediante el flujo administrativo auditado; no se debe volver a código que ignore sus restricciones.
- Nuevas rutas: `GET organizations/current/plans/`, `GET users/authorization-catalog/`, `GET/PUT users/{user_id}/authorization/`.
- Los listados de usuarios e integrantes admiten `page`, búsqueda y filtros. `data` continúa siendo un arreglo; el modo paginado añade `meta` con página, tamaño, total y navegación.
- `organizations/current/invoices/` expone que la fuente de facturación no está configurada; una suscripción no constituye un pago.
- El generador conserva como desconocidos los campos JSON dinámicos o respuestas heredadas sin un serializer explícito. Los tipos estáticos no validan respuestas en ejecución; los errores externos y valores dinámicos identificados se comprueban en sus fronteras.

## Verificación local

Resultados locales finales:

| Comprobación | Resultado |
|---|---|
| Suite Django completa, incluida migración y restricciones de rollback | **359 aprobadas** |
| Agente Sentinine, contenedor sin red | **58 aprobadas** |
| Chromium general: portal, superadmin, autenticación, recuperación y módulos | **231 aprobadas**, 7 escenarios aislados omitidos aquí |
| Chromium con API real y fixtures aisladas: 4 superadmin + 3 portal | **7 aprobadas**; total de escenarios distintos ejecutados: **238** |
| TypeScript estricto y símbolos sin usar | Aprobado |
| ESLint, React Hooks y formato de controladores nuevos | Aprobado sin advertencias |
| Ruff global y formato de 15 módulos nuevos | Aprobado |
| Build Vite después del último cambio de código frontend | Aprobado |
| Referencia API frente al generador oficial y tipos reproducibles | Iguales |
| `makemigrations --check --dry-run` | Sin cambios pendientes |
| Pruebas Node de serialización/guardas y release gate | **12 aprobadas** |
| `npm audit`, incluidas dependencias de desarrollo | **0 vulnerabilidades** |

Las regresiones adicionales comprobaron la revocación antes de una tarea diferida, los accesos indirectos entre módulos, disponibilidad de escaneo para operadores personalizados sin consultas por fila y errores `ValueError` inesperados como 500 seguros.

Los recorridos reales comprobaron 1440×900, 1366×768 y 390×844; en móvil se usó tacto emulado. Las comprobaciones incluyen directorio de 31 integrantes, páginas de 25, activación con motivo y vista previa, rechazo del JWT anterior, lectura permitida/escritura denegada, navegación limitada de un operador personalizado y facturación sin recibos. Los recorridos de plataforma conservaron la consulta manual de Auditoría, filtros y paginación, acciones de organizaciones/usuarios/Beta y sesiones independientes.

Ejecuciones reproducibles: `python manage.py test --noinput`, `document_contracts api`, `npm run check:types`, `npm run lint`, `npm run format:check`, `npm run check:api` y `npm run build`. Las fixtures se preparan con `seed_platform_audit` y `seed_quality_audit`; ambos comandos rechazan una base o correo ajenos al entorno aislado.

La regresión del reloj de consulta selecciona ahora la clave exacta de usuario y organización; no toma la primera entrada de almacenamiento, que puede corresponder al ámbito anterior a cargar la identidad. Se conservan las comprobaciones del plazo y la ausencia de escaneos. Los seis módulos y la ficha de sólo lectura pasaron dos repeticiones adicionales (14 ejecuciones).

La batería general Chromium incluye siete escenarios reservados a fixtures aislados; éstos se ejecutan aparte con `PLATFORM_ISOLATED=1` y `QUALITY_ISOLATED=1`. No deben contarse como aprobados por el simple hecho de estar omitidos en la ejecución general.

Comprobaciones mantenidas en CI: tipos, ESLint/Hooks, formato de controladores nuevos, Ruff, contrato JSON obligatorio, generación de tipos reproducible, compilación y pruebas. No se consultó ni se ejecutó CI remoto como parte de esta entrega.

El formato se aplica por módulo; el código histórico ajeno al cambio no fue reformateado globalmente. Los imports sin usar sí se corrigieron donde el nuevo gate los detectó. Los reexports de modelos necesarios para Django permanecen explícitos.

## Dependencias

Herramientas nuevas fijadas en `package-lock.json` y `backend/requirements/quality.txt`. Se utiliza Node 24 como en CI. Se fijó `minimatch@10` a la versión corregida `11.0.1`: el [aviso del mantenedor](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249) afectaba a dependencias de ESLint/TypeScript. El cambio se comprueba con el lint y generación completos. La revisión de npm queda registrada por separado de las pruebas de comportamiento.

Referencias de herramientas: [openapi-typescript](https://openapi-ts.dev/introduction), [typescript-eslint](https://typescript-eslint.io/getting-started/), [React Hooks lint](https://react.dev/reference/eslint-plugin-react-hooks), [Ruff](https://docs.astral.sh/ruff/configuration/).

## Capturas

- [Antes: la identidad B mostraba datos de A](assets/code-quality/tenant-cache.png).
- [Después: B consulta y muestra su propia organización](assets/code-quality/tenant-isolation-fixed.png).
- Roles y permisos: [1440×900](assets/code-quality/roles-1440.png), [1366×768](assets/code-quality/roles-1366.png), [390×844](assets/code-quality/roles-390.png).

## Pasos externos separados

Al cierre de la implementación inicial, la migración se había probado únicamente en la base aislada. Posteriormente, por solicitud del usuario, se [aplicó en su entorno local el 9 de noviembre](MIGRATION_AUTHORIZATION_2026-11-09.md), con respaldo previo y los 157 usuarios conservados en `legacy`. Los demás entornos deben aplicar `accounts/0010_user_authorization_mode` antes de utilizar esta versión del backend.

CI remoto y despliegue no ejecutados. Facturación real permanece fuera de esta entrega. No se enviaron correos reales ni se reclasificaron clientes reales ni se realizó activación masiva de permisos. Las cuentas `quality.*@sentinel.invalid` pertenecen exclusivamente a las fixtures de la base aislada.
