# Límites y diagnóstico breve de monitoreo — 2026-10-22

## Cambios

- Tabla y cards usan TargetLatency: latencia y límite actual visibles. En down/error se presenta un guion neutro. La latencia original se conserva en la base de datos como tiempo del intento.
- TargetDiagnostic muestra una sola línea derivada de la última comprobación que coincide con last_checked_at. La comparación de fechas tolera Z y +00:00. No toma el fallo de otro registro ni inventa su causa.
- API recent_checks y /checks/ añaden diagnostic y applied_max_latency_ms. El texto breve usa códigos HTTP, código esperado guardado y categorías conocidas de excepción; no expone mensajes arbitrarios, cabeceras ni cuerpos.
- Ejemplos: HTTP 403 · esperado 200; Tiempo de espera agotado; Conexión rechazada; Superó el límite por 77 ms. Si falta evidencia: Comprobación fallida · ver detalle.
- Cloud guarda evaluation_policy dentro de details con max_latency_ms, expected_status y source=cloud_execution, desde el target cargado para ejecutar. Si la configuración cambia durante la petición, conserva los valores originales. No se inventa el límite usado en históricos.
- Sentinine 1.2.0 adjunta la política evaluada y clasifica respuestas satisfactorias como slow cuando superan el presupuesto; conserva down cuando el código falla aunque la respuesta sea rápida. El backend valida los campos opcionales y los identifica como agent_reported. Agentes anteriores siguen admitidos, con límite aplicado desconocido. Los agentes instalados requieren actualizar su archivo/imagen para reportar esta evidencia.
- Panel lateral: latencia actual de fallos como guion, límite actual en la leyenda y tiempo del intento fallido desplegable. Historial completo conserva el intento y muestra el límite aplicado, o No registrado.
- Cuando el límite aplicado difiere del actual, el listado lo muestra explícitamente. Un histórico operacional por encima del límite actual sin política guardada indica Límite aplicado: no registrado.

## Compatibilidad

Sin migración de esquema: se usa details JSON existente. No se reescriben históricos, umbrales personalizados ni reglas de alerta. Las consultas no disparan escaneos y el listado reutiliza su prefetch de comprobaciones para el diagnóstico. Los tiempos de intentos fallidos siguen disponibles para análisis técnico.

## Pruebas

Seis contratos Django nuevos: política de ejecución aunque cambie configuración a mitad de petición; diagnóstico HTTP sin exposición de texto arbitrario; límite desconocido en registros antiguos; categorías y causas desconocidas; validación opcional de política del agente; ingestión del agente y compatibilidad antigua.

Dos pruebas unitarias de Sentinine, ejecutadas con fuente actual en un directorio temporal del runtime Docker: límites 499/500/577 ms y preservación de fallo HTTP rápido. Sin solicitudes de red ni token real.

Caso Chromium nuevo: límite 500 ms, exceso de 77 ms, HTTP 403 esperado 200 con guion, límite aplicado anterior 2.000 ms y tiempo del intento 173 ms disponible en el panel. La prueba de paleta ahora espera neutro en la cifra ausente de un fallo; su estado sigue rojo.

Evidencia local; CI y distribución de agentes fuera de este gate.

## Verificación en curso y ajustes

Primera suite Django: 257 casos aprobados y un error en la prueba nueva de ingestión, que referenciaba MonitoringService en lugar de AgentProbeService. Se corrigió la referencia; no fue un fallo de la implementación de ingestión. Se repite la suite completa.

Chromium: 14/14 en la primera ronda. Revisión de captura: se movió el diagnóstico debajo del nombre/URL para evitar que la columna Estado produjera tres líneas y filas demasiado altas. Se repiten el caso nuevo y los dos casos del panel tras este ajuste visual.

Sentinine reporta versión 1.2.0. Sus dos pruebas de contrato pasaron sin red. Los agentes antiguos siguen funcionando y no se les atribuye una política de evaluación que no reportaron.

El escenario de ingestión se ajustó además para reservar la ejecución mediante process_heartbeat, como exige el contrato real de Sentinine. Sin esa reserva el backend rechazaba correctamente el resultado. Los seis casos nuevos pasaron en ejecución focalizada; no se relajó la admisión de resultados.

Repetición visual final: 3/3 (dos casos de panel y el nuevo caso de límites/diagnóstico); captura revisada con diagnóstico en una sola línea bajo el endpoint. Build final correcto.

Activación local: se comprobó cero tareas activas y se recargó únicamente celery_worker con cierre ordenado de hasta 60 s. El worker respondió al ping después de reiniciar. No se ejecutaron escaneos manuales ni se modificaron configuraciones reales. La distribución de Sentinine 1.2.0 a instalaciones externas sigue siendo independiente de la recarga local.

## Resultado final

- Django completo: **258/258**, 93.926 s.
- Chromium: **14/14**; repetición final del panel y presentación de límites/diagnóstico: **3/3**.
- Sentinine: **2/2** contratos unitarios aislados.
- Build frontend final correcto; git diff --check correcto.
- Captura revisada: frontend/test-results/monitoring-limits-diagnostics.png.
- Fixture diagnostics-20261022 eliminada mediante limpieza con verificación de aislamiento; auditoría conservada.
- Worker local recargado y ping confirmado. CI pendiente; no se publicó ni distribuyó la nueva versión de Sentinine a instalaciones externas.
