# Aplicación del estándar UI — 2026-10-21

## Corrección posterior: primera vista operativa — v1.1

El usuario señaló que la distribución inicial de cards ocupaba toda la pantalla y relegaba la gráfica. Esta corrección sustituye ese apilado por una franja de indicadores de 32 px, con gráfica a la izquierda y lista de los cuatro vínculos/avisos a la derecha. Sin cards individuales de métricas ni de cobertura en el resumen. El estado operacional del endpoint permanece junto al nombre; cada vínculo conserva su resultado, estado desconocido o asociación pendiente.

El selector de período está dentro de la gráfica en Resumen y sigue disponible sin mediciones. Los detalles de monitoreo pasan a la fila superior. En móvil, los vínculos aparecen como filas compactas antes del gráfico. El estado activo, los errores parciales, permisos, asociaciones, cooldown y POST 202 conservan sus contratos.

La prueba de primera vista exige que gráfica completa y cuatro vínculos estén dentro del viewport en **1440×900 y 1366×768**, sin hacer scroll. Pasó localmente; también se revisó la captura 390×844. Build aprobado y Django completo **244/244**, 70,314 s. Repetición dirigida de ficha/drawer: **11/11**, 41,4 s, sin reintentos. CI pendiente.

La comprobación final del selector con período vacío pasó **1/1** en 5,3 s y se repitió el build después de ese ajuste. Fixture `overview-20261021`: dos usuarios, cero targets habilitados y cero checks; retirada mediante el comando protegido, conservando auditoría.

Las secciones siguientes conservan el contexto y la evidencia de la primera iteración visual; la distribución vigente es la descrita arriba y en [UI_STANDARD.md](UI_STANDARD.md).

## Contexto y alcance

El usuario pidió destacar la información importante, reducir texto y mejorar botones/cards de la ficha HTTP/HTTPS, manteniendo los iconos, la tipografía y la identidad de Sentinel. Se aplicó el [estándar UI/UX v1](UI_STANDARD.md) en `/monitoring/:targetId` y en su gráfica compartida con el drawer de Monitoring.

Los cambios de auditoría y seguridad anteriores permanecen en el árbol de trabajo. Esta revisión documenta la presentación y sus contratos de lectura/acción; no publica ni despliega una versión.

## Cambios implementados

- Encabezado con nombre prominente, URL y último estado medido. Acción primaria **Comprobar ahora**; controles **Auto** y recarga compactos. Fecha exacta, ejecutor y frecuencia efectiva en **Detalles del monitoreo**.
- Cuatro indicadores grandes: disponibilidad y latencia del período, última evaluación de seguridad vinculada e incidentes activos de la actividad vinculada. Período y alcance explícitos para distinguir el histórico del último estado.
- Métricas de disponibilidad/seguridad bajas con color semántico; ausencia de mediciones representada por `—`, sin salud supuesta.
- Atención con enlaces directos a incidentes/alertas y acceso al módulo correspondiente. Prioridad crítica primero; tres elementos iniciales y expansión para el resto. Conserva deduplicación por asociaciones estructuradas.
- Cards de SSL, DNS, dominio y seguridad con icono, resultado o estado real y acción: **Ver detalle**, **Vincular**, **Configurar** o **Ver cobertura** según el caso y el rol.
- Pestañas con scroll contenido en móvil, conservando `tab`, `returnTo` y permisos existentes.
- Gráfica **Latencia**, controles **Media / Picos / Ambas**, percentiles y máximo bajo **Detalles de latencia**. Ya no muestra un reclamo fijo de actualización cada 30 s.
- Huecos de medición como `null`, sin interpolar a través de ellos ni fabricar ceros/máximos. El umbral procede del target; si no está disponible no se inventa.

## Piezas reutilizables

| Pieza | Responsabilidad |
| --- | --- |
| `components/common/MetricCard.tsx` | Indicador con valor prominente, unidad, alcance e icono |
| `index.css`: `.ui-card`, `.ui-button*`, `.ui-status`, `.ui-coverage` | Superficies, botones, foco/estados y jerarquía comunes |
| `utils/endpointPresentation.ts` | Números, fecha válida de medición y estados de cobertura |
| `AutomaticRefreshControl`, `ReloadDataButton` | Modo compacto opcional; conserva comportamiento existente fuera de la ficha |
| `ScanAction` | Énfasis primario opcional; conserva admisión, permisos y cooldown |
| `monitoring/LatencyChart` | Presentación compartida de mediciones reales y estadísticas desplegables |

No se añadieron fuentes, icon packs ni dependencias. La documentación raíz y `AGENTS.md` enlazan el estándar para dar contexto a futuras implementaciones.

## Evidencia local

- **Django completo: 244/244**, 75,609 s; base de pruebas creada y destruida. No hubo cambios backend en esta ronda.
- **TypeScript y build Vite:** aprobados, incluida repetición final después de los ajustes visuales.
- **Ficha y escenarios UI:** primera ejecución **9/9** en 41,8 s. Repetición final ampliada: **19/19**, 1,8 min, sin reintentos locales; incluye drawer y controles compartidos.
- Después del ajuste final del botón móvil, **3/3** casos repetidos en 31,5 s: sin solapamiento entre acciones ni recorte de texto, cooldown y comprobación 202. Son casos de la selección anterior, no tres casos únicos adicionales.
- Tres regresiones nuevas comprueban estado actual operacional con histórico 92,11 %, seguridad 10/100, cifras grandes, acciones sin escrituras implícitas, cobertura no medida, huecos y ausencia de máximo inventado.
- Las fixtures de telemetría están aisladas y las cuentas de prueba se crean mediante el comando protegido. Las capturas muestran datos de prueba, no mediciones productivas.
- Revisión visual: **1440×900** y **390×844**. Sin overflow del documento; pestañas con desplazamiento propio. Se conserva la comprobación de cooldown, GET-only, POST 202 y Viewer.

Capturas locales: `frontend/test-results/ui-standard-endpoint-desktop.png`, `ui-standard-endpoint-mobile.png` y `ui-standard-latency.png`. Artefactos fuera de Git/contexto Docker.

La organización `ui-standard-20261021` tuvo dos usuarios, cero targets habilitados y cero checks. Se retiró con el comando protegido de fixtures, preservando auditoría y sin alterar cuentas reales.

La suite completa de Chromium anterior (178/178) corresponde a la ronda de auditoría previa. No se atribuye ese resultado a esta nueva presentación. La evidencia de esta ronda es la ejecución dirigida indicada arriba; CI sigue pendiente y no se declara producción lista.

## Continuidad

Aplicar este patrón al migrar otros módulos: conservar su contrato de datos, identificar cuatro métricas útiles como máximo, poner las acciones junto al resultado y guardar el detalle técnico bajo demanda. Seguir el estándar enlazado y registrar el alcance verificado de cada migración.
