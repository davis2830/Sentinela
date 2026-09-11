import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { CONFIG, getAuthHeaders } from '../config.js';
import { authenticate } from '../helpers/auth.js';
import { generateNOCSummary } from '../helpers/reporters.js';

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Rampa suave
    { duration: '3m', target: 20 },  // Carga sostenida moderada (20 VUs constantes)
    { duration: '30s', target: 0 },  // Descenso
  ],
  thresholds: {
    'http_req_duration': ['p(95)<350'],
    'http_req_failed': ['rate<0.01'],
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

  group('Monitoreo Continuo Prolongado (Soak / Endurance)', () => {
    // 1. Telemetría NOC
    const r1 = http.get(`${CONFIG.BASE_URL}/api/v1/monitoring/global-performance/`, params);
    check(r1, { 'perf 200': (r) => r.status === 200 });

    // 2. Alertas
    const r2 = http.get(`${CONFIG.BASE_URL}/api/v1/alerts/`, params);
    check(r2, { 'alerts 200': (r) => r.status === 200 });

    // 3. Targets
    const r3 = http.get(`${CONFIG.BASE_URL}/api/v1/monitoring/`, params);
    check(r3, { 'monitoring 200': (r) => r.status === 200 });
  });

  sleep(2);
}

export function handleSummary(data) {
  return {
    'tests_perf/reports/soak_endurance_test_summary.html': generateNOCSummary(
      data,
      'Sentinel Platform - Escenario 05: Prueba de Resistencia y Estabilidad Continua (Soak Test)'
    ),
    stdout: `\n=== RESUMEN EJECUTIVO SOAK ENDURANCE TEST ===\n` +
            `Peticiones: ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0}\n` +
            `Latencia Media: ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values.avg.toFixed(2) : 0} ms\n` +
            `Latencia p(95): ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(95)'].toFixed(2) : 0} ms\n` +
            `Reporte HTML: tests_perf/reports/soak_endurance_test_summary.html\n`,
  };
}
