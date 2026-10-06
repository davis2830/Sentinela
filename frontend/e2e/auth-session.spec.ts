import { expect, test, type Page } from '@playwright/test';

// Exercise the shared HTTP client in the running Vite application, not real user sessions.
async function exerciseClient(page: Page, options: { access?: string; refresh?: string; requests?: number } = {}) {
  return page.evaluate(async ({ access, refresh, requests = 1 }) => {
    if (access) localStorage.setItem('access_token', access);
    if (refresh) localStorage.setItem('refresh_token', refresh);
    const modulePath = '/src/services/api.ts';
    const { api } = await import(modulePath);
    const results = await Promise.all(Array.from({ length: requests }, (_, index) =>
      api.get(`session-regression/${index}/`).then(() => true).catch(() => false)));
    return { results, access: localStorage.getItem('access_token'), refresh: localStorage.getItem('refresh_token') };
  }, options);
}

test('concurrent unauthorized requests share one rotating refresh', async ({ page }) => {
  let refreshes = 0;
  await page.route('**/api/v1/**', async (route) => {
    if (route.request().url().endsWith('/auth/refresh/')) {
      refreshes++;
      await route.fulfill({ json: { data: { access_token: 'renewed-access', refresh_token: 'rotated-refresh' } } });
    } else await route.fulfill({ status: route.request().headers().authorization === 'Bearer renewed-access' ? 200 : 401, json: { data: [] } });
  });
  await page.goto('/login');
  const result = await exerciseClient(page, { access: 'expired-access', refresh: 'old-refresh', requests: 5 });
  expect(result.results).toEqual([true, true, true, true, true]);
  expect(refreshes).toBe(1);
  expect(result.refresh).toBe('rotated-refresh');
  const persistedAccess = await page.evaluate(() => JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.accessToken);
  expect(persistedAccess).toBe('renewed-access');
});

test('missing refresh clears the stale persisted authenticated state', async ({ page }) => {
  await page.route('**/api/v1/session-regression/**', route => route.fulfill({ status: 401, json: { detail: 'Unauthorized' } }));
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('auth-storage', JSON.stringify({ state: { isAuthenticated: true }, version: 0 })));
  const result = await exerciseClient(page, { access: 'expired-access' });
  expect(result.results).toEqual([false]);
  expect(result.access).toBeNull();
  const authenticated = await page.evaluate(() => JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.isAuthenticated);
  expect(authenticated).toBe(false);
});

test('revoked refresh clears credentials without an unauthorized loop', async ({ page }) => {
  let refreshes = 0;
  await page.route('**/api/v1/**', async route => {
    if (route.request().url().endsWith('/auth/refresh/')) refreshes++;
    await route.fulfill({ status: 401, json: { detail: 'Expired' } });
  });
  await page.goto('/login');
  const result = await exerciseClient(page, { access: 'expired-access', refresh: 'revoked-refresh', requests: 3 });
  expect(result.results).toEqual([false, false, false]);
  expect(result.access).toBeNull();
  expect(result.refresh).toBeNull();
  expect(refreshes).toBe(1);
});

test('non-rotating refresh preserves the existing refresh token', async ({ page }) => {
  await page.route('**/api/v1/**', async route => {
    if (route.request().url().endsWith('/auth/refresh/')) await route.fulfill({ json: { data: { access_token: 'renewed-access' } } });
    else await route.fulfill({ status: route.request().headers().authorization === 'Bearer renewed-access' ? 200 : 401, json: { data: [] } });
  });
  await page.goto('/login');
  const result = await exerciseClient(page, { access: 'expired-access', refresh: 'valid-refresh' });
  expect(result.results).toEqual([true]);
  expect(result.refresh).toBe('valid-refresh');
});

test('temporary refresh server failure does not revoke the session', async ({ page }) => {
  await page.route('**/api/v1/**', route => route.fulfill({ status: route.request().url().endsWith('/auth/refresh/') ? 503 : 401, json: { detail: 'Unavailable' } }));
  await page.goto('/login');
  const result = await exerciseClient(page, { access: 'expired-access', refresh: 'valid-refresh' });
  expect(result.results).toEqual([false]);
  expect(result.refresh).toBe('valid-refresh');
});

test('login excludes stale bearer credentials and does not attempt a refresh', async ({ page }) => {
  let refreshes = 0;
  let authorization: string | undefined;
  await page.route('**/api/v1/**', async route => {
    if (route.request().url().endsWith('/auth/refresh/')) refreshes++;
    authorization = route.request().headers().authorization;
    await route.fulfill({ status: 401, json: { message: 'Credenciales incorrectas' } });
  });
  await page.goto('/login');
  await page.evaluate(() => { localStorage.setItem('access_token', 'expired-access'); localStorage.setItem('refresh_token', 'expired-refresh'); });
  await page.getByPlaceholder('usuario@dominio.com').fill('invalid@example.test');
  await page.getByPlaceholder('••••••••••••').fill('Invalid-password');
  await page.getByRole('button', { name: 'Ingresar a la Plataforma' }).click();
  await expect(page.getByText('Credenciales incorrectas', { exact: true })).toBeVisible();
  expect(authorization).toBeUndefined();
  expect(refreshes).toBe(0);
});
