# Senti9: cabecera y directorio compactos

Revisión local del 11 de noviembre de 2026. Cambios limitados a la cabecera de Senti9 y su columna izquierda. El panel **Instala. Conecta. Monitorea.** conserva contenido, dimensiones, estilos y tipografía en las tres resoluciones revisadas.

## Composición final

- **Cabecera:** Registrar Senti9 es el único botón sólido. La guía pasa a utilidad sin borde; consulta automática, antigüedad y refresco forman un grupo compacto. El indicador conserva el control de pausa/reanudación con teclado y nombre accesible. La fecha procede de la última respuesta del directorio, y el error, la carga y la ausencia de consulta permanecen explícitos.
- **Toolbar:** búsqueda limitada a 448 px y filtro de estado dentro de una sola superficie elevada. Cuota real en una píldora con mini barra para límites finitos; los planes ilimitados conservan esa distinción y no reciben un porcentaje inventado.
- **Identidad:** borde izquierdo y gradiente de estado; nombre destacado y chip copiable. El identificador de equipo procede del hostname reportado —por ejemplo, el ID de contenedor— y se distingue del UUID del agente. Si no existe, se utiliza el UUID. La copia no realiza peticiones ni persiste el valor.
- **Métricas:** una sola tira con divisores, microiconos y cifras monoespaciadas. La fecha y hora se mantienen juntas en hora local y formato de 24 horas. En móvil la última señal ocupa la segunda fila para conservar legibilidad.
- **Footer:** mensaje a la izquierda con CheckCircle2 sólo para una conexión vigente; acciones a la derecha. Crear monitor tiene énfasis emerald, Ver detalle fondo secundario, e Instalar/Ver monitores son utilidades ghost.

La extracción de `Senti9AgentCard`, `Senti9Quota` y `Senti9RefreshStatus` evita mezclar estado del portapapeles y presentación con las consultas y administración del drawer. No cambian sus contratos, permisos, cuotas, navegación ni páginas de 25. El refresco manual consulta el mismo filtro y no ejecuta monitores.

## Comparación visual

| Resolución | Antes | Después |
| --- | --- | --- |
| 1440×900 | [Pantalla](assets/senti9-composition-20261111/before-page-1440.png) | [Pantalla](assets/senti9-composition-20261111/after-page-1440.png) · [Tarjeta](assets/senti9-composition-20261111/after-card-1440.png) |
| 1366×768 | [Pantalla](assets/senti9-composition-20261111/before-page-1366.png) | [Pantalla](assets/senti9-composition-20261111/after-page-1366.png) · [Tarjeta](assets/senti9-composition-20261111/after-card-1366.png) |
| 390×844 | [Pantalla](assets/senti9-composition-20261111/before-page-390.png) | [Pantalla](assets/senti9-composition-20261111/after-page-390.png) · [Tarjeta](assets/senti9-composition-20261111/after-card-390.png) |

Capturas con un fixture visual idéntico sobre lecturas de API aislada: un agente conectado, un monitor, cuota de uno sobre uno e identificador de equipo de ejemplo. No acreditan datos ni mediciones de clientes reales.

El recorrido compara el `outerHTML`, ancho, alto, padding, fondo, separación, radio y tipografía de títulos del panel derecho con sus valores anteriores. Todas las comparaciones coinciden. Sus coordenadas verticales pueden seguir la nueva altura de la cabecera; su composición no se altera. Los JSON `before-right-panel-*` y `after-right-panel-*` conservan estas mediciones junto con sus capturas en el directorio de evidencia.

## Validación local

| Comprobación | Resultado |
| --- | --- |
| Django completo, base aislada | 399 aprobadas |
| Chromium: Senti9, instalación y directorios | 15 aprobadas |
| Pausa, reanudación y refresco manual | Conservan filtros y página; sólo peticiones GET |
| Copia de identificador | Valor exacto; error visible si se deniega el portapapeles |
| Responsive | Sin scroll horizontal a 1440, 1366 y 390 px |
| Fichas e instalación | Accesos conservados, Escape y retorno del foco |
| TypeScript/build, ESLint, formato y tipos OpenAPI | Aprobados |

Evidencia local: `.tmp/senti9-composition-*` y [recorrido visual](assets/senti9-composition-20261111/visual-validation.json). El frontend habitual sirve el código actualizado en `localhost:3001`. Sin migraciones, cambios de dependencias, publicación de imágenes ni cambios a agentes reales. CI remoto y despliegue permanecen separados.
