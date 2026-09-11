# 🚀 Suite de Pruebas de Rendimiento, Carga y Estrés (Grafana k6) - Sentinel

Este directorio contiene la suite oficial de pruebas automatizadas de rendimiento y carga de **Sentinel**, construida con **Grafana k6**.

---

## 🏛️ Arquitectura de Escenarios de Rendimiento

| Escenario | Archivo | Propósito | Carga / Concurrencia | SLAs Evaluados |
| :--- | :--- | :--- | :--- | :--- |
| **01. NOC Dashboard** | `scenarios/01_noc_dashboard_stress.js` | Simulación de operadores en el centro de operaciones NOC consultando telemetría, alertas, targets e incidentes. | Rampa progresiva a 40 VUs (1m 10s) | p95 < 300ms, Error < 1% |
| **02. Multi-Módulo Read** | `scenarios/02_full_platform_read_heavy.js` | Consultas intensivas concurrentes a todos los módulos: Uptime, SSL, DNS, WHOIS, Security Headers, API Checks, Alertas e Incidentes. | 15 a 50 VUs sostenidos (1m 35s) | p95 < 400ms, Error < 2% |
| **03. CRUD Transaccional** | `scenarios/03_monitoring_crud_stress.js` | Pruebas de escritura transaccional: pre-flight checks de red, creación de objetivos y limpieza controlada en base de datos. | 5 a 15 VUs escribiendo en BD (1m) | p95 < 800ms, Error < 5% |
| **04. Spike / Ráfagas** | `scenarios/04_spike_stress_test.js` | Ráfaga repentina de 2 a 70 VUs en 10 segundos para verificar la resiliencia y recuperación de Gunicorn y PostgreSQL. | 2 a 70 VUs pico (1m) | p95 < 800ms, Error < 5% |
| **05. Soak / Resistencia** | `scenarios/05_soak_endurance_test.js` | Prueba de resistencia prolongada para verificar que no existan memory leaks o bloqueos en TimescaleDB / Redis a lo largo del tiempo. | 20 VUs sostenidos (4m) | p95 < 350ms, Error < 1% |

---

## ⚙️ Requisitos Previos

- **k6 instalado:** Se encuentra instalado en el sistema (`k6.exe v2.0+` o superior).
- **Contenedores de Sentinel activos:** `sentinel_backend`, `sentinel_db`, `sentinel_redis`.
- **Usuario de pruebas configurado:** `test_perf@sentinel.local` (pre-configurado automáticamente por el sistema).

---

## 🏃‍♂️ Cómo Ejecutar las Pruebas

### Opción A: Mediante PowerShell Runner (`run_perf.ps1`)

```powershell
# 1. Ejecutar el escenario principal del NOC Dashboard:
.\tests_perf\run_perf.ps1 -Scenario noc

# 2. Ejecutar la prueba de lectura pesada multi-módulo:
.\tests_perf\run_perf.ps1 -Scenario read

# 3. Ejecutar prueba transaccional de escritura:
.\tests_perf\run_perf.ps1 -Scenario crud

# 4. Ejecutar prueba de picos / Spike Test:
.\tests_perf\run_perf.ps1 -Scenario spike

# 5. Ejecutar prueba de resistencia / Soak Test:
.\tests_perf\run_perf.ps1 -Scenario soak

# 6. Ejecutar la suite completa de rendimiento:
.\tests_perf\run_perf.ps1 -Scenario all
```

### Opción B: Mediante CMD o Batch Runner (`run_perf.bat`)

```cmd
:: Ejecutar escenario NOC por defecto
tests_perf\run_perf.bat

:: O pasando el escenario deseado:
tests_perf\run_perf.bat read
tests_perf\run_perf.bat crud
tests_perf\run_perf.bat spike
tests_perf\run_perf.bat soak
tests_perf\run_perf.bat all
```

### Opción C: Ejecución Directa con `k6 run`

```powershell
# Ejecución directa con generación de reporte HTML:
k6 run tests_perf/scenarios/01_noc_dashboard_stress.js

# Sobrescribiendo parámetros de entorno sobre la marcha:
k6 run -e BASE_URL=http://[::1]:8000 --vus 20 --duration 1m tests_perf/scenarios/01_noc_dashboard_stress.js
```

---

## 📊 Reportes Visuales en HTML

Cada ejecución de k6 genera un reporte HTML interactivo con la paleta de diseño oficial de Sentinel NOC en la carpeta `tests_perf/reports/`:

- `tests_perf/reports/noc_dashboard_stress_summary.html`
- `tests_perf/reports/full_platform_read_heavy_summary.html`
- `tests_perf/reports/monitoring_crud_stress_summary.html`
- `tests_perf/reports/spike_stress_test_summary.html`
- `tests_perf/reports/soak_endurance_test_summary.html`

El reporte incluye:
- Total de peticiones y Requests/segundo (RPS).
- Latencias p50, p90, p95 y p99 en milisegundos.
- Tasa de éxito de checks funcionales y de negocio.
- Tasa de errores HTTP y evaluación de cumplimiento de SLAs.

---

## 🔧 Variables de Entorno Configurables

| Variable | Valor por Defecto | Descripción |
| :--- | :--- | :--- |
| `BASE_URL` | `http://[::1]:8000` | URL base del backend de Sentinel |
| `PERF_EMAIL` | `test_perf@sentinel.local` | Usuario con permisos para ejecutar sondeos |
| `PERF_PASSWORD` | `SentinelPerf2026!` | Contraseña del usuario de pruebas |
