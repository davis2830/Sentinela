# Conectividad: coherencia de colores operativos

Revisión local del 12 de noviembre de 2026. Referencia visual: Uptime & Latencia.

## Causa y alcance

Uptime usa los colores de salud del tema: verde `#4ade80`, ámbar `#fbbf24` y rojo `#ff7384`. `StatusBadge`, `GradeBadge` y varios indicadores locales de SSL, Dominios, API y DNS seguían usando `accent-green`, el turquesa de marca. Había además cabeceras de tabla con el mismo fondo que las filas y reglas de color duplicadas para la vigencia.

Se centralizan las clases operativas en `frontend/src/utils/healthPresentation.ts`. Los controles de navegación, selección y creación conservan el turquesa de marca; los resultados medidos usan la paleta de salud. Se conserva el tamaño de los controles corregidos anteriormente.

## Hallazgos corregidos

| Área | Cambio |
| --- | --- |
| Badges compartidos | Válido, Pass, Online, Activo y Resuelto usan verde de salud; fallos rojo; advertencias ámbar; estados desconocidos neutros |
| SSL | Misma presentación en tabla, tarjetas, ficha y resultado de prueba; barra y texto comparten el criterio visual de 30 días de advertencia y 7 críticos |
| SSL sin evidencia | Se elimina el grado A de respaldo. No se colorean como saludables una calificación o vigencia sin medición válida; un fallo actual conserva valores anteriores en neutro |
| Dominios | Bloqueo EPP desconocido se presenta como desconocido; colores de bloqueo y vigencia consistentes en tabla, tarjetas y ficha |
| DNS | Latencia sin cian; el valor 0 ms medido se conserva. Sin medición tiene presentación neutral y no afirma NXDOMAIN |
| API Endpoints | Estado y latencia comparten colores operativos en tabla/tarjetas; las validaciones de resultados usan verde/rojo. La configuración esperada permanece separada del resultado |
| Security Headers | Calificación, puntuación y latencia coherentes; una fuga evita una calificación visual saludable, y las protecciones sin medición no aparecen verdes |
| Superficies | Las cinco cabeceras de tabla adoptan el fondo oscuro ya utilizado por Uptime |

Estos son criterios de presentación. No cambian umbrales de reglas de alerta, frecuencia de comprobación, precios, permisos, contratos ni servicios de ejecución.

## Verificación

- Django completo en base aislada: **399 pruebas aprobadas**.
- Chromium: **5 recorridos específicos de paleta aprobados**, con estados saludables, advertencias, críticos, desconocidos e inválidos; incluye SSL en cuadrícula/móvil y su prueba de configuración simulada.
- Regresiones Chromium existentes: **22 aprobadas**, cubriendo paleta de Uptime, datos sin medición, fichas técnicas, permisos Viewer, selección/interruptores compactos y módulos móviles. Son 27 escenarios distintos.
- TypeScript/build, ESLint y tipos OpenAPI vigentes: aprobados. Los nuevos archivos y los modificados se formatearon.
- No se guardaron recursos ni se ejecutaron comprobaciones sobre servicios de clientes. Las lecturas controladas y la prueba de configuración de SSL se simularon en el navegador con una cuenta aislada.

Los colores se verifican sobre CSS calculado en el navegador, usando los valores efectivos del tema. Los recorridos y capturas usan fixtures con recuentos y fechas consistentes, no datos de producción.

## Capturas

- [SSL: tabla](assets/connectivity-health-20261112/ssl-table.png), [cuadrícula](assets/connectivity-health-20261112/ssl-grid.png), [móvil](assets/connectivity-health-20261112/ssl-mobile.png) y [prueba de configuración](assets/connectivity-health-20261112/ssl-preview-mobile.png).
- [Dominios](assets/connectivity-health-20261112/domains-table.png).
- [DNS](assets/connectivity-health-20261112/dns-table.png).
- [API Endpoints](assets/connectivity-health-20261112/api-checks-table.png).
- [Security Headers](assets/connectivity-health-20261112/security-headers-table.png).

Pruebas: `frontend/e2e/connectivity-health-palette.spec.ts` y selección documentada en `.tmp/connectivity-health-portal-regression.log`. Registros de esta revisión: `.tmp/connectivity-health-*`. CI remoto y despliegue quedan separados de estos resultados locales.
