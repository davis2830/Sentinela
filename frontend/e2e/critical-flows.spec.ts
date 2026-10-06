import { expect, request, test, type APIRequestContext, type Page } from '@playwright/test';

const browserApiURL = (process.env.E2E_BROWSER_API_URL || process.env.E2E_API_URL || 'http://127.0.0.1:8000/api/v1').replace(/\/$/, '');
const apiURL = `${browserApiURL}/`;
const suffix = process.env.E2E_FIXTURE_SUFFIX || 'local-beta-fixture';
const admin = { email: `e2e-admin-${suffix}@example.test`, password: 'E2e-Admin-Password-123!' };
const viewer = { email: `e2e-viewer-${suffix}@example.test`, password: 'E2e-Viewer-Password-123!' };
let api: APIRequestContext;
const fixtureSessions = new Map<string, { access_token: string; refresh_token: string; user: object }>();

async function login(page: Page, credentials: { email: string; password: string }, forceLogin = false) {
  const cached = fixtureSessions.get(credentials.email);
  if (cached && !forceLogin) {
    await page.addInitScript(session => {
      localStorage.setItem('access_token', session.access_token);
      localStorage.setItem('refresh_token', session.refresh_token);
      localStorage.setItem('auth-storage', JSON.stringify({ state: { user: session.user,
        accessToken: session.access_token, refreshToken: session.refresh_token, isAuthenticated: true }, version: 0 }));
    }, cached);
    await page.goto('/dashboard');
    return;
  }
  await page.goto('/login');
  await page.getByPlaceholder('usuario@dominio.com').fill(credentials.email);
  await page.getByPlaceholder('••••••••••••').fill(credentials.password);
  await page.getByRole('button', { name: 'Ingresar a la Plataforma' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function mockDashboard(page: Page, options: { securityFailure?: boolean } = {}) {
  const now = Date.now();
  let scanned = false;
  const iso = (offset = 0) => new Date(now + offset).toISOString();
  await page.route('**/api/v1/**', async (route) => {
    const requestUrl = new URL(route.request().url());
    const path = requestUrl.pathname.replace(/^.*\/api\/v1\//, '');
    const method = route.request().method();
    if (path.startsWith('auth/')) return route.continue();
    const fulfill = (data: unknown, status = 200) => {
      const scanAvailability = {status:scanned && path === 'monitoring/mon-down/' ? 'cooldown' : 'ready',next_allowed_at:scanned ? iso(300000) : null,retry_after_seconds:scanned ? 300 : null};
      if (/^(monitoring|api-checks|ssl-certificates|dns-records|domains|security-headers)\/(?:[^/]+\/)?$/.test(path) && method === 'GET') data = Array.isArray(data) ? data.map(item=>({...item, scan_availability:scanAvailability})) : {...data as object,scan_availability:scanAvailability};
      return route.fulfill({status,contentType:'application/json',body:JSON.stringify({data})});
    };
    if (path === 'monitoring/global-performance/') return fulfill({ period: '24h', summary: { avg_uptime: 98.75, avg_latency: 245, total_checks: 24, checks_per_minute: 2 }, points: [{ timestamp: now - 3_600_000, time: 'antes', uptime: 100, latency: 120, checks: 12, checks_per_minute: 2 }, { timestamp: now, time: 'ahora', uptime: 97.5, latency: 370, checks: 12, checks_per_minute: 2 }] });
    if (path === 'monitoring/' && method === 'GET') return fulfill([{ id: 'mon-down', organization: 'org', name: 'Public Web', target_type: 'https', endpoint: 'https://example.com', interval: 60, enabled: true, last_checked_at: iso(-7_200_000), last_status: 'down', last_latency: 920, runner_type: 'cloud', created_at: iso(-86_400_000), updated_at: iso() }, { id: 'mon-up', organization: 'org', name: 'Healthy Web', target_type: 'https', endpoint: 'https://healthy.example.com', interval: 60, enabled: true, last_checked_at: iso(-30_000), last_status: 'up', last_latency: 110, runner_type: 'cloud', created_at: iso(-86_400_000), updated_at: iso() }]);
    if (path === 'monitoring/mon-down/scan/' && method === 'POST') { scanned = true; return fulfill({ task_id: 'task-1', resource_id: 'mon-down', status: 'queued', submitted_at: iso(-1_000) }, 202); }
    if (path === 'monitoring/mon-down/' && method === 'GET') return fulfill({ id: 'mon-down', organization: 'org', name: 'Public Web', target_type: 'https', endpoint: 'https://example.com', interval: 60, enabled: true, last_checked_at: iso(), last_status: 'up', last_latency: 150, runner_type: 'cloud', created_at: iso(-86_400_000), updated_at: iso() });
    if (path === 'api-checks/') return fulfill([{ id: 'api-1', organization: 'org', name: 'Checkout API', url: 'https://example.com/api', method: 'GET', expected_status: 200, expected_response_time_ms: 500, check_interval: 60, enabled: true, last_checked_at: iso(-60_000), last_status: 'pass', last_response_time_ms: 180, last_http_status: 200, created_at: iso(-86_400_000), updated_at: iso() }]);
    if (path === 'ssl-certificates/') return fulfill([{ id: 'ssl-1', organization: 'org', domain: 'expiring.example.com', issuer: 'Test CA', expiration_date: iso(8 * 86_400_000), days_remaining: 8, is_valid: true, last_scanned_at: iso(-3_600_000), error_message: null, algorithm: 'RSA', created_at: iso(-86_400_000), updated_at: iso() }]);
    if (path === 'domains/') return fulfill([{ id: 'domain-1', organization: 'org', domain: 'unlocked.example.com', registrar: 'Registrar', expiration_date: iso(180 * 86_400_000), days_until_expiration: 180, is_locked: false, last_scanned_at: iso(-3_600_000), error_message: null, creation_date: null, last_updated: null, status: [], name_servers: [], registrant_country: null, created_at: iso(-86_400_000), updated_at: iso() }]);
    if (path === 'dns-records/') return fulfill([{ id: 'dns-1', organization: 'org', domain: 'example.com', record_type: 'A', value: '203.0.113.10', ttl: 300, last_scanned_at: iso(-60_000), last_change_at: iso(-7_200_000), created_at: iso(-86_400_000), updated_at: iso() }]);
    if (path === 'security-headers/' && options.securityFailure) return fulfill({ detail: 'unavailable' }, 500);
    if (path === 'security-headers/') return fulfill([{ id: 'sec-1', organization: 'org', name: 'Portal headers', url: 'https://example.com', enabled: true, last_checked_at: iso(-60_000), last_score: 55, last_grade: 'D', last_response_time_ms: 120, has_hsts: false, has_csp: false, has_xfo: true, info_leak_detected: true, server_header: 'test', powered_by_header: '', created_at: iso(-86_400_000), updated_at: iso() }]);
    if (path === 'agent-probes/') return fulfill([{ id: 'agent-1', name: 'Branch Agent', status: 'offline', is_online: false, last_heartbeat: iso(-10_800_000), ip_address: '203.0.113.20', hostname: 'branch-01', version: '1.0', os_info: 'linux', assigned_targets_count: 3, created_at: iso(-86_400_000), updated_at: iso() }]);
    if (path.startsWith('alerts/standalone/') && method === 'PATCH') return fulfill({ id: 'standalone', status: 'acknowledged' });
    if (path === 'alerts/') return fulfill([{ id: 'linked', organization: 'org', rule: null, title: 'Linked alert should be grouped', message: 'Grouped', severity: 'critical', status: 'active', target_type: 'monitoring', target_id: 'mon-down', occurrence_count: 2, last_seen_at: iso(), is_flapping: false, flapping_count: 0, snoozed_until: null, auto_resolved: false, metadata: {}, incident_id: 'incident-1', triggered_at: iso(-9_000_000), resolved_at: null, created_at: iso(-9_000_000) }, { id: 'standalone', organization: 'org', rule: null, title: 'Standalone Alert', message: 'Needs acknowledgment', severity: 'warning', status: 'active', target_type: 'api_check', target_id: 'api-1', occurrence_count: 1, last_seen_at: iso(), is_flapping: false, flapping_count: 0, snoozed_until: null, auto_resolved: false, metadata: {}, incident_id: null, triggered_at: iso(-4_000_000), resolved_at: null, created_at: iso(-4_000_000) }]);
    if (path === 'incidents/') return fulfill([{ id: 'incident-1', organization: 'org', title: 'Checkout outage', description: 'Customer checkout impacted', status: 'investigating', priority: 'critical', impacted_service: 'Checkout', opened_at: iso(-10_000_000), closed_at: null, alerts_count: 2, duration_minutes: 120, created_at: iso(-10_000_000), updated_at: iso() }]);
    if (path === 'maintenance/') return fulfill([{id:'maintenance-1',title:'Actualización programada',description:'Ventana de mantenimiento',status:'scheduled',start_time:iso(86400000),end_time:iso(90000000),duration_minutes:60,targets:[],updates:[],created_at:iso(),updated_at:iso()}]);
    if (path === 'notifications/') return fulfill([{id:'notification-1',title:'Entrega fallida',message:'No entregada',severity:'warning',status:'failed',channel_name:'Correo',created_at:iso(-3600000)}]);
    if (path === 'notifications/channels/') return fulfill([{id:'channel-1',name:'Correo operativo',description:'Alertas por correo',channel_type:'email',config:{to:['noc@example.test']},enabled:true,min_severity:'warning',subscribed_events:[],created_at:iso(),updated_at:iso()}]);
    if (path === 'reports/') return fulfill([{id:'report-1',title:'Reporte ejecutivo fallido',report_type:'summary',status:'failed',data:{},created_at:iso(-7200000),generated_at:null,error_message:'Falló el generador'}]);
    if (path === 'status-page/pages/') return fulfill([{id:'page-1',company_name:'Estado Sentinel',slug:'sentinel-e2e',is_public:true,is_default:true,published_components_count:2,subscribers_count:1,active_maintenances_count:0}]);
    if (/stats\/$/.test(path)) return fulfill({});
    if (path === 'audit-logs/') return fulfill([{ id: 'audit-1', user_email: admin.email, action: 'target.updated', module: 'monitoring', result: 'success', description: 'Intervalo actualizado', timestamp: iso(-1_800_000), metadata: {} }]);
    return route.continue();
  });
}

test.beforeAll(async () => {
  api = await request.newContext({ baseURL: apiURL });
  // Accounts are provisioned explicitly by the local-only management command.
  // Public registration must never provide an unverified JWT as a test shortcut.
  const registration = await api.post('auth/login/', {
    data: {
      email: admin.email,
      password: admin.password,
      first_name: 'Admin',
      last_name: 'E2E',
      organization_name: `Sentinel E2E ${suffix}`,
    },
  });
  expect(registration.ok()).toBeTruthy();
  fixtureSessions.set(admin.email, (await registration.json()).data);
  const viewerLogin = await api.post('auth/login/', { data: viewer });
  expect(viewerLogin.ok()).toBeTruthy();
  fixtureSessions.set(viewer.email, (await viewerLogin.json()).data);
});

test.afterAll(async () => {
  await api.dispose();
});

test('login loads the dashboard', async ({ page }) => {
  await mockDashboard(page);
  await login(page, admin, true);
  await expect(page.getByTestId('dashboard-page')).toBeVisible();
  await expect(page.getByTestId('dashboard-kpis')).toBeVisible();
  await expect(page.getByTestId('dashboard-attention-inbox')).toBeVisible();
  await expect(page.locator('table')).toHaveCount(0);
});

test('desktop charts fit the first viewport with account notices', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockDashboard(page);
  await page.route('**/organizations/current/subscription/', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ data: { subscription_status: 'past_due', is_in_trial: false, trial_days_remaining: 0, plan_name: 'Trial', plan_tier: 'free' } }),
  }));
  await login(page, admin);
  await expect(page.getByText('Prueba o suscripción vencida: operación bloqueada')).toBeVisible();
  await expect(page.getByTestId('dashboard-kpis')).toContainText('98.75%');
  const chart = await page.getByTestId('dashboard-performance').boundingBox();
  expect(chart).not.toBeNull();
  expect(chart!.y + chart!.height).toBeLessThan(900);
  await page.screenshot({ path: 'test-results/dashboard-compact-desktop.png' });
  await page.getByRole('button', { name: '1h', exact: true }).click();
  await expect(page.getByRole('button', { name: '1h', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Pausar auto-refresco' }).click();
  await expect(page.getByRole('button', { name: 'Activar auto-refresco' })).toHaveAttribute('aria-pressed', 'false');
});

test('dashboard filters the attention inbox and opens the unified drawer', async ({ page }) => {
  await mockDashboard(page);
  await login(page, admin);
  await expect(page.getByText('Linked alert should be grouped')).toHaveCount(0);
  await expect(page.getByText('Checkout outage')).toBeVisible();
  await page.getByTestId('dashboard-module-api').click();
  await expect(page.getByTestId('dashboard-filter-chips')).toContainText('API');
  await expect(page.getByText('Standalone Alert')).toBeVisible();
  await page.getByTestId('dashboard-health-donut').locator('.recharts-pie-sector').first().click({ position: { x: 60, y: 30 } });
  await expect(page.getByTestId('dashboard-view-all')).toHaveClass(/bg-bg-card/);
  await page.getByTestId('dashboard-module-api').click();
  await page.getByTestId('dashboard-attention-item').filter({ hasText: 'Healthy Web' }).getByRole('button').first().click();
  await expect(page.getByTestId('noc-drawer')).toBeVisible();
  await expect(page.getByTestId('noc-drawer')).toContainText('Última medición');
  await page.getByRole('button', { name: 'Cerrar panel' }).click();
  await expect(page.getByTestId('noc-drawer')).toHaveCount(0);
});

test('administrator can queue a scan and acknowledge an alert', async ({ page }) => {
  await mockDashboard(page);
  await login(page, admin);
  const webCard = page.getByTestId('dashboard-attention-item').filter({ hasText: 'Public Web' });
  await webCard.getByRole('button').first().click();
  await page.getByRole('button', { name: 'Comprobar ahora', exact: true }).click();
  await expect(page.getByText('Re-escaneo completado y datos actualizados.')).toBeVisible({ timeout: 7_000 });
  await page.getByRole('button', { name: 'Cerrar panel' }).click();
  const alertCard = page.getByTestId('dashboard-attention-item').filter({ hasText: 'Standalone Alert' });
  await alertCard.getByRole('button', { name: 'Reconocer' }).click();
  await expect(page.getByText('Alerta reconocida.')).toBeVisible();
});

test('viewer sees dashboard data without mutation controls', async ({ page }) => {
  await mockDashboard(page);
  await login(page, viewer);
  await expect(page.getByTestId('dashboard-attention-inbox')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Re-escanear' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reconocer' })).toHaveCount(0);
});

