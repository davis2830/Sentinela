import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { CONFIG, getAuthHeaders } from '../config.js';
import { authenticate } from '../helpers/auth.js';
import { generateNOCSummary } from '../helpers/reporters.js';

export const options = {
  stages: [
    { duration: '15s', target: 10 }, // Rampa suave a 10 operadores concurrentes
    { duration: '30s', target: 25 }, // Carga sostenida de 25 operadores consultando el NOC
    { duration: '15s', target: 40 }, // Pico a 40 operadores
    { duration: '10s', target: 0 },  // Rampa de bajada
  ],
  thresholds: {
    'http_req_duration': ['p(95)<300', 'p(99)<600'], // 95% de peticiones bajo 300ms
    'http_req_failed': ['rate<0.01'],                 // Menos de 1% de fallo
    'checks': ['rate>0.98'],                          // 98% de checks exitosos
  },
};

export function setup() {
  const token = authenticate();
  if (!token) {
    throw new Error('Fallo crítico al autenticar usuario de pruebas de rendimiento.');
  }
  return { token };
}

export default function (data) {
  const params = getAuthHeaders(data.token);

  group('NOC Dashboard Telemetría en Tiempo Real', () => {
    // 1. Gráfica de Rendimiento Global (CPU, Uptime, Latencia por hora)
    const resPerf = http.get(`${CONFIG.BASE_URL}/api/v1/monitoring/global-performance/`, params);
    check(resPerf, {
      'global-performance status 200': (r) => r.status === 200,
      'global-performance tiene data': (r) => {
        try {
          return r.json().success === true;
        } catch (e) {
          return false;
        }
      },
      'global-performance latencia < 350ms': (r) => r.timings.duration < 350,
    });

    sleep(0.5);

    // 2. Feed de Alertas Activas del NOC
    const resAlerts = http.get(`${CONFIG.BASE_URL}/api/v1/alerts/`, params);
    check(resAlerts, {
      'alerts status 200': (r) => r.status === 200,
      'alerts latencia < 250ms': (r) => r.timings.duration < 250,
    });

    sleep(0.5);

    // 3. Estadísticas de Incidentes & MTTR / MTTA
    const resIncidents = http.get(`${CONFIG.BASE_URL}/api/v1/incidents/stats/`, params);
    check(resIncidents, {
      'incidents-stats status 200': (r) => r.status === 200,
      'incidents-stats latencia < 250ms': (r) => r.timings.duration < 250,
    });

    sleep(0.5);

    // 4. Lista de Targets Críticos
    const resTargets = http.get(`${CONFIG.BASE_URL}/api/v1/monitoring/`, params);
    check(resTargets, {
      'monitoring-targets status 200': (r) => r.status === 200,
      'monitoring-targets latencia < 300ms': (r) => r.timings.duration < 300,
    });
  });

  // Pausa simulando el auto-refresco o intervalo de lectura del operador
  sleep(1);
}

export function handleSummary(data) {
  return {
    'tests_perf/reports/noc_dashboard_stress_summary.html': generateNOCSummary(
      data,
      'Sentinel NOC - Escenario 01: Estrés de Dashboard y Telemetría'
    ),
    stdout: `\n=== RESUMEN EJECUTIVO NOC DASHBOARD STRESS ===\n` +
            `Peticiones: ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0}\n` +
            `Latencia Media: ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values.avg.toFixed(2) : 0} ms\n` +
            `Latencia p(95): ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(95)'].toFixed(2) : 0} ms\n` +
            `Reporte HTML: tests_perf/reports/noc_dashboard_stress_summary.html\n`,
  };
}
