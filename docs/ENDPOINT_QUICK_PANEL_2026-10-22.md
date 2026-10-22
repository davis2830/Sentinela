# Panel rápido de endpoint — 2026-10-22

## Resultado

El panel lateral se convierte en una consulta rápida con una sola vista:

1. Nombre, URL, último estado medido, protocolo, frecuencia y fecha de última medición.
2. Comprobar ahora, apertura de ficha completa y menú Más con exportación, alertas y edición según permisos.
3. Disponibilidad de 24 h, latencia actual e interrupciones estimadas del período en una franja compacta.
4. Gráfica de latencia media de 24 h sin controles avanzados duplicados.
5. Último fallo entre las tres comprobaciones recientes cuando existe; aviso específico si el Guardián está desconectado.
6. Tres comprobaciones recientes y enlaces a Disponibilidad y Configuración.

Los detalles completos, calendario, percentiles y bitácora permanecen en la ficha HTTP/HTTPS. Los protocolos sin ficha completa conservan detalles básicos desplegables y edición operativa. Se conservan cooldown, permisos, aislamiento de caché por organización, cierre por Escape y manejo de foco. Ninguna consulta del panel ejecuta un escaneo.

El conteo de interrupciones es histórico y estimado, no el número de incidentes activos. La última medición y los agregados de 24 h conservan etiquetas distintas. Sin muestras o con fallo de consulta, las cifras históricas se muestran como guiones.

## Verificación local

- Django completo: 244/244 en 87.564 s.
- Chromium: 13/13 casos, incluyendo navegación con filtros, permisos, gráfica sin datos, plan Free y regresiones de ficha completa.
- Dos casos nuevos verifican escritorio 1366×768, tres comprobaciones y gráfica dentro del alto inicial; móvil 390×844, menú secundario, ausencia de desbordamiento y cierre por Escape.
- Revisión de capturas: se corrigió el menú Más que salía por el borde izquierdo en móvil y se añadió una aserción para sus límites.
- Capturas locales: frontend/test-results/endpoint-quick-desktop.png y frontend/test-results/endpoint-quick-mobile.png.
- Evidencia local; CI pendiente. No se ha desplegado ni publicado el cambio.

Cierre de verificación: build final correcto; repetición de los dos casos nuevos tras el ajuste visual, 2/2. Captura móvil final revisada con el menú completamente dentro del viewport. Fixture quickpanel-20261022 eliminada mediante el comando de limpieza con verificación de aislamiento; auditoría conservada. git diff --check correcto.