test('dashboard survives a partial endpoint failure', async ({ page }) => {
  await mockDashboard(page, { securityFailure: true });
  await login(page, admin);
  await expect(page.getByTestId('dashboard-page')).toBeVisible();
  await expect(page.getByText('Telemetría parcial:', { exact: false }).first()).toBeVisible();
  await expect(page.getByTestId('dashboard-attention-inbox').getByText('Public Web', { exact: true })).toBeVisible();
});

test('mobile dashboard keeps attention ahead of analytical charts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockDashboard(page);
  await login(page, admin);
  const attentionBox = await page.getByTestId('dashboard-attention-inbox').boundingBox();
  const donutBox = await page.getByTestId('dashboard-health-donut').boundingBox();
  expect(attentionBox).not.toBeNull();
  expect(donutBox).not.toBeNull();
  expect(attentionBox!.y).toBeLessThan(donutBox!.y);
  const overflow = await page.locator('main').evaluate((element) => element.scrollWidth > element.clientWidth);
  expect(overflow).toBe(false);
  await page.screenshot({ path: 'test-results/dashboard-compact-mobile.png' });
});

test('an administrator creates a monitoring target', async ({ page }) => {
  await login(page, admin);
  const skip = page.getByRole('button', { name: 'Omitir por ahora' });
  if (await skip.isVisible()) await skip.click();
  await page.goto('/monitoring');
  await page.getByRole('button', { name: 'Nuevo Target' }).click();
  await expect(page.getByRole('button', { name: 'Nube Sentinel (Público)' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardián Sentinine (Privado)' })).toBeVisible();
  await expect(page.locator('form')).not.toContainText('🌐');
  await expect(page.locator('form')).not.toContainText('🐕');
  const targetName = `E2E Public Target ${suffix}`;
  await page.getByPlaceholder('ej: DNS Corporativo LDAP / Portal Clientes').fill(targetName);
  await page.getByPlaceholder('https://mi-servicio.com').fill('https://example.com');
  await page.locator('form').getByRole('button', { name: 'Crear Target' }).click();
  await expect(page.getByText(targetName, { exact: true })).toBeVisible();
});

test('onboarding explains redirects without following the destination', async ({ page }) => {
  await mockDashboard(page);
  await page.route('**/api/v1/monitoring/', route => route.fulfill({ json: { data: [] } }));
  let destinationRequests = 0;
  page.on('request', request => { if (request.url().startsWith('http://127.0.0.1/private')) destinationRequests++; });
  await page.route('**/api/v1/monitoring/test-connection/', route => route.fulfill({ json: { data: { status: 'down', status_code: 308, latency_ms: 184, message: 'Código inesperado', redirect_location: 'http://127.0.0.1/private' } } }));
  await login(page, admin);
  await page.getByPlaceholder('https://miempresa.com o api.servicio.cl').fill('https://example.com');
  await page.getByRole('button', { name: 'Probar en Vivo' }).click();
  const dialog = page.getByRole('dialog', { name: 'Inicio guiado' });
  await expect(dialog).toContainText('Esta página te envía a otra dirección');
  await expect(dialog.getByText('HTTP 308.', { exact: false })).not.toBeVisible();
  await dialog.getByText('Detalles técnicos', { exact: true }).click();
  await expect(dialog).toContainText('No se siguió la redirección automáticamente por seguridad');
  await dialog.getByText('Detalles técnicos', { exact: true }).click();
  await expect(dialog).toContainText('http://127.0.0.1/private');
  expect(destinationRequests).toBe(0);
  const smallestSize = await dialog.locator('p, label').evaluateAll(elements => Math.min(...elements.map(element => parseFloat(getComputedStyle(element).fontSize))));
  expect(smallestSize).toBeGreaterThanOrEqual(12);
  await page.screenshot({ path: 'test-results/onboarding-readable-redirect.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(false);
  await page.screenshot({ path: 'test-results/onboarding-readable-mobile.png' });
  await dialog.getByRole('button', { name: 'Usar esta dirección', exact: true }).click();
  await expect(page.getByPlaceholder('https://miempresa.com o api.servicio.cl')).toHaveValue('http://127.0.0.1/private');
  expect(destinationRequests).toBe(0);
  await expect(dialog.getByText('HTTP 308')).toHaveCount(0);
});

test('redirect suggestion requires an explicit new test before being verified', async ({ page }) => {
  await mockDashboard(page);
  await page.route('**/api/v1/monitoring/', route => route.fulfill({ json: { data: [] } }));
  let tests = 0;
  await page.route('**/api/v1/monitoring/test-connection/', route => {
    tests++;
    const endpoint = route.request().postDataJSON().endpoint;
    return route.fulfill({ json: { data: endpoint === 'https://www.example.com/' ? { status: 'up', status_code: 200, latency_ms: 120 } : { status: 'down', status_code: 308, redirect_location: 'https://www.example.com/' } } });
  });
  await login(page, admin);
  await page.getByPlaceholder('https://miempresa.com o api.servicio.cl').fill('https://example.com/');
  await page.getByRole('button', { name: 'Probar en Vivo' }).click();
  await page.getByRole('button', { name: 'Usar esta dirección', exact: true }).click();
  await expect(page.getByPlaceholder('https://miempresa.com o api.servicio.cl')).toHaveValue('https://www.example.com/');
  expect(tests).toBe(1);
  await expect(page.getByText('Conexión verificada exitosamente', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Probar en Vivo' }).click();
  await expect(page.getByText('Conexión verificada exitosamente', { exact: true })).toBeVisible();
  expect(tests).toBe(2);
});

test('a viewer cannot mutate monitoring targets', async ({ page }) => {
  await login(page, viewer);
  const status = await page.evaluate(async (baseApiURL) => {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${baseApiURL}/monitoring/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Viewer must not create this',
        target_type: 'https',
        endpoint: 'https://example.com',
      }),
    });
    return response.status;
  }, browserApiURL);
  expect(status).toBe(403);
});

test('refresh only reads data and manual scans display the plan cooldown', async ({ page }) => {
  await mockDashboard(page);
  let scanRequests = 0;
  const waitMessage = 'Tu monitor ya fue comprobado. Podrás comprobarlo nuevamente en 4 min 20 s.';
  await page.route('**/api/v1/monitoring/mon-down/scan/', route => {
    scanRequests++;
    return route.fulfill({ status: 429, headers: { 'Retry-After': '260' }, json: { success: false, message: waitMessage, errors: { code: 'SCAN_COOLDOWN', retry_after_seconds: 260 } } });
  });
  await page.route('**/api/v1/monitoring/scan-all/', route => {
    scanRequests++;
    return route.fulfill({ json: { data: { queued_count: 0, skipped_count: 2, message: '0 comprobaciones encoladas; 2 recursos deben esperar.' } } });
  });
  await login(page, admin);
  await page.goto('/monitoring');
  await expect(page.getByText('Public Web', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Actualizar datos', exact: true }).click();
  expect(scanRequests).toBe(0);
  await expect(page.getByRole('button', { name: 'Comprobar disponibles', exact: true })).toHaveCount(0);
  await page.getByRole('row', { name: 'Public Web', exact: true }).first().click();
  await page.getByRole('button', { name: 'Comprobar ahora', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: waitMessage })).toBeVisible();
  expect(scanRequests).toBe(1);
  expect(scanRequests).toBe(1);
});

for (const module of ['monitoring', 'api-checks', 'ssl-certificates', 'dns-records', 'domains', 'security-headers']) {
  const routePath = { monitoring: '/monitoring', 'api-checks': '/api-checks', 'ssl-certificates': '/ssl', 'dns-records': '/dns', domains: '/domains', 'security-headers': '/security-headers' }[module];
  test(`Free ${module} reads every five minutes, not every fifteen seconds`, async ({ page }) => {
    await mockDashboard(page);
    await page.route('**/api/v1/organizations/current/subscription/', route => route.fulfill({ json: {
      data: { monitoring_allowed: true, plan_tier: 'free', subscription_status: 'active', limits: { min_check_interval_seconds: 300 } },
    } }));
    await login(page, admin);
    await page.clock.install();
    let reads = 0;
    let scans = 0;
    page.on('request', r => {
      if (new URL(r.url()).pathname === `/api/v1/${module}/` && r.method() === 'GET') reads++;
      if (r.method() === 'POST' && /\/scan(?:-all)?\/$/.test(new URL(r.url()).pathname)) scans++;
    });
    await page.goto(routePath!);
    await expect(page.getByText(/^En vivo: (5:00|4:5\d) min$/)).toBeVisible();
    await expect.poll(() => reads).toBeGreaterThan(0);
    const initialReads = reads;
    await page.clock.fastForward(16_000);
    await expect(page.getByText(/^En vivo: 4:4\d min$/)).toBeVisible();
    expect(reads).toBe(initialReads);
    await page.clock.fastForward(285_000);
    await expect.poll(() => reads).toBeGreaterThan(initialReads);
    await page.getByRole('button', { name: 'Actualizar datos', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'No se ejecutó una nueva comprobación.' })).toContainText('cada 5 minutos');
    expect(scans).toBe(0);
  });
}

test('Pro refresh follows the sixty second floor and updates after a plan change', async ({ page }) => {
  await mockDashboard(page);
  let floor = 60;
  await page.route('**/api/v1/organizations/current/subscription/', route => route.fulfill({ json: {
    data: { monitoring_allowed: true, plan_tier: floor === 60 ? 'pro' : 'free', limits: { min_check_interval_seconds: floor } },
  } }));
  await login(page, admin);
  await page.goto('/monitoring');
  await expect(page.getByText(/^En vivo: (1:00 min|5\d s)$/)).toBeVisible();
  floor = 300;
  await page.getByRole('button', { name: 'Actualizar datos', exact: true }).click();
  await expect(page.getByText(/^En vivo: (5:00|4:5\d) min$/)).toBeVisible();
});

test('missing cadence metadata disables automatic polling rather than assuming fifteen seconds', async ({ page }) => {
  await mockDashboard(page);
  await page.route('**/api/v1/organizations/current/subscription/', route => route.fulfill({ json: { data: { limits: {} } } }));
  await login(page, admin);
  await page.goto('/monitoring');
  await expect(page.getByText('Frecuencia no disponible', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Activar auto-refresco' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Actualizar datos', exact: true })).toBeEnabled();
});

test('empty administrator onboarding respects opt-outs and shows completion', async ({ page }) => {
  await mockDashboard(page);
  let submitted: { related_modules?: string[]; interval?: number } | undefined;
  let duplicatePosts = 0;
  await page.route('**/api/v1/monitoring/', async (route) => {
    if (route.request().method() === 'POST') submitted = route.request().postDataJSON();
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: route.request().method() === 'GET' ? [] : { id: 'onboarding-target' } }) });
  });
  await page.route('**/api/v1/monitoring/onboarding-target/scan/', (route) => route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ data: { status: 'queued', task_id: 'initial-scan' } }) }));
  page.on('request', (request) => {
    if (request.method() === 'POST' && /\/(ssl-certificates|dns-records|security-headers)\/$/.test(new URL(request.url()).pathname)) duplicatePosts++;
  });
  await login(page, admin);
  await expect(page.getByText('Despliegue Rápido de Observabilidad', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '5 min Recomendado para tu plan' })).toBeEnabled();
  await expect(page.getByRole('button', { name: '60 s Plan Pro', exact: true })).toBeDisabled();
  await page.getByPlaceholder('https://miempresa.com o api.servicio.cl').fill('https://example.com');
  await page.getByRole('button', { name: 'Siguiente: Cobertura' }).click();
  await page.getByText('Vigilancia Criptográfica SSL / TLS', { exact: true }).click();
  await page.getByText('Resolución & Mutaciones DNS', { exact: true }).click();
  await page.getByRole('button', { name: 'Lanzar Monitoreo (1-Clic)' }).click();
  await expect(page.getByText('Tu primer objetivo está registrado', { exact: true })).toBeVisible();
  expect(submitted?.related_modules).toEqual(['security']);
  expect(submitted?.interval).toBe(300);
  expect(duplicatePosts).toBe(0);
  await page.getByRole('button', { name: 'Ir al Tablero Principal' }).click();
  await page.reload();
  await expect(page.getByText('Despliegue Rápido de Observabilidad', { exact: true })).toHaveCount(0);
});

