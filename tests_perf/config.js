/**
 * Configuración global para pruebas de rendimiento k6 en Sentinel
 */
export const CONFIG = {
  BASE_URL: __ENV.BASE_URL || 'http://[::1]:8000',
  AUTH: {
    EMAIL: __ENV.PERF_EMAIL || 'test_perf@sentinel.local',
    PASSWORD: __ENV.PERF_PASSWORD || 'SentinelPerf2026!',
  },
  // Umbrales estándar de SLA para Sentinel
  DEFAULT_THRESHOLDS: {
    http_req_duration: ['p(90)<200', 'p(95)<300', 'p(99)<500'], // 95% de peticiones en menos de 300ms
    http_req_failed: ['rate<0.01'],                               // Menos de 1% de errores HTTP
  },
};

/**
 * Cabeceras HTTP estándar con JWT
 */
export function getAuthHeaders(token) {
  return {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };
}
