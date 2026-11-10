import { expect, test, type Page } from '@playwright/test';
import {betaOverview} from './platform-fixtures';

async function navigate(page: Page, name: string, touch = false) {
  if((page.viewportSize()?.width || 1440)<768) {
    const menu=page.getByRole('button',{name:'Abrir menú administrativo',exact:true});
    if(touch)await menu.tap();else await menu.click();
  }
  const link=page.getByRole('link',{name,exact:true});
  if(touch)await link.tap();else await link.click();
}

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
  await page.route('**/api/v1/platform-admin/beta/overview/',route=>route.fulfill({json:{data:betaOverview}}));
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
  await page.route('**/api/v1/platform-admin/audit-options/', route => route.fulfill({
    json: { data: { actions: [{ id: 'update', label: 'Actualización' }], modules: [{ id: 'platform_users', label: 'Usuarios de plataforma' }] } },
  }));
  let submitted: object | undefined;
  await page.route('**/api/v1/platform-admin/users/member-fixture/action/', route => {
    expect(route.request().headers().authorization).toBe('Bearer controlled-platform-token');
    submitted = route.request().postDataJSON();
    return route.fulfill({ json: { success: true, data: { is_active: true } } });
  });
  await page.route('**/api/v1/platform-admin/audit-logs/?*', route => route.fulfill({
    json: { data: { events: [{ id: 'event', timestamp: '2026-11-05T15:00:00Z', user_email: 'operator@example.test', result: 'success',
      module: 'platform_users', action: 'update', description: 'Acción de soporte registrada', organization_id: 'customer-fixture' }], has_next: false } },
  }));

  await page.goto('/admin/platform');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.getByLabel('Correo administrativo').fill('operator@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('Controlled-fixture-password');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByLabel('Código de autenticación').fill('123456');
  await page.getByRole('button', { name: 'Entrar a la consola', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Resumen de plataforma', exact: true })).toBeVisible();
  await page.getByText('Contexto comercial',{exact:true}).click();
  await expect(page.getByText('Cuentas de clientes')).toBeVisible();
  const plans = page.getByRole('region', { name: 'Organizaciones por plan' });
  const pro = plans.getByRole('button', { name: /^Pro/ });
  await expect(pro).toContainText(/50\s*%/);
  await page.route('**/api/v1/platform-admin/organizations/?*', route => route.fulfill({ json: { data: [] } }));
  const filteredDirectory = page.waitForRequest(request =>
    new URL(request.url()).searchParams.get('plan_tier') === 'pro');
  await pro.click();
  await filteredDirectory;
  await expect(page.getByRole('link', { name: 'Organizaciones', exact: true })).toHaveAttribute('aria-current', 'page');
  await navigate(page, 'Usuarios');
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
  await page.getByLabel('Más acciones de member@example.test', { exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Cerrar sesiones web', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Cerrar sesiones web' });
  await expect(dialog.getByRole('button', { name: 'Cerrar sesiones web' })).toBeDisabled();
  await dialog.getByLabel('Motivo para la auditoría').fill('Soporte de prueba');
  await dialog.getByRole('button', { name: 'Cerrar sesiones web' }).click();
  await expect(page.getByRole('status')).toContainText('Sesiones web cerradas');
  expect(submitted).toEqual({ action: 'revoke_sessions', reason: 'Soporte de prueba' });
  await navigate(page, 'Auditoría');
  await page.getByLabel('Correo del usuario').fill('operator@example.test');
  await page.getByLabel('Organización (nombre o slug)').fill('customer');
  const auditRequest = page.waitForRequest(request => request.url().includes('/platform-admin/audit-logs/'));
  await page.getByRole('button', { name: 'Consultar auditoría', exact: true }).click();
  const auditUrl = new URL((await auditRequest).url());
  expect(auditUrl.searchParams.get('email')).toBe('operator@example.test');
  expect(auditUrl.searchParams.get('organization')).toBe('customer');
  expect(auditUrl.searchParams.get('page')).toBe('1');
  await expect(page.getByText('Acción de soporte registrada')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión administrativa', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test('tenant administrator cannot open platform administration directly', async ({ page }) => {
  await loginFixture(page, false);
  await page.goto('/admin/platform');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole('heading', { name: 'Resumen de plataforma', exact: true })).toHaveCount(0);
});

test('administrative login shares the user layout and keeps password visibility, errors and six-digit 2FA',async({page})=>{
  await page.route('**/api/v1/**',route=>route.fulfill({json:{data:[]}}));
  for(const size of [{width:1440,height:900},{width:1366,height:768},{width:390,height:844}]){
    await page.setViewportSize(size);
    await page.goto('/login');
    const userCard=page.getByRole('region',{name:'Iniciar Sesión',exact:true});
    const appearance=await userCard.evaluate(element=>{const style=getComputedStyle(element);return {background:style.backgroundColor,radius:style.borderRadius,padding:style.padding,width:element.getBoundingClientRect().width};});
    const userInputHeight=await page.getByLabel('Correo Electrónico',{exact:true}).evaluate(element=>element.getBoundingClientRect().height);
    await page.screenshot({path:`.tmp/platform-validation/login-user-${size.width}.png`,fullPage:true});
    await page.goto('/admin/login');
    const adminCard=page.getByRole('region',{name:'Acceso administrativo',exact:true});
    const adminAppearance=await adminCard.evaluate(element=>{const style=getComputedStyle(element);return {background:style.backgroundColor,radius:style.borderRadius,padding:style.padding,width:element.getBoundingClientRect().width};});
    expect(adminAppearance).toEqual(appearance);
    expect(await page.getByLabel('Correo administrativo').evaluate(element=>element.getBoundingClientRect().height)).toBe(userInputHeight);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
    await page.getByRole('button',{name:'Continuar',exact:true}).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button',{name:'Continuar',exact:true})).toBeInViewport();
    await page.screenshot({path:`.tmp/platform-validation/login-admin-${size.width}.png`,fullPage:true});
  }
  let attempts=0,verifications=0;
  await page.route('**/platform-admin/session/login/',route=>{attempts++;return route.fulfill(attempts===1 ? {status:429,json:{message:'Controlled throttle'}} : {json:{data:{challenge:'visual-fixture'}}});});
  await page.route('**/platform-admin/session/verify/',route=>{verifications++;return route.fulfill({status:400,json:{message:'Código de prueba inválido.'}});});
  await page.getByLabel('Correo administrativo').fill('operator@example.test');
  const password=page.getByLabel('Contraseña',{exact:true});
  await password.fill('Visual-fixture-only');
  await page.getByRole('button',{name:'Ver contraseña',exact:true}).click();
  await expect(password).toHaveAttribute('type','text');
  await page.getByRole('button',{name:'Ocultar contraseña',exact:true}).click();
  await expect(password).toHaveAttribute('type','password');
  await page.getByRole('button',{name:'Continuar',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Espera antes');
  await page.getByRole('button',{name:'Continuar',exact:true}).click();
  const code=page.getByLabel('Código de autenticación');
  await expect(code).toBeFocused();
  await expect(password).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Verificación 2FA',exact:true})).toBeVisible();
  await page.screenshot({path:'.tmp/platform-validation/login-admin-2fa-390.png',fullPage:true});
  await code.fill('12345');await page.getByRole('button',{name:'Entrar a la consola',exact:true}).click();
  expect(verifications).toBe(0);
  await code.fill('123456');await page.getByRole('button',{name:'Entrar a la consola',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Código de prueba inválido.');
  await page.getByRole('button',{name:'Volver a introducir credenciales',exact:true}).click();
  await expect(page.getByLabel('Contraseña',{exact:true})).toHaveValue('');
  await expect(page.getByLabel('Correo administrativo')).toHaveValue('operator@example.test');
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