test('expired subscription shows explicit purchase requirement without onboarding', async ({ page }) => {
  await mockDashboard(page);
  await page.route('**/api/v1/monitoring/', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [] }) }));
  await page.route('**/api/v1/organizations/current/subscription/', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { monitoring_allowed: false, subscription_status: 'past_due', is_in_trial: false, trial_days_remaining: 0, plan_tier: 'pro', plan_name: 'Pro', limits: {}, usage: {} } }) }));
  await login(page, admin);
  await expect(page.getByText('No puedes agregar recursos ni escanear', { exact: false })).toBeVisible();
  await expect(page.getByText('Despliegue Rápido de Observabilidad', { exact: true })).toHaveCount(0);
});

test('Pro onboarding recommends sixty seconds and links to Plans', async ({ page }) => {
  await mockDashboard(page);
  await page.route('**/api/v1/monitoring/', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [] }) }));
  await page.route('**/api/v1/organizations/current/subscription/', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { monitoring_allowed: true, plan_tier: 'pro', plan_name: 'Pro / Growth', subscription_status: 'active', is_in_trial: false, limits: { min_check_interval_seconds: 60 }, usage: {} } }) }));
  await login(page, admin);
  await expect(page.getByRole('button', { name: '60 s Recomendado para tu plan' })).toBeEnabled();
  await expect(page.getByRole('button', { name: '30 s Plan Business', exact: true })).toBeDisabled();
  await page.getByRole('link', { name: 'Ver planes', exact: true }).click();
  await expect(page).toHaveURL(/\/organization\?tab=billing$/);
  await expect(page.getByRole('button', { name: 'Ver Todos los Planes & Upgrade' })).toBeVisible();
});

