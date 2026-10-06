# Benchmarks k6 de Sentinel

Los resultados existentes son ejecuciones históricas y no deben combinarse ni presentarse como certificación actual.

| Fecha | Contexto histórico | Promedio | p95 | Errores |
| --- | --- | ---: | ---: | ---: |
| 2026-09-28 | Optimización N+1 | 22.36 ms | 38.81 ms | 0% reportado |
| 2026-09-30 | Stress NOC, 40 VUs, 2,017 solicitudes/70s | 29.22 ms | 48.84 ms | 0% reportado |
| fecha no verificable en el registro anterior | ejecución documentada sin metadatos completos | 37.69 ms | 55.88 ms | no verificable |

## Benchmark oficial

No hay benchmark oficial vigente después del hardening del 2026-10-03. Para designar uno se debe conservar:

- commit SHA e imagen;
- archivo de escenario k6;
- dataset/fixtures;
- hardware y topología;
- fecha, duración y VUs;
- salida completa y criterios de aceptación.

Los escenarios están en [scenarios](scenarios). La próxima ejecución reproducible, aprobada en un entorno controlado, sustituirá este estado.
