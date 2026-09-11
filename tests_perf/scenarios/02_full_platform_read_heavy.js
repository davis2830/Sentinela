import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { CONFIG, getAuthHeaders } from '../config.js';
import { authenticate } from '../helpers/auth.js';
import { generateNOCSummary } from '../helpers/reporters.js';

export const options = {
  stages: [
    { duration: '20s', target: 15 }, // Rampa a 15 usuarios
    { duration: '40s', target: 35 }, // Carga sostenida a 35 usuarios
    { duration: '20s', target: 50 }, // Pico a 50 usuarios
    { duration: '15s', target: 0 },  // Rampa de descenso
  ],
  thresholds: {
    'http_req_duration': ['p(95)<400', 'p(99)<800'],
    'http_req_failed': ['rate<0.02'], // Menos de 2% fallos
    'checks': ['rate>0.95'],
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

  group('Módulos de Observabilidad de Sentinel', () => {
    // 1. Targets de Monitoreo & Uptime
    const resMonitoring = http.get(`${CONFIG.BASE_URL}/api/v1/monitoring/`, params);
    check(resMonitoring, {
      'monitoring status 200': (r) => r.status === 200,
    });

    // 2. Certificados SSL
    const resSSL = http.get(`${CONFIG.BASE_URL}/api/v1/ssl-certificates/`, params);
    check(resSSL, {
      'ssl status 200': (r) => r.status === 200,
    });

    // 3. Registros DNS
    const resDNS = http.get(`${CONFIG.BASE_URL}/api/v1/dns-records/`, params);
    check(resDNS, {
      'dns status 200': (r) => r.status === 200,
    });

    // 4. Dominios WHOIS
    const resDomains = http.get(`${CONFIG.BASE_URL}/api/v1/domains/`, params);
    check(resDomains, {
      'domains status 200': (r) => r.status === 200,
    });

    // 5. API Checks Sintéticos
    const resAPIChecks = http.get(`${CONFIG.BASE_URL}/api/v1/api-checks/`, params);
    check(resAPIChecks, {
      'api-checks status 200': (r) => r.status === 200,
    });

    // 6. Cabeceras de Seguridad
    const resSecHeaders = http.get(`${CONFIG.BASE_URL}/api/v1/security-headers/`, params);
    check(resSecHeaders, {
      'security-headers status 200': (r) => r.status === 200,
    });

    // 7. Centro de Alertas
    const resAlerts = http.get(`${CONFIG.BASE_URL}/api/v1/alerts/`, params);
    check(resAlerts, {
      'alerts status 200': (r) => r.status === 200,
    });

    // 8. Incidentes y SLA Stats
    const resIncidents = http.get(`${CONFIG.BASE_URL}/api/v1/incidents/stats/`, params);
    check(resIncidents, {
      'incidents-stats status 200': (r) => r.status === 200,
    });
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'tests_perf/reports/full_platform_read_heavy_summary.html': generateNOCSummary(
      data,
      'Sentinel Platform - Escenario 02: Lectura Intensiva Multi-Módulo'
    ),
    stdout: `\n=== RESUMEN EJECUTIVO PLATFORM READ HEAVY ===\n` +
            `Peticiones: ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0}\n` +
            `Latencia Media: ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values.avg.toFixed(2) : 0} ms\n` +
            `Latencia p(95): ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(95)'].toFixed(2) : 0} ms\n` +
            `Reporte HTML: tests_perf/reports/full_platform_read_heavy_summary.html\n`,
  };
}
