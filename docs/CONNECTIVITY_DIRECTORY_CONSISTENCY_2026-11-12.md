# Conectividad: controles y directorios coherentes

Revisión local del 12 de noviembre de 2026. Incluye Uptime & Latencia, SSL, DNS, Dominios, API Endpoints y Security Headers.

## Causa

La unificación de colores había conservado implementaciones independientes de casillas, botones y barras. Uptime tenía una marca de selección propia, mientras otros módulos usaban iconos `Square`/`CheckSquare`. Las acciones por icono tampoco fijaban una superficie visual común. El pie paginado se renderizaba incluso cuando sólo había una página.

## Cambios

| Elemento | Resultado |
| --- | --- |
| Paginación | Oculta con 0–25 resultados. Desde 26: rango visible, Anterior, página actual/total y Siguiente agrupados. En páginas posteriores la navegación permanece disponible aunque haya menos de 25 filas |
| Selección | `SelectionCheckbox` compartido: marca de 20×20 px y objetivo transparente de 44×44 px, en cabecera, filas, tarjetas y móvil |
| Acciones | Menú compartido con nombres completos, iconos, permisos originales y eliminación diferenciada. El interruptor de Uptime permanece visible |
| Desplazamiento | Columna de acciones fija a la derecha. El menú sale del contenedor desplazable y se mantiene alineado al botón |
| Teclado | Flechas, Inicio/Fin y Escape en menús; devolución del foco. Un menú con todas las acciones deshabilitadas también puede cerrarse con Escape |
| Formularios | DNS, Dominios, API y Security Headers reutilizan `ModalSurface`, igual que Uptime y SSL. Confirmaciones de eliminación con foco y Escape |
| Filtros | Una barra compartida: búsqueda, tipo/método cuando corresponde, estados y presentación. Los estados usan un selector en móvil. Conteos del servidor con alcance accesible y sin inventar totales |
| Cabecera | Se retiran las franjas duplicadas y la edad/actualización manual de consulta. La consulta automática y los reintentos ante errores conservan su comportamiento |
| Exportación | Los cinco módulos con exportación de inventario la ofrecen bajo **Más opciones del directorio** |
| Security Headers | Se retiran el generador de fragmentos, sus plantillas y estado. La auditoría, hallazgos, cabeceras registradas e historial conservan sus funciones |
| DNS | Se retira la consulta de estadísticas que sólo alimentaba la franja eliminada |

La variante `inline` de `NOCToolbar` limita el cambio visual a Conectividad. Los otros consumidores mantienen su presentación. El cambio de `DirectoryPagination` también evita el pie innecesario del directorio Senti9; su panel de instalación permanece intacto.

## Evidencia local

- Suite Django completa en base aislada: **399 aprobadas**.
- **53 escenarios Chromium distintos aprobados**: 39 regresiones existentes, 11 comprobaciones específicas de controles/paginación y 3 recorridos con API real aislada.
- Las comprobaciones específicas incluyen listas de 4, 25, 26 y 51 monitores; selección al cambiar de página; 1440×900, 1366×768 y 390×844; menús, editar/cancelar, confirmaciones, foco y ausencia de escrituras al recorrer la interfaz.
- Las regresiones conservan colores de salud, consulta según el plan, filtros, selección y ficha abierta, permisos Viewer y la presentación de otros módulos del portal.
- TypeScript/build, ESLint y formato de los archivos de esta entrega: aprobados.
- El frontend habitual de `localhost:3001` sirve los componentes actualizados desde el código montado.

Los recorridos específicos usan autenticación aislada y respuestas controladas. Los tres recorridos con API real son de lectura sobre las organizaciones de fixture; no modifican recursos de clientes. No hay cambios de contratos, migraciones o permisos en esta entrega.

Registros: `.tmp/connectivity-unified-django.log`, `.tmp/connectivity-unified-regressions.log`, `.tmp/connectivity-unified-visual-acceptance.log`, `.tmp/connectivity-unified-empty-menu.log`, `.tmp/connectivity-unified-build-delivery.log` y `.tmp/connectivity-unified-lint-delivery.log`. CI remoto y despliegue quedan separados de esta evidencia local.

## Capturas

| Módulo | Escritorio | Móvil |
| --- | --- | --- |
| Uptime | [1440](assets/connectivity-consistency-20261112/monitoring-1440.png) · [1366](assets/connectivity-consistency-20261112/monitoring-1366.png) · [Acciones](assets/connectivity-consistency-20261112/monitoring-actions.png) | [390](assets/connectivity-consistency-20261112/monitoring-390.png) |
| SSL | [1440](assets/connectivity-consistency-20261112/ssl-1440.png) · [1366](assets/connectivity-consistency-20261112/ssl-1366.png) | [390](assets/connectivity-consistency-20261112/ssl-390.png) |
| DNS | [1440](assets/connectivity-consistency-20261112/dns-1440.png) · [1366](assets/connectivity-consistency-20261112/dns-1366.png) | [390](assets/connectivity-consistency-20261112/dns-390.png) |
| Dominios | [1440](assets/connectivity-consistency-20261112/domains-1440.png) · [1366](assets/connectivity-consistency-20261112/domains-1366.png) | [390](assets/connectivity-consistency-20261112/domains-390.png) |
| API | [1440](assets/connectivity-consistency-20261112/api-checks-1440.png) · [1366](assets/connectivity-consistency-20261112/api-checks-1366.png) | [390](assets/connectivity-consistency-20261112/api-checks-390.png) |
| Security Headers | [1440](assets/connectivity-consistency-20261112/security-headers-1440.png) · [1366](assets/connectivity-consistency-20261112/security-headers-1366.png) | [390](assets/connectivity-consistency-20261112/security-headers-390.png) |

[Paginación con 26 registros](assets/connectivity-consistency-20261112/pagination-26.png). Los recorridos con API aislada se capturan por separado en `docs/assets/connectivity-consistency-real-20261112/`.
