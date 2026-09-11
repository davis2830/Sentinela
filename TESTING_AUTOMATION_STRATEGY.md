# 🛡️ Sentinel (GC_OPS_OBS) - Estrategia Integral de Automatización y Pruebas

Documento maestro de referencia para la arquitectura de pruebas continuas, casos de uso, lógica de negocio y pruebas de rendimiento/estrés del proyecto Sentinel.

---

## 🏛️ Pirámide de Automatización de Sentinel

```
                       ┌──────────────────────────────────────────┐
                       │    3. Casos de Uso E2E (Playwright)      │
                       │   Flujos de usuario real en navegador    │
                       └──────────────────────────────────────────┘
                                            ▲
                       ┌──────────────────────────────────────────┐
                       │ 2. Rendimiento & Carga (Grafana k6)      │
                       │     Estrés de APIs, SLAs y Concurrencia  │
                       └──────────────────────────────────────────┘
                                            ▲
                       ┌──────────────────────────────────────────┐
                       │ 1. Lógica de Negocio & APIs (Pytest DRF) │
                       │    Cuotas de planes, roles y multi-tenant│
                       └──────────────────────────────────────────┘
```

---

## 1️⃣ Nivel 1: Lógica de Negocio y Cuotas de Planes (`pytest` + Django REST Framework)

**Propósito:** Probar las reglas críticas del sistema en milisegundos sin necesidad de abrir un navegador.

### 📌 Casos de Uso Críticos a Cubrir:
1. **Límites y Restricciones por Plan de Suscripción (Billing / Monetización):**
   - **Plan Free:** Máximo 5 targets de monitoreo, frecuencia mínima de sondeo 5 minutos.
   - **Plan Pro:** Máximo 50 targets, frecuencia mínima 1 minuto.
   - **Plan Enterprise:** Targets ilimitados, frecuencia 30 segundos, Multi-puerto SSL (`:8443`, `:636`, `:993`), exportación de auditorías ISO 27001 y Multi-Status Pages.
   - **Validación de Bloqueo:** Intentar crear el target `N+1` debe retornar `HTTP 403 Forbidden` con mensaje descriptivo.
2. **Aislamiento Multi-Tenant:**
   - La Organización A jamás debe poder listar, mutar ni eliminar datos (targets, alertas, certificados, incidentes) de la Organización B.
3. **Control de Acceso Basado en Roles (RBAC):**
   - `Viewer`: Solo lectura. No puede pausar targets, silenciar alertas ni alterar configuraciones.
   - `Operator`: Puede reconocer alertas y documentar bitácoras de incidentes.
   - `Admin / Owner`: Gestión de miembros, facturación y eliminación masiva.
4. **Motor de Alertas Inteligentes & Anti-Flapping:**
   - Detección de $\ge 3$ transiciones de estado en 15 minutos escala a severidad Crítica.
   - Deduplicación con preservación de `triggered_at` y cálculo de MTTR real.

### 💻 Ejemplo de Implementación (`backend/tests/test_plan_limits.py`):
```python
import pytest
from rest_framework.test import APIClient

@pytest.mark.django_db
def test_free_plan_target_quota_enforced(api_client, free_org_user):
    api_client.force_authenticate(user=free_org_user)
    
    # Crear los 5 targets permitidos
    for i in range(5):
        resp = api_client.post('/api/v1/monitoring/', {
            'name': f'Target {i}',
            'target_type': 'http',
            'url': f'https://service{i}.local'
        })
        assert resp.status_code == 201

    # El 6to debe ser rechazado por cuota del plan Free
    resp = api_client.post('/api/v1/monitoring/', {
        'name': 'Target Excedente',
        'target_type': 'http',
        'url': 'https://excedente.local'
    })
    assert resp.status_code == 403
    assert "límite" in resp.data.get('message', '').lower()
```

---

## 2️⃣ Nivel 2: Carga, Estrés y Rendimiento (Grafana k6) - Implementado al 100%

**Propósito:** Evaluar cómo responde el backend y la base de datos TimescaleDB bajo concurrencia masiva antes de salir a producción.

### 📁 Ubicación en el Proyecto:
Ruta física: `tests_perf/` (en la raíz del proyecto `GC_OPS_OBS/tests_perf/`)

```
tests_perf/
├── config.js                                    # Configuración global, BASE_URL y SLAs
├── README.md                                    # Guía técnica de ejecución y métricas
├── run_perf.ps1                                 # Runner interactivo para PowerShell
├── run_perf.bat                                 # Runner rápido para CMD o doble clic
├── helpers/
│   ├── auth.js                                  # Login JWT contra /api/v1/auth/login/
│   └── reporters.js                             # Reportes visuales HTML (Dark Mode NOC)
├── scenarios/
│   ├── 01_noc_dashboard_stress.js              # Simulación de operadores en el NOC
│   ├── 02_full_platform_read_heavy.js           # Lectura intensiva concurrente en 8 módulos
│   ├── 03_monitoring_crud_stress.js             # Ciclo transaccional y pre-flight checks
│   ├── 04_spike_stress_test.js                  # Picos repentinos de carga (hasta 70 VUs)
│   └── 05_soak_endurance_test.js                # Prueba de resistencia continua (Soak Test)
└── reports/                                     # Reportes HTML generados
    ├── noc_dashboard_stress_summary.html
    ├── full_platform_read_heavy_summary.html
    ├── monitoring_crud_stress_summary.html
    ├── spike_stress_test_summary.html
    └── soak_endurance_test_summary.html
```

