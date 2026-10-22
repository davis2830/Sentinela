# Paleta de mediciones — 2026-10-22

## Hallazgo

La revisión confirmó una implementación parcial: el estándar v1.2 permitía cian para información y componentes recientes heredaban ese tono para latencia. El token --monitoring-latency y el dashboard también utilizaban #38d9f5. El listado usaba cortes visuales fijos de 400/1000 ms diferentes al criterio del endpoint.

## Corrección

- Mediciones evaluadas: verde, amarillo y rojo. Sin datos o sin criterio: neutro.
- Curva media de latencia verde, picos amarillos, fallos rojos; tooltip según el estado del intervalo y el umbral configurado. Se preservan huecos y valores ausentes.
- Una función compartida latencyTone se utiliza en ficha, panel, cards y tabla del listado. Fallo medido rojo, degradado amarillo, dentro del umbral verde. Sin umbral ni estado válido, neutro. No se inventa un umbral crítico.
- Últimas comprobaciones colorean la latencia según su estado; valores ausentes permanecen neutros.
- Dashboard: eliminados cian de latencia y violeta de volumen; volumen neutro, porque su cantidad no determina salud. La disponibilidad agregada utiliza los tonos semánticos del estándar. Se conserva la referencia visible de 500 ms del dashboard como criterio agregado, no como umbral de cada target.
- TTL, país, tipo de registro, versión y conteos descriptivos quedan neutros cuando no existe una evaluación.
- info en indicadores se representa neutro para evitar reintroducir cian. Enlaces y acciones conservan la identidad visual existente.
- Estándar actualizado en UI_STANDARD.md. El cambio no modifica el estado calculado por el backend ni los datos históricos.

## Verificación

- Django completo: 244/244, 79.320 segundos.
- Nueva prueba visual funcional: estados medidos operacional, lento, error y ausencia de latencia; comprueba los colores calculados reales del indicador y el token de la curva, no solo el texto.
- Pruebas locales; CI pendiente.

Primera ejecución Chromium: diez regresiones aprobadas y un caso nuevo fallido porque su fixture tenía una sola muestra, que Recharts no convierte en una curva. Se corrigió el fixture a dos muestras reales para verificar el color de la curva. El cambio no añade puntos sintéticos a la aplicación.

Cierre: build frontend final correcto; diez regresiones Chromium y el nuevo caso de paleta aprobados (repetición final de paleta y tooltip: 2/2). Revisada captura local endpoint-quick-desktop.png con latencia fallida roja y comprobaciones operacionales verdes. CI pendiente.
