# Benchmarks k6 de Sentinel

Los resultados existentes son ejecuciones históricas y no deben combinarse ni presentarse como certificación actual.

Higiene del 2026-11-01: el baseline JSON histórico conserva sus estadísticas pero elimina `setup_data` de autenticación. Los HTML generados antiguos se retiraron del seguimiento, con copia local; los escenarios y el generador permanecen. El escenario local exporta `beta-read-baseline-local.json` saneado, ignorado por Git. **No usar `--summary-export` en pruebas autenticadas:** puede incluir el JWT retornado por `setup()`. Publicar evidencia solo después de sanearla y ejecutar el guard del repositorio. Esto no elimina tokens ni backups de commits anteriores.

| Fecha | Contexto histórico | Promedio | p95 | Errores |
| --- | --- | ---: | ---: | ---: |
| 2026-09-28 | Optimización N+1 | 22.36 ms | 38.81 ms | 0% reportado |
| 2026-09-30 | Stress NOC, 40 VUs, 2,017 solicitudes/70s | 29.22 ms | 48.84 ms | 0% reportado |
| fecha no verificable en el registro anterior | ejecución documentada sin metadatos completos | 37.69 ms | 55.88 ms | no verificable |

## Benchmark oficial

Baseline local de lectura del 2026-10-07: 529 solicitudes, 0 errores, p95 28,79 ms y máximo 5 VUs. **No es el benchmark oficial de capacidad global**: usa diez targets deshabilitados, fixtures compartidos y cambios no comprometidos. Véanse [escenario](scenarios/06_beta_read_baseline.js), [salida](reports/beta-read-baseline-20261007.json) y [hardware, dataset y límites](../docs/BETA_VALIDATION_FOLLOWUP.md#baseline-de-capacidad-no-benchmark-oficial).

No hay benchmark oficial vigente después del hardening del 2026-10-03.

Baseline posterior **2026-11-04**, lectura de 18 endpoints con dataset aislado:
2.269 solicitudes, cero errores, hasta 5 VUs, p95 global 59,42 ms. Todos los p95
por módulo quedaron bajo 500 ms. Escenario `07_module_read_audit.js`, preparación
`seed_audit_dataset.py` y salida local saneada `reports/module-audit-local.json`.
El reporte no se versiona y no contiene `setup_data` de autenticación. Esta prueba
no mide saturación, sondeos reales ni capacidad máxima; conserva su alcance local.
Véase [auditoría actual](../docs/AUDIT_HARDENING_2026-11-04.md).

Para designar un benchmark oficial se debe conservar:

- commit SHA e imagen;
- archivo de escenario k6;
- dataset/fixtures;
- hardware y topología;
- fecha, duración y VUs;
- salida completa y criterios de aceptación.

Los escenarios están en [scenarios](scenarios). La próxima ejecución reproducible, aprobada en un entorno controlado, sustituirá este estado.