### 📌 Escenarios de Prueba Implementados:
1. **01 - Concurrencia de Operadores en Dashboard NOC (`01_noc_dashboard_stress.js`):**
   - Simula operadores consultando simultáneamente telemetría en tiempo real (`/monitoring/global-performance/`), alertas activas (`/alerts/`), estadísticas de SLA/MTTR (`/incidents/stats/`) y targets (`/monitoring/`).
2. **02 - Lectura Intensiva Multi-Módulo (`02_full_platform_read_heavy.js`):**
   - Concurrencia sobre Uptime, SSL, DNS, WHOIS, Security Headers, API Checks, Alertas e Incidentes (15 a 50 VUs).
3. **03 - CRUD y Transacciones de Monitoreo (`03_monitoring_crud_stress.js`):**
   - Test de conexión en vivo con sondeo real, creación de target y eliminación para no ensuciar la base de datos.
4. **04 - Spike / Ráfagas Repentinas (`04_spike_stress_test.js`):**
   - Salto de 2 a 70 usuarios virtuales en 10 segundos para validar absorción y resiliencia de Gunicorn y PostgreSQL.
5. **05 - Soak / Resistencia y Detección de Leaks (`05_soak_endurance_test.js`):**
   - Carga moderada constante prolongada para asegurar que no existan memory leaks en Redis ni TimescaleDB.

### 🏃‍♂️ Comandos de Ejecución Rápida:
```powershell
# Ejecutar escenario individual:
.\tests_perf\run_perf.ps1 -Scenario noc
.\tests_perf\run_perf.ps1 -Scenario read
.\tests_perf\run_perf.ps1 -Scenario crud
.\tests_perf\run_perf.ps1 -Scenario spike
.\tests_perf\run_perf.ps1 -Scenario soak

# Ejecutar la suite completa:
.\tests_perf\run_perf.ps1 -Scenario all

# O vía batch (CMD):
tests_perf\run_perf.bat noc
```

### ⚡ Resultados Reales Obtenidos en Benchmark Local:
- **Peticiones procesadas:** 1,965 peticiones en 1 minuto.
- **Latencia promedio (Avg):** 37.69 ms.
- **Latencia Percentil 95 (p95):** 55.88 ms (Objetivo SLA: < 300 ms &rarr; **Aprobado con creces**).
- **Tasa de error HTTP:** 0.00% (con rate limiting adaptado para benchmarks de testing).
- **Reporte visual:** Generado en `tests_perf/reports/noc_dashboard_stress_summary.html` con tema Sentinel Dark Mode.

---

## 3️⃣ Nivel 3: Casos de Uso E2E en Navegador Real (Playwright)

**Propósito:** Simular las acciones de un usuario humano en la interfaz gráfica (React + Vite).

### 📌 Flujos de Usuario Críticos:
1. **Flujo Onboarding Completo:**
   - Visitar `/register` -> Ingresar datos válidos -> Creación automática de Organización -> Redirección a `/dashboard`.
2. **Creación de Monitoreo & Test en Vivo:**
   - Entrar a `/monitoring` -> Abrir Modal -> Probar conexión TLS con botón en vivo -> Guardar -> Validar que aparece en la tabla con radar verde.
3. **Bloqueo Visual de Cuotas (Upgrade Modal):**
   - Al intentar crear más componentes que los permitidos por el plan, verificar que se despliegue el modal interactivo `UpgradePlanModal` invitando a mejorar la suscripción.
4. **Respuesta a Incidentes y Drawer ITIL:**
   - Hacer clic en un target caído -> Abrir `TargetDetailDrawer` -> Vincular Alerta -> Elevar a Incidente -> Validar actualización en vivo.

### 💻 Ejemplo de Test E2E (`frontend/e2e/monitoring_workflow.spec.ts`):
```typescript
import { test, expect } from '@playwright/test';

test('Usuario crea objetivo y valida tarjeta en NOC', async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', 'admin@sentinel.local');
  await page.fill('input[type="password"]', 'admin123456');
  await page.click('button:has-text("Iniciar Sesión")');

  await expect(page).toHaveURL('http://localhost:3000/dashboard');

  await page.click('a[href="/monitoring"]');
  await expect(page.locator('h1')).toContainText('Uptime & Latencia');

  await page.click('button:has-text("Nuevo Objetivo")');
  await page.fill('input[placeholder*="Ej. Servidor"]', 'Gateway Transaccional');
  await page.fill('input[placeholder*="https://"]', 'https://gateway.empresa.com');
  await page.click('button:has-text("Guardar y Monitorear")');

  await expect(page.locator('text=Gateway Transaccional')).toBeVisible();
});
```

---

## ⚙️ Integración Continua (CI/CD Pipeline)

Al realizar `git push` o abrir un Pull Request:
1. **Paso 1:** Ejecutar `npx tsc --noEmit` y `npm run build` (0 errores de compilación).
2. **Paso 2:** Ejecutar `pytest` para verificar todas las reglas de negocio y planes.
3. **Paso 3:** Ejecutar suite de `Playwright` en modo headless para flujos clave de UI.
4. **Paso 4:** En despliegues a Staging, ejecutar test de regresión de rendimiento con `k6`.
