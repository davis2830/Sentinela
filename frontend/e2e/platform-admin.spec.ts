import { expect, test, type Page } from '@playwright/test';

async function loginFixture(page: Page, isSuperuser: boolean) {
  const user = {
    id: 'operator-fixture', email: 'operator@example.test', is_staff: true, is_superuser: isSuperuser,
    organization: { id: 'platform-fixture', name: 'Platform Fixture' },
  };
  await page.addInitScript(operator => {
    localStorage.setItem('auth-storage', JSON.stringify({ version: 0, state: { user: operator, isAuthenticated: true } }));
  }, user);
  await page.route('**/api/v1/**', route => route.fulfill({
    json: { success: true, data: new URL(route.request().url()).pathname.endsWith('/auth/me/') ? user : [] },
  }));
}

test('superadmin can review SaaS metrics, manage users and inspect global audit', async ({ page }) => {
  await loginFixture(page, true);
  await page.route('**/api/v1/platform-admin/session/login/', route => {
    expect(route.request().headers().authorization).toBeUndefined();
    return route.fulfill({ json: { data: { challenge: 'controlled-challenge' } } });
  });
  await page.route('**/api/v1/platform-admin/session/verify/', route => {
    expect(route.request().postDataJSON()).toEqual({ challenge: 'controlled-challenge', code: '123456' });
    return route.fulfill({ json: { data: { token: 'controlled-platform-token', expires_in: 600,
      user: { id: 'operator-fixture', email: 'operator@example.test' } } } });
  });
  await page.route('**/api/v1/platform-admin/stats/', route => route.fulfill({ json: { data: {
    financials: { mrr_usd: 29, arr_usd: 348, quoted_organizations: 0 },
    organizations: { total: 2, recent_signups_30d: 1, by_plan: { pro: 1, free: 1 }, by_status: { active: 2 } },
    infrastructure: { total_users: 3, total_targets: 4, active_targets: 2, total_probes: 0, online_probes: 0 },
  } } }));
  const account = {
    id: 'member-fixture', email: 'member@example.test', name: 'Customer Member',
    organization_id: 'customer-fixture', organization_name: 'Customer Fixture',
    role: 'viewer', is_active: true, email_verified: true, mfa_enabled: false, last_login: null,
  };
  const accounts = [account, ...Array.from({ length: 24 }, (_, index) => ({
    ...account, id: `member-${index}`, email: `member-${index}@example.test`,
  }))];
  await page.route('**/api/v1/platform-admin/users/?*', route => route.fulfill({
    json: { data: { users: accounts, total: 26, page_size: 25 } },
  }));
  let submitted: object | undefined;
  await page.route('**/api/v1/platform-admin/users/member-fixture/action/', route => {
    expect(route.request().headers().authorization).toBe('Bearer controlled-platform-token');
    submitted = route.request().postDataJSON();
    return route.fulfill({ json: { success: true, data: { is_active: true } } });
  });
  await page.route('**/api/v1/platform-admin/audit-logs/?*', route => route.fulfill({
    json: { data: [{ id: 'event', timestamp: '2026-11-05T15:00:00Z', user_email: 'operator@example.test',
      module: 'platform_users', action: 'update', description: 'Acción de soporte registrada', organization_id: 'customer-fixture' }] },
  }));

  await page.goto('/admin/platform');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.getByLabel('Correo administrativo').fill('operator@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('Controlled-fixture-password');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByLabel('Código de autenticación').fill('123456');
  await page.getByRole('button', { name: 'Entrar a la consola', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Administración SaaS', exact: true })).toBeVisible();
  await expect(page.getByText('3 usuarios registrados en la plataforma.')).toBeVisible();
  const plans = page.getByRole('region', { name: 'Organizaciones por plan' });
  const pro = plans.getByRole('button', { name: /^Pro/ });
  await expect(pro).toContainText(/50\s*%/);
  await page.route('**/api/v1/platform-admin/organizations/?*', route => route.fulfill({ json: { data: [] } }));
  const filteredDirectory = page.waitForRequest(request =>
    new URL(request.url()).searchParams.get('plan_tier') === 'pro');
  await pro.click();
  await filteredDirectory;
  await expect(page.getByRole('button', { name: 'Organizaciones', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Usuarios', exact: true }).click();
  await expect(page.getByText('member@example.test', { exact: true })).toBeVisible();
  const content = page.getByRole('main', { name: 'Administración SaaS' });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await content.evaluate(element => { element.scrollTop = 0; });
    await content.focus();
    await page.keyboard.press('End');
    await expect(page.getByRole('button', { name: 'Siguiente', exact: true })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Cerrar sesión administrativa' })).toBeInViewport();
    await page.keyboard.press('Home');
    await expect(page.getByText('member@example.test', { exact: true })).toBeInViewport();
    expect(await content.evaluate(element => element.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByLabel('Acciones de member@example.test', { exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Cerrar sesiones web', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Cerrar sesiones web' });
  await expect(dialog.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
  await dialog.getByLabel('Motivo para la auditoría').fill('Soporte de prueba');
  await dialog.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByRole('status')).toContainText('Sesiones web cerradas');
  expect(submitted).toEqual({ action: 'revoke_sessions', reason: 'Soporte de prueba' });
  await page.getByRole('button', { name: 'Auditoría', exact: true }).click();
  await expect(page.getByText('Acción de soporte registrada')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión administrativa', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test('tenant administrator cannot open platform administration directly', async ({ page }) => {
  await loginFixture(page, false);
  await page.goto('/admin/platform');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole('heading', { name: 'Administración SaaS', exact: true })).toHaveCount(0);
});

test('superadmin enrollment confirms the password before displaying or activating the factor', async ({ page }) => {
  await loginFixture(page, true);
  const password = 'Controlled-fixture-password';
  await page.route('**/api/v1/auth/2fa/setup/', route => {
    expect(route.request().postDataJSON()).toEqual({ reset: false, password });
    return route.fulfill({ json: { data: { secret: 'controlled-factor-fixture' } } });
  });
  await page.route('**/api/v1/auth/2fa/verify/', route => {
    expect(route.request().postDataJSON()).toEqual({ code: '123456', password });
    return route.fulfill({ json: { data: { backup_codes: ['controlled-backup-fixture'] } } });
  });
  await page.goto('/profile?tab=security');
  const setup = page.getByRole('button', { name: 'Configurar Autenticación 2FA', exact: true });
  await expect(setup).toBeDisabled();
  await page.getByLabel('Contraseña actual', { exact: true }).fill(password);
  await setup.click();
  await page.getByPlaceholder('000 000').fill('123456');
  await page.getByRole('button', { name: 'Activar 2FA', exact: true }).click();
  await expect(page.getByText('controlled-backup-fixture', { exact: true })).toBeVisible();
  await expect(page.getByText('controlled-factor-fixture', { exact: true })).toHaveCount(0);
});
