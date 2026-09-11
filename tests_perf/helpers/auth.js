import http from 'k6/http';
import { check } from 'k6';
import { CONFIG } from '../config.js';

/**
 * Inicia sesión en Sentinel y obtiene el access_token JWT
 */
export function authenticate() {
  const payload = JSON.stringify({
    email: CONFIG.AUTH.EMAIL,
    password: CONFIG.AUTH.PASSWORD,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };

  const res = http.post(`${CONFIG.BASE_URL}/api/v1/auth/login/`, payload, params);

  const loginSuccess = check(res, {
    'auth login exitoso (200)': (r) => r.status === 200,
    'token JWT retornado': (r) => {
      try {
        const json = r.json();
        return json && json.data && typeof json.data.access_token === 'string';
      } catch (e) {
        return false;
      }
    },
  });

  if (!loginSuccess) {
    console.error(`Error de autenticación [${res.status}]: ${res.body}`);
    return null;
  }

  return res.json().data.access_token;
}
