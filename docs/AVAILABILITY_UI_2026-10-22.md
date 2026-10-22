# Disponibilidad — UI del 22 de octubre de 2026

## Cambios

- Bitácora compacta y ordenada por inicio descendente, cinco interrupciones iniciales y ampliación explícita.
- Duración destacada; fecha de inicio y fin con día completo; mensaje y HTTP bajo demanda.
- Eliminada la afirmación automática de recuperación: el servicio puede fabricar un fin estimado cuando no encuentra una comprobación posterior satisfactoria. No se modificó el contrato backend.
- Comprobaciones: cinco filas iniciales, ampliación progresiva, filtros locales de estado sobre los últimos 20 registros y diagnóstico HTTP/error desplegable.
- Estados con texto y color; latencia ausente explícita, sin convertirla en cero; fechas inválidas como guion.
- Controles nativos accesibles por teclado y contenido adaptable sin desbordamiento horizontal. Se conserva identidad visual y lógica de consulta/escaneo.

## Evidencia local

- Build frontend: correcto.
- Django completo: 244/244, 108.759 segundos.
- Chromium: nueve regresiones existentes de ficha/resumen/gráfica y los dos casos nuevos pasaron. Primera ejecución: 10/11; el mock nuevo de bitácora usaba route.fetch y recibió HTML de una ruta real. Se corrigió el mock para que sea aislado; repetición de los dos casos nuevos: 2/2.
- Captura revisada: frontend/test-results/availability-checks-mobile.png, 390×844; sin desbordamiento horizontal y diagnóstico HTTP 504 visible.
- Evidencia local; ejecución en CI pendiente. No equivale a validación de producción.

## Alcance

Los filtros de comprobaciones no cambian el período histórico de la gráfica. El fin del intervalo permanece estimado; la interfaz no asegura que una interrupción siga activa ni que se haya recuperado. Las mismas filas de bitácora se reutilizan en el drawer de monitoreo.
