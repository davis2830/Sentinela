# Uptime & Latencia: directorio compacto

Revisión local del 12 de noviembre de 2026. El mockup del usuario orienta la organización; se aplican sus cambios concretos a la cabecera y los filtros.

## Interfaz

- Se retiran la nota de alcance permanente y el botón independiente de exportación del listado.
- Se retira la franja de indicadores duplicada. Sus cinco estados quedan disponibles como filtros: Todos, Caídos, Online, Lentos y Pausados.
- Se retiran la fecha de última consulta y su botón de actualización de la cabecera de Uptime. La consulta automática conserva su reloj, frecuencia del plan y control de pausa.
- Una barra agrupa, en escritorio: búsqueda a la izquierda, selector de tipo, filtros de estado, etiqueta cuando está disponible y cambio entre lista/cuadrícula.
- Los conteos usan el resumen de la organización entregado por la API; su alcance aparece en el nombre accesible del grupo y la ayuda de los filtros. Un total desconocido sigue mostrando `—`.
- En móvil, los estados pasan a un selector y los controles se distribuyen en dos filas. Los controles conservan objetivos de interacción de 44 px y foco visible.
- La tabla, el acceso a Senti9 y las acciones actuales de cada monitor se conservan. La exportación de históricos sigue disponible en el detalle.

## Comportamiento comprobado

| Opción | Criterio |
| --- | --- |
| Buscar | Espera de 300 ms y consulta con los filtros aplicados |
| Tipo y estado | Combinación en servidor y selección conservada en la URL |
| Etiqueta | Permanece accesible al dejar una búsqueda sin coincidencias |
| Limpiar búsqueda | Retira el texto y conserva tipo, estado y etiqueta |
| Limpiar filtros | Retira texto, etiqueta, tipo y estado; limpia ambos parámetros de URL en una sola actualización |
| Paginación | 25 por página; cambiar filtros regresa a la primera página |
| Lista/cuadrícula | Conserva la preferencia existente |
| Actualización automática | Consulta datos guardados según el plan; conserva filtros, selección y ficha abierta |
| Permisos | Viewer conserva lectura y navegación; las mutaciones siguen protegidas |

Las pruebas utilizan autenticación del entorno aislado y respuestas controladas del directorio. No se modifican monitores existentes ni se cambian contratos o permisos.

## Evidencia local

- Suite Django completa en base aislada: **399 aprobadas**.
- Regresiones Chromium locales: **15 aprobadas**, incluyendo filtros combinados con 31 monitores, espera de búsqueda, selección y controles compactos, lectura Viewer, reloj de consulta, recuperación de plan y conservación del contexto de la ficha.
- TypeScript/build, ESLint y formato de los archivos de esta entrega: aprobados.
- Capturas: [1440×900](assets/monitoring-toolbar-20261112/monitoring-1440.png), [1366×768](assets/monitoring-toolbar-20261112/monitoring-1366.png) y [390×844](assets/monitoring-toolbar-20261112/monitoring-390.png).
- El frontend habitual en `localhost:3001` sirve el componente actualizado desde el código montado.

Pruebas: `frontend/e2e/critical-flows.spec.ts`. Registros: `.tmp/monitoring-toolbar-django.log`, `.tmp/monitoring-toolbar-chromium-acceptance.log`, `.tmp/monitoring-toolbar-build-acceptance.log` y `.tmp/monitoring-toolbar-lint-acceptance.log`.

Son resultados locales. CI remoto y despliegue son pasos separados.
