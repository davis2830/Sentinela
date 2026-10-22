# Dashboard: alcances y jerarquía — 2026-10-22

## Implementación

- Indicadores: Recursos saludables ahora (fracción principal y porcentaje secundario); Disponibilidad con período; Tiempo medio con período; Pendientes de atención. Cada uno identifica si abarca todos los módulos ahora o únicamente Monitoring histórico.
- Se conserva el promedio real de intentos con tiempo registrado, incluidas respuestas HTTP fallidas. Se explica el alcance y se usa una curva neutra; no se cambió la fórmula ni se inventó un límite de latencia.
- CheckOutcomes presenta cantidades por estado y total propio del período, separado de los indicadores de velocidad. Valida conteos enteros no negativos y consistencia con total_checks. Ausencia de desglose no se interpreta como cero.
- La curva de disponibilidad usa gradiente por valor del eje fijo 0–100 y puntos evaluados con uptimeTone: verde >=99,9; amarillo >=99; rojo por debajo. No se crean muestras, no se interpolan huecos y se mantiene el eje 0–100.
- Donut horizontal compacto, filtros accesibles y total principal; porcentaje secundario. Se quitan los porcentajes redondeados repetidos de cada botón para evitar sumas aparentes mayores a 100%.
- Prioridad actual junto al donut: dos elementos prioritarios de todos los módulos, sin filtros, que abren el detalle existente. Ver bandeja y el indicador de pendientes llevan a la bandeja completa restableciendo filtros; se respeta movimiento reducido.
- Se conservan tipografía, iconos, permisos, filtros de módulos, acciones y tooltips sincronizados. Sin cambios backend ni de datos históricos.

## Verificación prevista

Se ejecutan build, Django completo y los casos locales de dashboard. Caso nuevo con disponibilidad 100/99,5/30,91 para verificar los tres colores; latencia neutra, total 10.000 con cantidades separadas, navegación de prioridades y ancho móvil 390×844. Se actualiza la prueba previa de cumplimiento para buscar el desglose en su nueva sección. Los selectores de filas de la bandeja se acotan ante su repetición intencional en la vista previa.

Evidencia local; CI pendiente.

## Resultado local

- Django completo: **258/258**, 123.555 s.
- Build frontend final correcto.
- Chromium: **20 casos únicos aprobados** entre ejecución inicial y repeticiones. Primera ronda: 18/20; se compactaron metadatos y lateral para cumplir el alto inicial con avisos. El caso previo del filtro API buscaba una alerta del feed general; ahora comprueba explícitamente la bandeja filtrada y su estado vacío, sin cambiar la lógica de filtros. Repetición de los cuatro casos afectados: 4/4.
- Caso nuevo de alcances y colores repetido con movimiento reducido; se conserva el scroll al abrir la bandeja. Las capturas iniciales se toman desplazando el contenedor de la app mediante su encabezado, no window (que no es su scroll principal).
- Evidencia: frontend/test-results/dashboard-scopes-desktop.png, dashboard-scopes-mobile.png y dashboard-compact-desktop.png. Se verifican escritorio 1440×900, avisos de cuenta y móvil 390×844 sin desbordamiento horizontal del documento.
- El total de recursos incluye elementos de distintos módulos; no es un conteo de hosts únicos. Los pendientes son elementos operativos agrupados y no equivalen a endpoints caídos.
- CI pendiente. No se cambiaron fórmulas backend ni históricos.

Capturas finales de inicio revisadas; la repetición final del caso de alcances pasó (1/1). Se retiraron las fixtures dashboard-scopes-20261022 y dashboard-capture-20261022 mediante el comando con verificación de aislamiento; auditoría conservada. git diff --check correcto.
