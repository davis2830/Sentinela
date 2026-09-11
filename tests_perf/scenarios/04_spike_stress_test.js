import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { CONFIG, getAuthHeaders } from '../config.js';
import { authenticate } from '../helpers/auth.js';
import { generateNOCSummary } from '../helpers/reporters.js';

export const options = {
  stages: [
    { duration: '10s', target: 2 },  // Línea base baja (2 VUs)
    { duration: '10s', target: 70 }, // RÁFAGA / SPIKE repentino a 70 VUs
    { duration: '20s', target: 70 }, // Sostener pico extremo de carga
    { duration: '10s', target: 5 },  // Caída abrupta a 5 VUs
    { duration: '10s', target: 0 },  // Recuperación total
  ],
  thresholds: {
    'http_req_duration': ['p(95)<800'],
    'http_req_failed': ['rate<0.05'],
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

  group('Spike Test en Endpoints Críticos de Telemetría', () => {
    // Petición al endpoint más demandado del NOC
    const res = http.get(`${CONFIG.BASE_URL}/api/v1/monitoring/global-performance/`, params);
    check(res, {
      'spike status 200': (r) => r.status === 200,
      'spike latency < 1000ms': (r) => r.timings.duration < 1000,
    });
  });

  sleep(0.3);
}

export function handleSummary(data) {
  return {
    'tests_perf/reports/spike_stress_test_summary.html': generateNOCSummary(
      data,
      'Sentinel Platform - Escenario 04: Spike / Ráfaga Repentina de Carga'
    ),
    stdout: `\n=== RESUMEN EJECUTIVO SPIKE STRESS TEST ===\n` +
            `Peticiones: ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0}\n` +
            `Latencia Media: ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values.avg.toFixed(2) : 0} ms\n` +
            `Latencia p(95): ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(95)'].toFixed(2) : 0} ms\n` +
            `Reporte HTML: tests_perf/reports/spike_stress_test_summary.html\n`,
  };
}
