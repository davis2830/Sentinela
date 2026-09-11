import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { CONFIG, getAuthHeaders } from '../config.js';
import { authenticate } from '../helpers/auth.js';
import { generateNOCSummary } from '../helpers/reporters.js';

export const options = {
  stages: [
    { duration: '15s', target: 5 },  // Rampa suave a 5 usuarios escribiendo
    { duration: '30s', target: 15 }, // 15 usuarios concurrentes creando/probando targets
    { duration: '15s', target: 0 },  // Descenso
  ],
  thresholds: {
    'http_req_duration': ['p(95)<3000'], // Sondeos de red salientes a internet
    'http_req_failed': ['rate<0.05'],   // Fallos < 5%
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
  const vuId = __VU;
  const iterId = __ITER;
  const uniqueName = `Perf-Target-VU${vuId}-${iterId}-${Date.now()}`;

  group('Ciclo Transaccional de Targets de Monitoreo', () => {
    // 1. Probar conexión en vivo (Pre-flight check)
    const testPayload = JSON.stringify({
      endpoint: 'https://httpbin.org/status/200',
      target_type: 'http',
      http_method: 'GET',
      expected_status: 200,
    });

    const resTest = http.post(`${CONFIG.BASE_URL}/api/v1/monitoring/test-connection/`, testPayload, params);
    check(resTest, {
      'test-connection responde 200': (r) => r.status === 200,
    });

    sleep(0.5);

    // 2. Crear Target de Monitoreo
    const createPayload = JSON.stringify({
      name: uniqueName,
      target_type: 'http',
      endpoint: 'https://httpbin.org/status/200',
      interval: 60,
      enabled: true,
    });

    const resCreate = http.post(`${CONFIG.BASE_URL}/api/v1/monitoring/`, createPayload, params);
    const createdOk = check(resCreate, {
      'create target status 201': (r) => r.status === 201,
    });

    let targetId = null;
    if (createdOk) {
      try {
        const body = resCreate.json();
        targetId = body.id || (body.data && body.data.id);
      } catch (e) {}
    }

    sleep(0.5);

    // 3. Eliminar Target para mantener limpia la BD
    if (targetId) {
      const resDelete = http.del(`${CONFIG.BASE_URL}/api/v1/monitoring/${targetId}/`, null, params);
      check(resDelete, {
        'delete target status 204 or 200': (r) => r.status === 204 || r.status === 200,
      });
    }
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'tests_perf/reports/monitoring_crud_stress_summary.html': generateNOCSummary(
      data,
      'Sentinel Platform - Escenario 03: Escritura y CRUD Transaccional de Targets'
    ),
    stdout: `\n=== RESUMEN EJECUTIVO MONITORING CRUD STRESS ===\n` +
            `Peticiones: ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0}\n` +
            `Latencia Media: ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values.avg.toFixed(2) : 0} ms\n` +
            `Latencia p(95): ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(95)'].toFixed(2) : 0} ms\n` +
            `Reporte HTML: tests_perf/reports/monitoring_crud_stress_summary.html\n`,
  };
}
