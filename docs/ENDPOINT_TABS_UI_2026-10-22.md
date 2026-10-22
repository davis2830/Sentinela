# Pestañas de la ficha — UI del 2026-10-22

## Contexto

Después de compactar el resumen y mostrar juntos gráfica/vínculos, el usuario solicitó destacar la información importante de SSL/TLS y aplicar ese criterio a las demás pestañas. La referencia vigente es [UI_STANDARD.md v1.2](UI_STANDARD.md). Se conservan las fuentes, iconos Lucide, paleta y tokens existentes.

## Implementación

- **SSL/TLS:** vigencia, validez, versión y evaluación en una franja. Emisor legible, hostname y fechas locales visibles. Huella, SAN, algoritmo y todos los campos originales en **Detalles técnicos**.
- **DNS:** tipo, latencia, TTL y cambio; valor registrado e historial reciente. Varios registros usan un selector que actualiza también historial y enlace al módulo; no generan una columna de paneles repetidos.
- **Dominio:** vencimiento y protección de transferencia destacados; registrador y servidores de nombres visibles; datos WHOIS completos desplegables.
- **Seguridad:** score, evaluación, controles básicos y fuga. Cabeceras ausentes resaltadas; análisis completo de cabeceras/directivas/fugas desplegable. Los controles básicos se limitan explícitamente a HSTS/CSP/Frames.
- **Actividad:** indicadores de actividad vinculada y tres columnas de incidentes, alertas y cambios; tres elementos iniciales por grupo con expansión. Las alertas de incidentes visibles conservan su deduplicación.
- **Configuración:** asociaciones en dos columnas en escritorio y una en móvil, con encabezado breve y la confirmación explícita existente.
- **Disponibilidad y Resumen:** conservan la franja, gráfica, período y detalle histórico de la iteración anterior.

Las evaluaciones sin fecha válida o con error no presentan métricas saludables; sus indicadores permanecen desconocidos. El tipo DNS es configuración; TTL y respuesta son mediciones. Los campos técnicos originales se conservan incluso cuando una presentación abreviada ocupa su lugar inicial.

## Piezas reutilizables

- `components/monitoring/EndpointResourcePanel.tsx`: selección de recurso, acciones, métricas, contenido operativo y detalle técnico.
- `utils/resourcePresentation.ts`: números, fechas, emisor abreviado y métricas explícitas por módulo.
- `components/monitoring/EndpointActivityPanel.tsx`: actividad vinculada y navegación individual.
- `MetricCard`: variante de valor textual y modo compacto existente. Nuevos estilos acotados en `index.css`.
- `ResourceHistory` de la página: cambios DNS compactos y hallazgos de cabeceras con análisis desplegable.

No hay cambios de modelos, endpoints ni recursos reales. Abrir, recargar o elegir un registro conserva la lectura GET; las acciones de sondeo mantienen admisión, 202, espera de una fecha nueva y cooldown. Viewer conserva navegación de solo lectura.

## Verificación local

- Django completo: **244/244**, 126,446 s; base de prueba creada y destruida.
- Regresión inicial de ficha: **9/9**. Ejecución final: **17/17**, 1,6 min, sin reintentos locales; ocho casos nuevos de pestañas.
- TypeScript/build: aprobados, incluida compilación final.
- Escenarios nuevos: primer viewport 1366×768, escritorio 1440×900 y móvil 390×844; detalle técnico desplegable; ausencia de datos/errores; selector DNS y enlace coherente; Actividad/Configuración sin escrituras al entrar.
- Capturas con datos controlados en `frontend/test-results/resource-tab-*-desktop.png` y `resource-tab-*-mobile.png`, fuera de Git y del contexto Docker.

Las cuentas temporales pertenecen exclusivamente a `tabs-20261022`; no se usaron usuarios reales. CI pendiente; esta evidencia no declara producción lista ni reemplaza una ejecución remota de Playwright.

Antes de la limpieza se verificaron dos usuarios, cero targets habilitados y cero checks. La fixture se retiró mediante el comando protegido, conservando auditoría.

Una ejecución intermedia aprobó 16/17: el selector de la prueba DNS encontraba tanto el valor principal como el campo técnico oculto. Se delimitó la aserción al contenido operativo, manteniendo la comprobación del historial y destino del registro seleccionado. La repetición completa dirigida pasó 17/17.
