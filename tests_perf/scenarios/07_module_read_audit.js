// Bounded, read-only module audit. Only the explicitly named local fixture is accepted.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { safeSummaryJSON } from '../helpers/reporters.js';

const base = __ENV.PERF_BASE_URL || 'http://backend:8000';
const suffix = __ENV.PERF_FIXTURE_SUFFIX || '';
const modules = ['monitoring', 'ssl-certificates', 'dns-records', 'domains', 'api-checks',
  'security-headers', 'agent-probes', 'alerts', 'incidents', 'maintenance',
  'notifications', 'notifications/channels', 'reports', 'status-page/pages', 'audit-logs',
  'users', 'organizations/current/subscription', 'monitoring/global-performance/?period=24h'];
export const options = {
  stages: [{ duration: '15s', target: 1 }, { duration: '30s', target: 3 },
    { duration: '60s', target: 5 }, { duration: '10s', target: 0 }],
  thresholds: { http_req_failed: ['rate<0.01'], checks: ['rate>0.99'],
    ...Object.fromEntries(modules.map(module => [`http_req_duration{module:${module}}`, ['p(95)<500']])) },
};
export function setup() {
  if (!/^http:\/\/(backend:8000|127\.0\.0\.1:31800)$/.test(base)
      || !/^audit-perf-[a-z0-9-]{3,40}$/.test(suffix)) {
    throw new Error('Only isolated local audit services and audit-perf fixtures are permitted.');
  }
  const response = http.post(`${base}/api/v1/auth/login/`, JSON.stringify({
    email: `e2e-viewer-${suffix}@example.test`, password: 'E2e-Viewer-Password-123!',
  }), { headers: { 'Content-Type': 'application/json' } });
  if (response.status !== 200) throw new Error(`Fixture login failed (${response.status}); response body withheld.`);
  return { token: response.json().data.access_token };
}
export default function ({ token }) {
  for (const module of modules) {
    const path = module.includes('?') ? module : `${module}/`;
    const response = http.get(`${base}/api/v1/${path}`, {
      headers: { Authorization: `Bearer ${token}` }, tags: { module },
    });
    check(response, { 'module GET succeeds': r => r.status === 200 }, { module });
  }
  sleep(2);
}
export function handleSummary(data) {
  return { 'tests_perf/reports/module-audit-local.json': safeSummaryJSON(data),
    stdout: 'Module audit complete. Per-module metrics saved without authentication setup data.\n' };
}
