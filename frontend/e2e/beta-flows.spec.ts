import { expect, test, type Page } from '@playwright/test';

async function betaFixture(page: Page, options: { closed?: boolean; failed?: boolean } = {}) {
  await page.route('**/api/v1/auth/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith('/config/') ? { admissions_open: !options.closed, turnstile_site_key: '' } :
      path.endsWith('/invitation/') ? { status: 'invited', masked_email: 'an***@example.test' } :
      path.endsWith('/register/') ? { status: 'pending_verification', registration_session: 'limited-session' } :
      path.endsWith('/status/') ? { status: 'pending_verification', delivery_status: options.failed ? 'failed' : 'sent', retry_after_seconds: 60 } :
      path.endsWith('/verify/') ? { status: 'verified', message: 'Correo confirmado. Ahora puedes iniciar sesión.' } :
      { message: 'Si la cuenta puede verificarse, enviaremos un nuevo enlace.', retry_after_seconds: 60 };
    await route.fulfill({ status: path.endsWith('/register/') ? 202 : 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
  });
}

test('private beta requires an invitation and explains closed admission', async ({ page }) => {
  await betaFixture(page, { closed: true });
  await page.goto('/register');
  await expect(page.getByText('La beta está cerrada a nuevos registros.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Completar Registro' })).toBeDisabled();
});

test('register leads to verification, never to an authenticated dashboard', async ({ page }) => {
  await betaFixture(page);
  await page.goto('/register#token=invitation-fixture');
  const inputs = page.locator('form input');
  await inputs.nth(0).fill('Ana');
  await inputs.nth(1).fill('Beta');
  await inputs.nth(2).fill('Organización Beta');
  await inputs.nth(3).fill('ana@example.test');
  await inputs.nth(4).fill('Strong-Alpha-482!Password');
  await inputs.nth(5).fill('Strong-Alpha-482!Password');
  await page.getByRole('button', { name: 'Completar Registro' }).click();
  await expect(page).toHaveURL(/\/check-email$/);
  await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Reenviar en/ })).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem('access_token'))).toBeNull();
});

test('opening email link does not POST or activate; explicit confirmation does', async ({ page }) => {
  await betaFixture(page);
  let confirmations = 0;
  page.on('request', r => { if (r.url().includes('/beta/verify/') && r.method() === 'POST') confirmations++; });
  await page.goto('/verify-email#token=verification-fixture');
  await expect(page.getByRole('heading', { name: 'Confirma tu correo' })).toBeVisible();
  expect(confirmations).toBe(0);
  await expect(page).toHaveURL(/\/verify-email$/);
  await page.getByRole('button', { name: 'Confirmar correo' }).click();
  await expect(page.getByRole('heading', { name: 'Correo confirmado' })).toBeVisible();
  expect(confirmations).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('access_token'))).toBeNull();
});

test('confirmation sends the fragment token, never an empty captcha', async ({ page }) => {
  await betaFixture(page);
  await page.goto('/verify-email#token=exact-confirmation-token');
  const request = page.waitForRequest(r => r.url().includes('/beta/verify/') && r.method() === 'POST');
  await page.getByRole('button', { name: 'Confirmar correo' }).click();
  expect((await request).postDataJSON()).toEqual({ token: 'exact-confirmation-token' });
  await expect(page.getByRole('heading', { name: 'Correo confirmado' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ir a iniciar sesión' })).toBeVisible();
});

test('expired or replaced link explains recovery instead of a generic failure', async ({ page }) => {
  await betaFixture(page);
  await page.route('**/api/v1/auth/beta/verify/', route => route.fulfill({ status: 400,
    contentType: 'application/json', body: JSON.stringify({ success: false,
      message: 'El enlace venció, ya fue utilizado o no es válido. Solicita uno nuevo.' }) }));
  await page.goto('/verify-email#token=expired-fixture');
  await page.getByRole('button', { name: 'Confirmar correo' }).click();
  await expect(page.getByRole('alert')).toContainText('El enlace venció');
  await expect(page.getByRole('link', { name: 'Solicitar otro enlace' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar correo' })).toHaveCount(0);
});

test('reloading the stripped link cannot submit an empty token', async ({ page }) => {
  await betaFixture(page);
  let posts = 0;
  page.on('request', r => { if (r.url().includes('/beta/verify/') && r.method() === 'POST') posts++; });
  await page.goto('/verify-email#token=reload-fixture');
  await expect(page).toHaveURL(/\/verify-email$/);
  await page.reload();
  await expect(page.getByText('Esta página no tiene un enlace', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Solicitar otro enlace' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar correo' })).toHaveCount(0);
  expect(posts).toBe(0);
});

test('pending login does not promise another email and uses the server cooldown', async ({ page }) => {
  await betaFixture(page);
  await page.route('**/api/v1/auth/beta/status/', route => route.fulfill({ contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { status: 'pending_verification', delivery_status: 'sent', retry_after_seconds: 0 } }) }));
  await page.addInitScript(() => sessionStorage.setItem('sentinel:registration-session', 'limited-session'));
  await page.goto('/check-email');
  await expect(page.getByText('Iniciar sesión no envía otro correo', { exact: false })).toBeVisible();
  await expect(page.getByText('El servidor de correo aceptó el mensaje.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reenviar correo' })).toBeEnabled();
});

test('failed delivery is actionable and mobile does not overflow', async ({ page }) => {
  await betaFixture(page, { failed: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => sessionStorage.setItem('sentinel:registration-session', 'limited-session'));
  await page.goto('/check-email');
  await expect(page.getByText(/No pudimos enviar el correo/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.getByRole('link', { name: 'Ir a iniciar sesión' }).focus();
  await expect(page.getByRole('link', { name: 'Ir a iniciar sesión' })).toBeFocused();
});

test('verification layout is usable on desktop and mobile', async ({ page }) => {
  await betaFixture(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/verify-email#token=visual-fixture');
  await expect(page.getByRole('list', { name: 'Progreso de tu cuenta' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar correo' })).toBeInViewport();
  await page.screenshot({ path: 'test-results/verification-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/verification-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.getByRole('button', { name: 'Confirmar correo' }).focus();
  await expect(page.getByRole('button', { name: 'Confirmar correo' })).toBeFocused();
});
