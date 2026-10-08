// Bounded LOCAL read-only baseline. Never run against a customer account.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { CONFIG, getAuthHeaders } from '../config.js';
import { authenticate } from '../helpers/auth.js';

export const options = {
  stages: [{ duration: '20s', target: 1 }, { duration: '30s', target: 3 },
           { duration: '30s', target: 5 }, { duration: '120s', target: 5 },
           { duration: '10s', target: 0 }],
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<500'], checks: ['rate>0.99'] },
};

export function setup() {
  if (!/^http:\/\/(127\.0\.0\.1|localhost):8000$/.test(CONFIG.BASE_URL) ||
      !/^e2e-viewer-pending-20261007@example\.test$/.test(CONFIG.AUTH.EMAIL)) {
    throw new Error('Requires explicitly named isolated local fixture.');
  }
  const token = authenticate();
  if (!token) throw new Error('Fixture authentication failed.');
  return { token };
}

export default function ({ token }) {
  for (const path of ['monitoring/', 'status-page/pages/']) {
    const response = http.get(`${CONFIG.BASE_URL}/api/v1/${path}`, getAuthHeaders(token));
    check(response, { 'isolated GET succeeds': (r) => r.status === 200 });
  }
  sleep(3);
}