for (const path of ['/monitoring','/ssl','/dns','/domains','/api-checks','/security-headers','/alerts','/incidents','/maintenance','/notifications','/reports','/status-page']) {
  test('compact module ' + path + ' preserves GET-only reload', async ({page})=>{
    await mockDashboard(page); await login(page,admin); await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.compact-summary')).toBeVisible();
    await expect(page.locator('.metric-panel')).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Comprobar disponibles'})).toHaveCount(0);
    if (['/monitoring','/ssl','/dns','/domains','/api-checks','/security-headers'].includes(path)) {
      await expect(page.locator('.compact-summary-status')).toBeVisible();
      await expect(page.locator('.compact-summary-status .summary-icon').first()).toBeVisible();
      await expect(page.getByTestId('connectivity-table').getByRole('table')).toBeVisible();
      await expect(page.getByTestId('connectivity-table').getByRole('columnheader',{name:'Acciones',exact:true})).toBeVisible();
      await expect(page.getByTestId('connectivity-table').locator('button[title*="ahora"]')).toHaveCount(0);
    }
    if(path !== '/status-page') await expect(page.locator('.compact-resource-list, [data-testid="connectivity-table"]')).toBeVisible();
    let mutations = 0; page.on('request',r=>{if(/\/api\/v1\//.test(r.url()) && ['POST','PATCH','DELETE'].includes(r.method()) && !r.url().includes('/auth/')) mutations++;});
    await page.getByRole('button',{name:'Actualizar datos',exact:true}).click();
    await expect(page.getByRole('button',{name:'Actualizar datos',exact:true})).toBeEnabled(); expect(mutations).toBe(0);
  });
}

test('management dashboard deduplicates, filters and keeps charts in the desktop viewport',async({page})=>{
  await page.setViewportSize({width:1440,height:900}); await mockDashboard(page); await login(page,admin); await page.goto('/gestion');
  await expect(page.getByRole('heading',{name:'Resumen de gestión'})).toBeVisible();
  await expect(page.getByTestId('management-pending')).toContainText('Checkout outage');
  await expect(page.getByTestId('management-pending')).not.toContainText('Linked alert should be grouped');
  await expect(page.getByTestId('management-pending')).toContainText('Entrega fallida');
  await expect(page.getByTestId('management-agenda')).toContainText('Actualización programada');
  const chart = await page.getByTestId('management-incident-chart').boundingBox(); expect(chart!.y+chart!.height).toBeLessThan(900);
  await page.screenshot({path:'test-results/management-desktop.png'});
  await page.getByTestId('management-incident-chart').getByRole('link',{name:'Investigando 1',exact:true}).click();
  await expect(page).toHaveURL(/incidents\?status=investigating/);
  await expect(page.getByRole('button',{name:'Investigando',exact:false})).toHaveClass(/font-semibold/);
  await expect(page.locator('.compact-resource-list, [data-testid="connectivity-table"]')).toContainText('Checkout outage');
  await page.goto('/gestion');
  await page.getByTestId('management-alert-chart').getByRole('link',{name:'Advertencias 1',exact:true}).click();
  await expect(page).toHaveURL(/severity=warning/);
  await expect(page.locator('.compact-resource-list, [data-testid="connectivity-table"]')).toContainText('Standalone Alert');
  await expect(page.locator('.compact-resource-list, [data-testid="connectivity-table"]')).not.toContainText('Linked alert should be grouped');
});

test('management mobile prioritizes pending work and tolerates a partial outage',async({page})=>{
  await page.setViewportSize({width:390,height:844}); await mockDashboard(page);
  await page.route('**/api/v1/notifications/?status=failed',route=>route.fulfill({status:500,json:{message:'unavailable'}}));
  await login(page,admin); await page.goto('/gestion');
  await expect(page.getByRole('status').filter({hasText:'Algunos módulos no respondieron'})).toBeVisible();
  const pending = await page.getByTestId('management-pending').boundingBox(); const chart = await page.getByTestId('management-alert-chart').boundingBox(); expect(pending!.y).toBeLessThan(chart!.y);
  expect(await page.locator('main').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(false);
  await page.screenshot({path:'test-results/management-mobile.png'});
});

test('compact list preference, mobile layout, query scope and Viewer permissions',async({page})=>{
  await mockDashboard(page); await login(page,admin); await page.goto('/monitoring');
  await expect(page.locator('.compact-resource-list, [data-testid="connectivity-table"]')).toBeVisible();
  const summary = page.locator('.compact-summary-status');
  await expect(summary.getByRole('button')).toHaveCount(5);
  expect((await summary.boundingBox())!.height).toBeLessThan(65);
  await summary.getByRole('button',{name:'Online 1',exact:true}).focus();
  await page.keyboard.press('Space');
  await expect(summary.getByRole('button',{name:'Online 1',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByTestId('connectivity-table')).not.toContainText('Public Web');
  await summary.getByRole('button',{name:'Targets 2',exact:true}).click();
  await expect(page.getByTestId('connectivity-table')).toContainText('Public Web');
  await page.getByTitle('Cuadrícula',{exact:true}).click(); await page.reload();
  await expect(page.locator('.compact-resource-list, [data-testid="connectivity-table"]')).toHaveCount(0);
  await page.getByTitle('Lista',{exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.locator('aside').evaluate(el=>el.getBoundingClientRect().width)).toBeLessThan(80);
  expect(await page.locator('main').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(false);
  await page.screenshot({path:'test-results/module-mobile.png'});
  await page.setViewportSize({width:1440,height:900}); await page.goto('/monitoring?status=down&type=https');
  await expect(page.locator('.compact-resource-list, [data-testid="connectivity-table"]')).toContainText('Public Web'); await expect(page.locator('.compact-resource-list, [data-testid="connectivity-table"]')).not.toContainText('Healthy Web');
  const row = await page.locator('.compact-resource-row, [data-testid="connectivity-table"] tbody tr').first().boundingBox(); expect(row!.y+row!.height).toBeLessThan(900);
  await page.screenshot({path:'test-results/module-desktop.png'});
  await page.goto('/monitoring?status=invalid'); await expect(page.locator('.compact-resource-list, [data-testid="connectivity-table"]')).toContainText('Healthy Web');
});

test('Monitoring vivid palette separates brand and health with shared portal tokens', async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await mockDashboard(page); await login(page,admin); await page.goto('/monitoring');
  await expect(page.getByTestId('connectivity-table')).toContainText('Healthy Web');
  const brand = page.getByRole('button',{name:'Nuevo Target',exact:true});
  await expect(brand).toHaveCSS('background-color','rgb(0, 212, 170)');
  const online = page.getByTestId('connectivity-table').getByText('Online',{exact:true});
  await expect(online).toHaveCSS('color','rgb(74, 222, 128)');
  const summary = page.locator('.compact-summary-status .compact-summary-item[data-tone="success"] strong');
  await expect(summary).toHaveCSS('color','rgb(74, 222, 128)');
  // Actual rendered secondary text (not just token declarations) stays readable.
  const contrast = await page.getByTestId('connectivity-table').locator('.text-text-dim').first().evaluate(el => {
    const linear = (n:number) => { const s=n/255; return s<=.04045?s/12.92:((s+.055)/1.055)**2.4; };
    const luminance = (rgb:string) => {const c=rgb.match(/[\d.]+/g)!.slice(0,3).map(Number).map(linear); return .2126*c[0]+.7152*c[1]+.0722*c[2];};
    const fg=luminance(getComputedStyle(el).color);
    const bg=luminance(getComputedStyle(el.closest('[data-testid="connectivity-table"]')!).backgroundColor);
    return (Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({path:'test-results/monitoring-vivid-desktop.png'});
  await page.getByRole('button',{name:'Cuadrícula',exact:true}).click();
  await expect(page.getByTestId('connectivity-table')).toHaveCount(0);
  await page.screenshot({path:'test-results/monitoring-vivid-grid.png'});
  await page.getByRole('button',{name:'Lista',exact:true}).click();
  await page.getByRole('row',{name:'Public Web',exact:true}).first().click();
  await expect(page.getByRole('dialog',{name:'Public Web'})).toHaveCSS('--sentinel-accent-cyan','56 217 245');
  await page.screenshot({path:'test-results/monitoring-vivid-drawer.png'});
  await page.keyboard.press('Escape');
  await page.goto('/api-checks');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('.monitoring-workspace')).toHaveCount(0);
  expect(await page.locator('main').evaluate(el=>getComputedStyle(el).getPropertyValue('--sentinel-accent-green').trim())).toBe('0 212 170');
  await expect(page.locator('main .text-text-muted').first()).toHaveCSS('color','rgb(226, 232, 240)');
});

test('shared vivid palette and near-white secondary text reach all module groups', async ({page}) => {
  test.setTimeout(60000);
  await page.setViewportSize({width:1440,height:900});
  await mockDashboard(page); await login(page,admin);
  for (const path of ['/dashboard','/gestion','/ssl','/dns','/domains','/api-checks','/security-headers','/alerts','/incidents','/maintenance','/notifications','/reports','/status-page','/profile','/organization','/users','/audit-logs']) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    const text=page.locator('main .text-text-muted').first();
    await expect(text).toHaveCSS('color','rgb(226, 232, 240)');
    const dim=page.locator('main .text-text-dim:not(input):not(select):not(textarea)').first();
    if (await dim.count()) await expect(dim).toHaveCSS('color','rgb(203, 213, 225)');
    expect(await page.locator('main').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(false);
    if (['/dashboard','/gestion','/ssl','/profile'].includes(path)) await page.screenshot({path:`test-results/shared-palette-${path.slice(1)}-desktop.png`});
  }
  await page.setViewportSize({width:390,height:844});
  await page.goto('/gestion');
  await expect(page.getByTestId('management-pending')).toBeVisible();
  expect(await page.locator('main').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(false);
  await page.screenshot({path:'test-results/shared-palette-gestion-mobile.png'});
});

test('Monitoring vivid palette remains usable on mobile and filters keep their labels', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await mockDashboard(page); await login(page,admin); await page.goto('/monitoring');
  await expect(page.getByTestId('connectivity-table')).toContainText('Healthy Web');
  await page.locator('.compact-summary-status').getByRole('button',{name:'Caídos 1'}).click();
  await expect(page.getByTestId('connectivity-table')).toContainText('Public Web');
  await expect(page.getByTestId('connectivity-table')).not.toContainText('Healthy Web');
  expect(await page.locator('main').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(false);
  await page.screenshot({path:'test-results/monitoring-vivid-mobile.png'});
});

async function mockEndpointDossier(page:Page, options:{unlinked?:boolean;coverageFailure?:boolean;empty?:boolean}={}) {
  await mockDashboard(page);
  const now=new Date().toISOString();
  const resources:Record<string,Record<string,unknown>[]>={
    ssl:[{id:'ssl-1',domain:'example.com',port:443,issuer:'Test CA',subject:'example.com',last_scanned_at:now,is_valid:true,days_remaining:8,expiration_date:now,tls_version:'TLSv1.3'}],
    dns:[{id:'dns-1',domain:'example.com',record_type:'A',value:'203.0.113.10',ttl:300,last_scanned_at:now,last_change_at:now}],
    domain:[{id:'domain-1',domain:'example.com',registrar:'Configured registrar',last_scanned_at:now,is_locked:true,days_until_expiration:180}],
    security:[{id:'sec-1',url:'https://example.com',last_checked_at:now,last_score:55,last_grade:'D',has_hsts:false,has_csp:false,has_xfo:true,info_leak_detected:true}],
  };
  const selected:Record<string,string[]>={};
  for(const module of Object.keys(resources))selected[module]=options.unlinked?[]:resources[module].map(r=>String(r.id));
  await page.route('**/api/v1/**',async route=>{
    const url=new URL(route.request().url());const path=url.pathname.replace(/^.*\/api\/v1\//,'');
    const fulfill=(data:unknown,status=200)=>route.fulfill({status,json:{success:status===200,data}});
    if(path==='monitoring/mon-down/coverage/') {
      if(options.coverageFailure)return fulfill({message:'unavailable'},500);
      if(route.request().method()==='PATCH')Object.assign(selected,route.request().postDataJSON());
      return fulfill({sections:Object.fromEntries(Object.entries(resources).map(([module,items])=>[module,{
        status:selected[module].length?'linked':'unlinked',resources:items.filter(r=>selected[module].includes(String(r.id))),
        candidates:items.map(r=>({id:r.id,label:module==='security'?r.url:module==='dns'?`${r.domain} · ${r.record_type}`:r.domain})),candidates_truncated:false,
      }])),activity:{alerts:[{id:'linked',title:'Grouped SSL alert',severity:'critical',status:'active',incident_id:'incident-1',triggered_at:now}],incidents:[{id:'incident-1',title:'Associated outage',status:'investigating',opened_at:now}],changes:[{id:'change-1',description:'Coverage confirmed by admin',timestamp:now}]}});
    }
    if(path==='monitoring/mon-down/timeseries/')return fulfill({period:'24h',target_id:'mon-down',summary:{total_checks:options.empty?0:12,uptime_percentage:100,avg_latency:150,p50_latency:140,p90_latency:180,p99_latency:210,max_latency:220,min_latency:100,down_checks:0,up_checks:12,total_downtime_seconds:0,incidents_count:0},timeseries:[{timestamp:now,label:'ahora',avg_latency:150,max_latency:220,total_count:12,down_count:0,status:'up'}],daily_availability:[],incidents:[]});
    if(path==='monitoring/mon-down/checks/')return fulfill([{id:'check-1',status:'up',latency:150,checked_at:now}]);
    if(path==='security-headers/sec-1/results/')return fulfill([{id:'result-1',checked_at:now,headers_found:['X-Frame-Options'],headers_missing:['Content-Security-Policy'],directives_analysis:{hsts:{present:false,notes:'Missing HSTS'}},info_leaks:{server:{header:'Server',value:'test-server'}}}]);
    if(path==='dns-records/dns-1/history/')return fulfill([{id:'dns-change',changed_at:now,old_value:'203.0.113.9',new_value:'203.0.113.10'}]);
    for(const [module,items] of Object.entries(resources)){
      const routes:Record<string,string>={ssl:'ssl-certificates',dns:'dns-records',domain:'domains',security:'security-headers'};
      if(path===`${routes[module]}/${items[0].id}/`)return fulfill({...items[0],scan_availability:{status:'cooldown',next_allowed_at:new Date(Date.now()+300000).toISOString(),retry_after_seconds:300}});
    }
    return route.fallback();
  });
}

test('endpoint dossier opens from drawer, has all related data and preserves return filters',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await mockEndpointDossier(page);await login(page,admin);
  const writes:string[]=[];page.on('request',r=>{if(['POST','PATCH'].includes(r.method()))writes.push(r.url());});
  await page.goto('/monitoring?status=down&type=https');await page.getByRole('row',{name:'Public Web',exact:true}).click();
  await page.getByRole('link',{name:'Abrir vista completa del endpoint →'}).click();
  await expect(page.getByTestId('endpoint-dossier')).toBeVisible();await expect(page).toHaveURL(/\/monitoring\/mon-down\?/);
  await expect(page.getByRole('heading',{name:'Necesita atención'})).toBeVisible();
  await page.screenshot({path:'test-results/endpoint-dossier-desktop.png'});
  for(const [label,expected] of [['SSL / TLS','Test CA'],['DNS','203.0.113.10'],['Dominio','Configured registrar'],['Seguridad web','Content-Security-Policy']] ){
    await page.getByRole('navigation',{name:'Secciones del endpoint'}).getByRole('button',{name:label,exact:true}).click();
    await expect(page.getByTestId('endpoint-dossier')).toContainText(expected);
  }
  await page.screenshot({path:'test-results/endpoint-security-desktop.png'});
  await page.getByRole('navigation',{name:'Secciones del endpoint'}).getByRole('button',{name:'Actividad',exact:true}).click();
  await expect(page.getByTestId('endpoint-dossier')).toContainText('Associated outage');
  await expect(page.getByTestId('endpoint-dossier')).not.toContainText('Grouped SSL alert');
  expect(writes).toEqual([]);
  await page.getByRole('link',{name:'Volver al listado',exact:true}).click();
  await expect(page).toHaveURL(/\/monitoring\?status=down&type=https$/);
});

test('legacy dossier asks admin to confirm associations and persists only explicit choices',async({page})=>{
  await mockEndpointDossier(page,{unlinked:true});await login(page,admin);await page.goto('/monitoring/mon-down?tab=domain');
  await expect(page.getByTestId('endpoint-dossier')).toContainText('Un administrador debe confirmar');
  await expect(page.getByTestId('endpoint-dossier')).not.toContainText('Configured registrar');
  await page.getByRole('navigation',{name:'Secciones del endpoint'}).getByRole('button',{name:'Configuración',exact:true}).click();
  const section=page.getByRole('region',{name:'Asociación Dominio / WHOIS'});
  await section.getByRole('combobox',{name:'Recurso Dominio / WHOIS'}).selectOption('domain-1');
  const saved=page.waitForRequest(r=>r.method()==='PATCH'&&r.url().includes('/coverage/'));
  await section.getByRole('button',{name:'Guardar asociación'}).click();
  expect((await saved).postDataJSON()).toEqual({domain:['domain-1']});
  await page.getByRole('navigation',{name:'Secciones del endpoint'}).getByRole('button',{name:'Dominio',exact:true}).click();
  await expect(page.getByTestId('endpoint-dossier')).toContainText('Configured registrar');
  await page.reload();await expect(page.getByTestId('endpoint-dossier')).toContainText('Configured registrar');
});

test('viewer dossier has no mutations and keeps read-only navigation',async({page})=>{
  await mockEndpointDossier(page);await login(page,viewer);await page.goto('/monitoring/mon-down?tab=config');
  await expect(page.getByTestId('endpoint-dossier')).toContainText('Solo un administrador');
  await expect(page.getByRole('button',{name:'Guardar asociación'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Comprobar ahora',exact:true})).toHaveCount(0);
  await page.getByRole('navigation',{name:'Secciones del endpoint'}).getByRole('button',{name:'SSL / TLS',exact:true}).click();
  await expect(page.getByRole('link',{name:'Abrir módulo'})).toHaveAttribute('href','/ssl?resource=ssl-1');
  await expect(page.getByRole('button',{name:'Comprobar ahora',exact:true})).toHaveCount(0);
});

test('dossier tolerates missing coverage without fabricating health and refresh stays GET only',async({page})=>{
  await mockEndpointDossier(page,{coverageFailure:true,empty:true});await login(page,admin);await page.goto('/monitoring/mon-down');
  await expect(page.getByTestId('endpoint-dossier')).toContainText('Sin mediciones en este período');
  await expect(page.getByTestId('endpoint-dossier')).toContainText('No se pudo consultar la cobertura');
  const writes:string[]=[];page.on('request',r=>{if(r.method()!=='GET'&&r.method()!=='OPTIONS')writes.push(r.url());});
  await page.getByRole('button',{name:'Actualizar datos',exact:true}).click();
  expect(writes).toEqual([]);
  await expect(page.getByTestId('endpoint-dossier')).not.toContainText('100%');
});

test('dossier mobile has no overflow, preserves tab on reload and shows real cooldown',async({page})=>{
  await page.setViewportSize({width:390,height:844});await mockEndpointDossier(page);await login(page,admin);await page.goto('/monitoring/mon-down?tab=ssl');
  await expect(page.getByTestId('endpoint-dossier')).toContainText('Test CA');
  await expect(page.getByRole('status').filter({hasText:'Disponible en'})).toBeVisible();
  const sslButton=page.getByTestId('endpoint-dossier').getByTestId('scan-action').last().getByRole('button',{name:'Comprobar ahora',exact:true});
  await expect(sslButton).toBeDisabled();
  expect(await page.locator('main').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(false);
  await page.screenshot({path:'test-results/endpoint-dossier-mobile.png'});
  await page.reload();await expect(page.getByTestId('endpoint-dossier')).toContainText('Test CA');
});

test('dossier individual scan uses 202 and pending state until a newer timestamp',async({page})=>{
  await mockEndpointDossier(page);await login(page,admin);await page.goto('/monitoring/mon-down');
  const button=page.getByTestId('scan-action').first().getByRole('button',{name:'Comprobar ahora',exact:true});
  await expect(button).toBeEnabled();await button.click();
  await expect(page.getByTestId('scan-action').first()).toContainText('Comprobación pendiente');
  await expect(page.getByRole('status').filter({hasText:'Nueva medición recibida.'})).toBeVisible();
});

test('Viewer has no mutations in module lists or resource details',async({page})=>{
  await mockDashboard(page); await login(page,viewer); await page.goto('/monitoring');
  await expect(page.getByRole('button',{name:'Nuevo Target',exact:true})).toHaveCount(0);
  await expect(page.getByTitle('Editar target',{exact:true})).toHaveCount(0);
  await expect(page.getByTitle('Eliminar target',{exact:true})).toHaveCount(0);
  await expect(page.getByTitle('Pausar monitoreo',{exact:true})).toHaveCount(0);
  await page.getByRole('row',{name:'Public Web',exact:true}).first().click();
  await expect(page.getByRole('button',{name:'Comprobar ahora',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Editar',exact:true})).toHaveCount(0);
});

test('cooldown metadata disables individual scans and missing metadata fails closed',async({page})=>{
  await mockDashboard(page); await page.route('**/api/v1/monitoring/mon-down/',route=>route.fulfill({json:{data:{id:'mon-down',scan_availability:{status:'cooldown',next_allowed_at:new Date(Date.now()+260000).toISOString(),retry_after_seconds:260}}}}));
  await login(page,admin); await page.goto('/monitoring'); await page.getByRole('row',{name:'Public Web',exact:true}).first().click();
  await expect(page.getByRole('status').filter({hasText:'Disponible en'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Comprobar ahora',exact:true})).toBeDisabled();
  await page.screenshot({path:'test-results/scan-cooldown.png'});
});

for (const [status,message] of [
  ['pending','Comprobación pendiente'],
  ['disabled','Monitoreo pausado'],
  ['subscription_required','Suscripción no vigente'],
  ['agent_managed','Gestionado por Sentinine'],
  ['read_only','Solo lectura'],
] as const) {
  test('scan availability '+status+' disables the action',async({page})=>{
    await mockDashboard(page);
    await page.route('**/api/v1/monitoring/mon-down/',route=>route.fulfill({json:{data:{id:'mon-down',scan_availability:{status,next_allowed_at:null,retry_after_seconds:null}}}}));
    await login(page,admin); await page.goto('/monitoring');
    await page.getByRole('row',{name:'Public Web',exact:true}).first().click();
    await expect(page.getByTestId('scan-action')).toContainText(message);
    await expect(page.getByRole('button',{name:'Comprobar ahora',exact:true})).toBeDisabled();
  });
}

test('missing scan metadata fails closed and can recover through GET',async({page})=>{
  await mockDashboard(page); let missing = true; let posts = 0;
  await page.route('**/api/v1/monitoring/mon-down/',route=>route.fulfill({json:{data:missing?{id:'mon-down'}:{id:'mon-down',scan_availability:{status:'ready',next_allowed_at:null,retry_after_seconds:null}}}}));
  page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/scan/'))posts++;});
  await login(page,admin); await page.goto('/monitoring'); await page.getByRole('row',{name:'Public Web',exact:true}).first().click();
  await expect(page.getByTestId('scan-action')).toContainText('Disponibilidad no disponible');
  await expect(page.getByRole('button',{name:'Comprobar ahora',exact:true})).toBeDisabled();
  missing=false; await page.getByRole('button',{name:'Recargar disponibilidad'}).click();
  await expect(page.getByRole('button',{name:'Comprobar ahora',exact:true})).toBeEnabled(); expect(posts).toBe(0);
});

test('refresh preserves URL filters, selection and an open drawer',async({page})=>{
  await mockDashboard(page); await login(page,admin); await page.goto('/monitoring?status=down&type=https&resource=mon-down');
  const dialog=page.getByRole('dialog',{name:'Public Web'}); await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  await page.getByRole('checkbox',{name:'Seleccionar Public Web',exact:true}).check();
  await page.getByRole('row',{name:'Public Web',exact:true}).first().click();
  await expect(dialog).toBeVisible();
  // Simulate a background refresh without force-clicking coordinates occupied
  // by the modal's links. The real overlay intentionally blocks pointer input.
  await page.getByRole('button',{name:'Actualizar datos',exact:true}).dispatchEvent('click');
  await expect(dialog).toBeVisible(); await expect(page).toHaveURL(/status=down&type=https/);
  await page.keyboard.press('Escape'); await expect(page.getByRole('checkbox',{name:'Seleccionar Public Web',exact:true})).toBeChecked();
});

for (const path of ['/ssl','/dns','/domains','/api-checks','/security-headers','/alerts','/incidents','/maintenance','/notifications','/reports','/status-page']) {
  test('mobile module '+path+' has no page overflow',async({page})=>{
    await page.setViewportSize({width:390,height:844}); await mockDashboard(page); await login(page,admin); await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    if (['/ssl','/dns','/domains','/api-checks','/security-headers'].includes(path)) {
      await expect(page.locator('.compact-summary-status')).toBeVisible();
      await page.screenshot({path:`test-results/connectivity-${path.slice(1)}-mobile.png`});
    }
    expect(await page.locator('main').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(false);
  });
}
