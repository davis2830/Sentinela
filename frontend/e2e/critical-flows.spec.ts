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

test('actual backend rejects Viewer mutations in every management area', async () => {
  const session = fixtureSessions.get(viewer.email)!;
  for (const path of ['alert-rules/', 'incidents/', 'maintenance/', 'notifications/channels/', 'reports/', 'status-page/pages/']) {
    const response = await api.post(path, { headers: { Authorization: `Bearer ${session.access_token}` }, data: {} });
    expect(response.status(), path).toBe(403);
  }
});

test('actual module lists load without mocked backend responses', async ({page}) => {
  await login(page, admin);
  const session = fixtureSessions.get(admin.email)!;
  for (const path of ['monitoring/', 'api-checks/', 'ssl-certificates/', 'dns-records/', 'domains/', 'security-headers/',
    'agent-probes/', 'alerts/', 'incidents/', 'maintenance/', 'notifications/channels/', 'reports/', 'status-page/pages/', 'audit-logs/']) {
    const response = await api.get(path, { headers: { Authorization: `Bearer ${session.access_token}` } });
    expect(response.ok(), path).toBeTruthy();
    expect((await response.json()).success, path).toBe(true);
  }
});

test('empty Status Page requires explicit creation without GET-side publishing', async ({page}) => {
  let writes = 0;
  page.on('request', request => {
    if (request.url().includes('/status-page/') && ['POST','PATCH','DELETE'].includes(request.method())) writes++;
  });
  await login(page, admin);
  await page.goto('/status-page');
  await expect(page.getByRole('status')).toContainText('Nada se publica automáticamente');
  await expect(page.getByRole('button', {name: 'Nueva Status Page'})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Ver en Vivo'})).toHaveCount(0);
  expect(writes).toBe(0);
});

test('public Status Page never invents availability or latency when unmeasured', async ({page}) => {
  await page.route('**/api/v1/status-page/public/audit-ui/', route=>route.fulfill({json:{success:true,data:{
    company_name:'Audit UI', description:'', logo_url:'', website_url:'', support_email:'',
    system_status:'unknown', system_status_label:'Información de monitoreo insuficiente',
    global_uptime_pct:null, global_avg_latency_ms:null, total_services_count:1, operational_services_count:0,
    services:[{id:'new',name:'Servicio nuevo',type:'uptime',current_status:'unknown',uptime_90_days_pct:null,
      avg_latency_24h_ms:null,history_90_days:[{date:'2026-10-07',status:'unknown',uptime_pct:null,total_checks:0}]}],
    active_incidents:[],past_incidents:[],maintenances:[],show_uptime_pct:true,show_latency_24h:true,updated_at:new Date().toISOString(),
  }}}));
  await page.goto('/status/audit-ui');
  await expect(page.locator('.bg-bg-card').first()).toHaveCSS('background-color','rgb(16, 24, 32)');
  await expect(page.getByText('Información de monitoreo insuficiente')).toBeVisible();
  await expect(page.getByText('Sin mediciones', {exact:true}).first()).toBeVisible();
  await expect(page.getByText('100%', {exact:true})).toHaveCount(0);
  await expect(page.getByText('< 50ms', {exact:true})).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('performance separates readable tracks and shows a unified tooltip on desktop and mobile', async ({page}) => {
  await mockDashboard(page); await login(page, admin);
  const chart=page.getByTestId('dashboard-performance');
  await expect(chart.getByRole('img',{name:'Latencia histórica en milisegundos'})).toBeVisible();
  await expect(chart.getByRole('img',{name:'Disponibilidad histórica de cero a cien por ciento'})).toBeVisible();
  await expect(chart).toContainText('2/min');
  await expect(chart).not.toContainText('undefined');
  await expect(chart).not.toContainText('Sin mediciones en este período');
  const dot=await chart.locator('.recharts-area-dot').first().boundingBox();
  const bar=await chart.locator('.recharts-bar-rectangle').first().boundingBox();
  expect(Math.abs((dot!.x+dot!.width/2)-(bar!.x+bar!.width/2))).toBeLessThan(2);
  for(const [name,point] of [
    ['Latencia histórica en milisegundos','.recharts-area-dot'],
    ['Disponibilidad histórica de cero a cien por ciento','.recharts-line-dot'],
    ['Comprobaciones por minuto y eje de tiempo','.recharts-bar-rectangle'],
  ]) {
    const track=chart.getByRole('img',{name});
    await track.scrollIntoViewIfNeeded();
    const mark=await track.locator(point).first().boundingBox();
    // A synchronized active dot can cover the underlying dot; move the real
    // pointer to that position instead of asking Playwright to hit the base SVG.
    await page.mouse.move(mark!.x+mark!.width/2,mark!.y+mark!.height/2);
    await expect(page.getByTestId('performance-tooltip')).toHaveCount(1);
    await expect(track.getByTestId('performance-tooltip')).toContainText('Comprobaciones');
    await expect(chart.locator('.recharts-tooltip-cursor')).toHaveCount(3);
  }
  await chart.screenshot({path:'test-results/performance-single-tooltip.png'});
  await page.mouse.move(0,0);
  await expect(page.getByTestId('performance-tooltip')).toHaveCount(0);
  // Keyboard focus must show only the focused track's information as well.
  const latency=chart.getByRole('img',{name:'Latencia histórica en milisegundos'});
  await latency.locator('svg.recharts-surface').focus();await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('performance-tooltip')).toHaveCount(1);
  await expect(latency.getByTestId('performance-tooltip')).toBeVisible();
  await page.getByRole('button',{name:'1h',exact:true}).focus();
  await expect(page.getByTestId('performance-tooltip')).toHaveCount(0);
  await chart.screenshot({path:'test-results/performance-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.locator('main').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(false);
  await chart.scrollIntoViewIfNeeded();
  // Axis labels remain inside their SVG, including the full 100% label.
  await expect(chart.locator('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value').first()).toBeVisible();
  for(const tick of await chart.locator('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value').all()) {
    const box=await tick.boundingBox();const svg=await tick.locator('xpath=ancestor::*[local-name()="svg"]').boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(svg!.x); expect(box!.x+box!.width).toBeLessThanOrEqual(svg!.x+svg!.width);
  }
  await chart.screenshot({path:'test-results/performance-mobile.png'});
});

test('performance empty, missing-rate and failed responses do not show fabricated curves', async ({page}) => {
  await mockDashboard(page);
  let mode='empty';
  await page.route('**/api/v1/monitoring/global-performance/**',route=>route.fulfill({status:mode==='error'?500:200,json:{data:{summary:{total_checks:mode==='empty'?0:2},points:[{time:'12:00',timestamp:Date.now(),uptime:100,latency:120,checks:mode==='empty'?0:2}]}}}));
  await login(page,admin);const chart=page.getByTestId('dashboard-performance');
  await expect(chart).toContainText('Sin mediciones en este período');
  await expect(chart.locator('svg.recharts-surface')).toHaveCount(0);
  mode='missing'; await page.reload();
  await expect(chart).toContainText('Promedio no disponible');
  await expect(chart).toContainText('El ritmo de comprobaciones no está disponible');
  await expect(chart).not.toContainText('undefined');
  mode='error';await page.reload();
  await expect(chart).toContainText('Telemetría no disponible');
  await expect(chart.locator('svg.recharts-surface')).toHaveCount(0);
});

test('performance retains measured points and time ticks across long sparse ranges', async ({page}) => {
  await mockDashboard(page);
  await page.route('**/api/v1/monitoring/global-performance/**',route=>{
    const period=new URL(route.request().url()).searchParams.get('period')||'24h';
    const slots=period==='7d'?28:24;const step=(period==='7d'?6:period==='6h'?0.25:period==='1h'?0.05:1)*3600000;
    const now=Date.now();
    const points=Array.from({length:slots+1},(_,index)=>({timestamp:now-(slots-index)*step,time:'hora',uptime:index>=slots-3?100:null,latency:index>=slots-3?250:null,checks:index>=slots-3?5:0,checks_per_minute:index>=slots-3?0.08:0}));
    return route.fulfill({json:{data:{period,summary:{total_checks:20,avg_uptime:100,avg_latency:250,checks_per_minute:0.02},points}}});
  });
  await login(page,admin);const chart=page.getByTestId('dashboard-performance');
  for(const period of ['24h','1h','6h','7d']) {
    await page.getByRole('button',{name:period,exact:true}).click();
    await expect(chart).toContainText('Monitoring · '+period);
    await expect(chart.locator('.recharts-area-dot')).toHaveCount(4);
    await expect(chart.locator('.recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value').first()).toBeVisible();
    const bar=await chart.locator('.recharts-bar-rectangle').last().boundingBox();expect(bar!.height).toBeGreaterThan(1);
  }
  await page.getByRole('button',{name:'24h',exact:true}).click();
  await chart.screenshot({path:'test-results/performance-sparse-24h.png'});
});

test('health and module charts show all states and preserve keyboard filters',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await mockDashboard(page);await login(page,admin);
  const donut=page.getByTestId('dashboard-health-donut');
  await donut.locator('.recharts-pie-sector').first().hover({position:{x:60,y:30}});
  const tip=donut.getByTestId('dashboard-health-tooltip');
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('Saludables');
  await expect(tip.locator('xpath=..')).toHaveCSS('z-index','30');
  await expect(tip.locator('xpath=..')).toHaveCSS('pointer-events','none');
  // Compare paint order where the tooltip overlaps the center: the tooltip
  // must paint above the reset button, without disabling that button.
  await expect(tip).toHaveCSS('background-color','rgb(9, 13, 17)');
  expect(await tip.evaluate(element=>{
    const center=element.closest('section')!.querySelector('[data-testid="dashboard-donut-reset"]')!;
    const a=element.getBoundingClientRect(),b=center.getBoundingClientRect();
    const left=Math.max(a.left,b.left),right=Math.min(a.right,b.right),top=Math.max(a.top,b.top),bottom=Math.min(a.bottom,b.bottom);
    if(right<=left||bottom<=top)return false;
    const wrapper=element.parentElement!;const previous=wrapper.style.pointerEvents;
    try {
      wrapper.style.pointerEvents='auto';
      return element.contains(document.elementFromPoint((left+right)/2,(top+bottom)/2));
    } finally {wrapper.style.pointerEvents=previous;}
  })).toBe(true);
  await donut.screenshot({path:'test-results/health-tooltip-desktop.png'});
  await page.mouse.move(0,0);
  await expect(donut.getByTestId('dashboard-health-unknown')).toContainText('0');
  await expect(donut.getByTestId('dashboard-donut-reset')).toContainText('25%');
  const degraded=donut.getByTestId('dashboard-health-degraded');await degraded.focus();await page.keyboard.press('Space');
  await expect(degraded).toHaveAttribute('aria-pressed','true');
  await page.getByTestId('dashboard-donut-reset').click();
  await expect(degraded).toHaveAttribute('aria-pressed','false');
  await expect(page.getByTestId('dashboard-module-web').getByRole('img')).toHaveAttribute('aria-label',/Caídos: 1/);
  await expect(page.getByTestId('dashboard-module-tcp')).toContainText('Sin recursos');
  await page.screenshot({path:'test-results/dashboard-charts-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.locator('main').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(false);
  await donut.locator('.recharts-pie-sector').first().hover({position:{x:60,y:30}});
  await expect(tip).toBeVisible();
  await expect(tip.locator('xpath=..')).toHaveCSS('z-index','30');
  await donut.screenshot({path:'test-results/health-tooltip-mobile.png'});
  await page.mouse.move(0,0);
  await donut.screenshot({path:'test-results/dashboard-health-mobile.png'});
});

test('health charts never invent resources or interpret missing endpoints as healthy',async({page})=>{
  await mockDashboard(page);
  let mode='empty';
  for(const path of ['monitoring','api-checks','ssl-certificates','domains','dns-records','security-headers','agent-probes']) {
    await page.route('**/api/v1/'+path+'/',route=>route.fulfill({status:mode==='failed'&&path==='security-headers'?500:200,json:{data:mode==='unknown'&&path==='monitoring'?[{id:'unmeasured',name:'No measurements yet',target_type:'https',endpoint:'https://example.com',enabled:true,interval:300,last_checked_at:null,last_status:null}]:[]}}));
  }
  await login(page,viewer);const donut=page.getByTestId('dashboard-health-donut');
  await expect(donut).toContainText('Todavía no hay recursos configurados');
  await expect(donut.getByTestId('dashboard-health-unknown')).toContainText('0');
  await expect(donut.getByTestId('dashboard-health-healthy')).toBeDisabled();
  mode='unknown';await page.reload();
  await expect(donut.getByTestId('dashboard-health-unknown')).toContainText('1');
  await expect(page.getByTestId('dashboard-module-web')).toContainText('Sin mediciones completas');
  mode='failed';await page.reload();
  await expect(donut).toContainText('Estado incompleto');
  await expect(donut.getByTestId('dashboard-health-healthy')).toBeDisabled();
  await expect(page.getByTestId('dashboard-module-security')).toContainText('No disponible');
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
  await expect(page.getByRole('button', { name: 'Activar auto-refresco' })).toBeDisabled();
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
  await page.getByRole('button', { name: 'Probar configuración' }).click();
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
  await page.getByRole('button', { name: 'Probar configuración' }).click();
  await page.getByRole('button', { name: 'Usar esta dirección', exact: true }).click();
  await expect(page.getByPlaceholder('https://miempresa.com o api.servicio.cl')).toHaveValue('https://www.example.com/');
  expect(tests).toBe(1);
  await expect(page.getByText('Conexión verificada exitosamente', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Probar configuración' }).click();
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

test('automatic refresh is discreet and keeps its countdown in the tooltip',async({page})=>{
  await mockDashboard(page); await login(page,admin);
  const control=page.getByTestId('automatic-refresh-control');
  await expect(control).toHaveText('Actualización automática activa');
  await expect(control).toHaveAttribute('title',/Próxima consulta en/);
  await expect(page.getByText(/^Datos consultados hace/)).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});

for(const setup of [
  {path:'/monitoring',button:'Nuevo Target',placeholder:'https://mi-servicio.com',endpoint:'monitoring/test-connection/',data:{status:'up',message:'OK',latency_ms:42}},
  {path:'/ssl',button:'Nuevo Certificado',placeholder:'ej. api.tuempresa.com',endpoint:'ssl-certificates/test-connection/',data:{is_valid:true,domain:'example.com',port:443}},
  {path:'/dns',button:'Nuevo Registro',placeholder:'ej. api.empresa.com o mail.empresa.com',endpoint:'dns-records/test-resolution/',data:{success:true,domain:'example.com',record_type:'A',values:['203.0.113.1']}},
  {path:'/domains',button:'Registrar Dominio',placeholder:'ej. empresa.com o micoope.com.gt',endpoint:'domains/test-whois/',data:{success:true,domain:'example.com',name_servers:[],status:[]}},
  {path:'/api-checks',button:'Nuevo API Check',placeholder:'ej. https://api.micoope.com.gt/v1/health',endpoint:'api-checks/test-request/',data:{success:true,status_code:200,headers:{},body:{ok:true},is_json:true,size_bytes:10,response_time_ms:42}},
  {path:'/security-headers',button:'Nuevo Endpoint',placeholder:'ej. https://portal.miempresa.com',endpoint:'security-headers/test-headers/',data:{success:true,http_status:200,headers_found:{},headers_missing:[],info_leaks:{},grade:'A',score:100,response_time_ms:42}},
]) test(`configuration preview ${setup.path} clearly distinguishes reuse and rate limits`,async({page})=>{
  await mockDashboard(page); await login(page,admin); await page.goto(setup.path);
  await page.getByRole('button',{name:setup.button,exact:true}).click();
  await page.getByPlaceholder(setup.placeholder,{exact:true}).fill(setup.path==='/monitoring'||setup.path==='/api-checks'||setup.path==='/security-headers'?'https://example.com':'example.com');
  if(setup.path==='/monitoring')await page.getByRole('button',{name:'Probar configuración',exact:true}).click();
  let tests=0;
  await page.route(`**/api/v1/${setup.endpoint}`,route=>{
    tests++;
    return route.fulfill(tests===3 ? {status:429,json:{message:'Has realizado varias pruebas seguidas. Puedes guardar el monitor ahora o volver a probar en 20 segundos.',errors:{code:'DIAGNOSTIC_RATE',retry_after_seconds:20}}} : {json:{data:setup.data,diagnostic:{cached:tests===2,checked_at:new Date().toISOString()}}});
  });
  const testButton=page.getByRole('button',{name:'Probar configuración',exact:true}).first();
  await testButton.click();
  const notice=page.getByTestId('configuration-diagnostic-notice');
  await expect(notice).toContainText('Configuración probada');
  await testButton.click();
  await expect(notice).toContainText('Resultado reciente reutilizado');
  await testButton.click();
  await expect(notice).toContainText('Guardar sigue disponible');
  await expect(page.getByRole('status').filter({hasText:'Has realizado varias pruebas seguidas.'})).toHaveCount(1);
  await expect(page.locator('button[type="submit"]').last()).toBeEnabled();
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  await page.screenshot({path:`test-results/configuration-preview-${setup.path.slice(1)}.png`});
});

test('saved API details do not expose a preview bypass of the scan cooldown',async({page})=>{
  await mockDashboard(page); await login(page,admin); await page.goto('/api-checks');
  await page.getByRole('row',{name:'Checkout API',exact:true}).click();
  await expect(page.getByRole('button',{name:'Comprobar ahora',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/Test en Vivo|Lanzar Petición/})).toHaveCount(0);
});

test('API preview requires explicit confirmation for a mutating method and never retries automatically',async({page})=>{
  await mockDashboard(page); await login(page,admin); await page.goto('/api-checks');
  await page.getByRole('button',{name:'Nuevo API Check',exact:true}).click();
  await page.getByPlaceholder('ej. https://api.micoope.com.gt/v1/health').fill('https://example.com');
  await page.locator('select').filter({has:page.locator('option[value="POST"]')}).selectOption('POST');
  let posts=0;
  await page.route('**/api/v1/api-checks/test-request/',route=>{
    posts++;
    expect(route.request().postDataJSON().confirm_side_effects).toBe(true);
    return route.fulfill({json:{data:{success:true,status_code:200,headers:{},body:{ok:true},is_json:true,size_bytes:10,response_time_ms:42}}});
  });
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByRole('button',{name:'Probar configuración',exact:true}).click();
  await expect(page.getByTestId('configuration-diagnostic-notice')).toContainText('Prueba cancelada');
  expect(posts).toBe(0);
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Probar configuración',exact:true}).click();
  await expect.poll(()=>posts).toBe(1);
  await page.waitForTimeout(500);
  expect(posts).toBe(1);
});

test('onboarding can continue and save after the configuration preview budget is exhausted',async({page})=>{
  await mockDashboard(page);
  let created=0;
  await page.route('**/api/v1/monitoring/',route=>{
    if(route.request().method()==='POST')created++;
    return route.fulfill({json:{data:route.request().method()==='GET'?[]:{id:'configuration-preview-new'}}});
  });
  await page.route('**/api/v1/monitoring/test-connection/',route=>route.fulfill({status:429,json:{message:'Puedes guardar el monitor ahora o volver a probar en 20 segundos.',errors:{code:'DIAGNOSTIC_RATE',retry_after_seconds:20}}}));
  await page.route('**/api/v1/monitoring/configuration-preview-new/scan/',route=>route.fulfill({status:202,json:{data:{status:'queued',task_id:'initial-check'}}}));
  await login(page,admin);
  await page.getByPlaceholder('https://miempresa.com o api.servicio.cl').fill('https://example.com');
  await page.getByRole('button',{name:'Probar configuración',exact:true}).click();
  await expect(page.getByTestId('configuration-diagnostic-notice')).toContainText('Guardar sigue disponible');
  await page.getByRole('button',{name:'Siguiente: Cobertura'}).click();
  await page.getByRole('button',{name:'Lanzar Monitoreo (1-Clic)'}).click();
  await expect.poll(()=>created).toBe(1);
});

async function areaDeadline(page: Page, area: string) {
  return page.evaluate(area => {
    const key = Object.keys(sessionStorage).find(key => key.startsWith('sentinel:refresh:') && key.endsWith(`:${area}`));
    return key ? JSON.parse(sessionStorage.getItem(key)!).nextAt as number : null;
  }, area);
}

for (const floor of [60, 300]) for (const failed of [false, true]) {
  test(`manual GET preserves shared ${floor}s deadline even when failed=${failed}`, async ({page}) => {
    await mockDashboard(page);
    await page.route('**/api/v1/organizations/current/subscription/', route => route.fulfill({json:{data:{monitoring_allowed:true,limits:{min_check_interval_seconds:floor}}}}));
    await login(page,admin); await page.clock.install();
    await expect(page.getByRole('button',{name:'Pausar auto-refresco'})).toBeVisible();
    const deadline = await areaDeadline(page,'connectivity');
    await page.clock.fastForward(12000);
    await page.goto('/monitoring');
    await expect(page.getByRole('button',{name:'Pausar auto-refresco'})).toBeVisible();
    expect(await areaDeadline(page,'connectivity')).toBe(deadline);
    let scans = 0;
    page.on('request', r => { if(r.method()==='POST' && /\/scan(?:-all)?\/$/.test(new URL(r.url()).pathname)) scans++; });
    if(failed) await page.route('**/api/v1/monitoring/',route=>route.fulfill({status:503,json:{detail:'unavailable'}}));
    await page.getByRole('button',{name:'Actualizar datos',exact:true}).click();
    await expect(page.getByRole('button',{name:'Actualizar datos',exact:true})).toBeEnabled();
    expect(await areaDeadline(page,'connectivity')).toBe(deadline);
    await page.goto('/ssl');
    await expect(page.getByRole('button',{name:'Pausar auto-refresco'})).toBeVisible();
    expect(await areaDeadline(page,'connectivity')).toBe(deadline);
    expect(scans).toBe(0);
  });
}

test('failed plan revalidation suspends reads without changing the Pro deadline',async({page})=>{
  await mockDashboard(page);
  let fail=false;
  await page.route('**/api/v1/organizations/current/subscription/',route=>route.fulfill(fail ? {status:503,json:{detail:'unavailable'}} : {json:{data:{monitoring_allowed:true,limits:{min_check_interval_seconds:60}}}}));
  await login(page,admin); await page.clock.install(); await page.goto('/monitoring');
  await expect(page.getByTestId('automatic-refresh-control')).toContainText('Actualización automática');
  const deadline=await areaDeadline(page,'connectivity');
  fail=true;
  await page.getByRole('button',{name:'Actualizar datos',exact:true}).click();
  await expect(page.getByRole('button',{name:'Actualizar datos',exact:true})).toBeEnabled();
  await expect(page.getByTestId('automatic-refresh-control')).toBeDisabled();
  expect(await areaDeadline(page,'connectivity')).toBe(deadline);
  fail=false;
  await page.getByRole('button',{name:'Actualizar datos',exact:true}).click();
  await expect(page.getByTestId('automatic-refresh-control')).toBeEnabled();
  expect(await areaDeadline(page,'connectivity')).toBe(deadline);
});

for(const path of ['/alerts','/incidents','/maintenance','/notifications','/reports','/status-page']) test(`Management ${path} shares a thirty second deadline and does not poll inactive Connectivity`, async ({page}) => {
  await mockDashboard(page); await login(page,admin); await page.clock.install();
  await page.goto('/gestion');
  await expect(page.getByTestId('automatic-refresh-control')).toContainText('Actualización automática');
  const deadline = await areaDeadline(page,'management');
  await page.clock.fastForward(10000);
  await page.goto(path);
  await expect(page.getByTestId('automatic-refresh-control')).toHaveAttribute('title', /(?:19|20) s/);
  expect(await areaDeadline(page,'management')).toBe(deadline);
  let areaReads=0, monitoringReads=0;
  page.on('request',r=>{if(r.method()==='GET'){const path=new URL(r.url()).pathname;if(path.startsWith('/api/v1/'))areaReads++;if(path==='/api/v1/monitoring/')monitoringReads++;}});
  await page.getByRole('button',{name:'Actualizar datos',exact:true}).click();
  await expect(page.getByRole('button',{name:'Actualizar datos',exact:true})).toBeEnabled();
  expect(await areaDeadline(page,'management')).toBe(deadline);
  const before=areaReads;
  await page.clock.fastForward(21000);
  await expect.poll(()=>areaReads).toBeGreaterThan(before);
  expect(monitoringReads).toBe(0);
});

for(const path of ['/users','/audit-logs']) test(`System ${path} only refreshes explicitly`,async({page})=>{
  await mockDashboard(page); await login(page,admin); await page.clock.install(); await page.goto(path);
  await expect(page.getByRole('button',{name:'Actualizar datos',exact:true})).toBeVisible();
  await expect(page.getByTestId('automatic-refresh-control')).toHaveCount(0);
  let reads=0;
  page.on('request',r=>{if(r.method()==='GET'&&r.url().includes('/api/v1/'))reads++;});
  await page.clock.fastForward(310000);
  expect(reads).toBe(0);
  await page.getByRole('button',{name:'Actualizar datos',exact:true}).click();
  await expect.poll(()=>reads).toBeGreaterThan(0);
});

test('hidden screen skips reads and resumes without catch-up bursts',async({page})=>{
  await mockDashboard(page);
  await page.route('**/api/v1/organizations/current/subscription/',route=>route.fulfill({json:{data:{monitoring_allowed:true,limits:{min_check_interval_seconds:60}}}}));
  await login(page,admin); await page.clock.install(); await page.goto('/monitoring');
  await expect(page.getByTestId('automatic-refresh-control')).toBeVisible();
  let reads=0;
  page.on('request',r=>{if(r.method()==='GET'&&new URL(r.url()).pathname==='/api/v1/monitoring/')reads++;});
  await page.evaluate(()=>Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'}));
  await page.clock.fastForward(190000);
  expect(reads).toBe(0);
  await page.evaluate(()=>Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'}));
  await page.clock.fastForward(1000);
  await expect.poll(()=>reads).toBe(1);
  await page.clock.fastForward(1000);
  expect(reads).toBe(1);
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
    await expect(page.getByTestId('automatic-refresh-control')).toHaveAttribute('title', /(5:00|4:5\d) min$/);
    await expect.poll(() => reads).toBeGreaterThan(0);
    const initialReads = reads;
    await page.clock.fastForward(16_000);
    await expect(page.getByTestId('automatic-refresh-control')).toHaveAttribute('title', /4:4\d min$/);
    expect(reads).toBe(initialReads);
    await page.clock.fastForward(285_000);
    await expect.poll(() => reads).toBeGreaterThan(initialReads);
    await page.getByRole('button', { name: 'Actualizar datos', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'No se ejecutó una nueva comprobación.' })).toContainText('cada 5 minutos');
    expect(scans).toBe(0);
  });
}

for(const path of ['/monitoring','/ssl','/dns','/domains','/api-checks','/security-headers']) {
  test(`persistent live clock resumes ${path} without resetting or scanning`, async ({page}) => {
    await mockDashboard(page);
    await page.route('**/api/v1/organizations/current/subscription/',route=>route.fulfill({json:{data:{monitoring_allowed:true,limits:{min_check_interval_seconds:300}}}}));
    await login(page,admin);
    await page.clock.install();
    let scans=0;
    page.on('request',r=>{if(r.method()==='POST'&&/\/scan(?:-all)?\/$/.test(new URL(r.url()).pathname))scans++;});
    await page.goto(path);
    await expect(page.getByRole('button',{name:'Pausar auto-refresco'})).toBeVisible();
    const deadline=()=>page.evaluate(p=>{
      const key=Object.keys(sessionStorage).find(key=>key.startsWith('sentinel:refresh:')&&key.endsWith(':connectivity'));
      return key?JSON.parse(sessionStorage.getItem(key)!).nextAt:null;
    },path);
    const initial=await deadline();
    await page.clock.fastForward(20000);
    await page.getByRole('link',{name:'Dashboard',exact:true}).click();
    await page.clock.fastForward(20000);
    await page.goto(path);
    await expect(page.getByTestId('automatic-refresh-control')).toHaveAttribute('title', /4:[12]\d min$/);
    expect(await deadline()).toBe(initial);
    await page.reload();
    await expect(page.getByTestId('automatic-refresh-control')).toHaveAttribute('title', /4:[12]\d min$/);
    expect(await deadline()).toBe(initial);
    expect(scans).toBe(0);
  });
}

test('Pro live clock polls at the preserved deadline after navigation',async({page})=>{
  await mockDashboard(page);
  await page.route('**/api/v1/organizations/current/subscription/',route=>route.fulfill({json:{data:{monitoring_allowed:true,limits:{min_check_interval_seconds:60}}}}));
  await login(page,admin); await page.clock.install();
  let reads=0;
  page.on('request',r=>{if(r.method()==='GET'&&new URL(r.url()).pathname==='/api/v1/monitoring/')reads++;});
  await page.goto('/monitoring');
  await expect(page.getByRole('button',{name:'Pausar auto-refresco'})).toBeVisible();
  await page.clock.fastForward(20000);
  await page.getByRole('link',{name:'Dashboard',exact:true}).click();
  await page.clock.fastForward(10000);
  await page.getByRole('link',{name:'Uptime & Latencia',exact:true}).click();
  await expect(page.getByTestId('automatic-refresh-control')).toHaveAttribute('title', /[23]\d s$/);
  const before=reads;
  await page.clock.fastForward(31000);
  await expect.poll(()=>reads).toBeGreaterThan(before);
});

test('paused live clock remains paused on return and resumes the existing cycle',async({page})=>{
  await mockDashboard(page);
  await page.route('**/api/v1/organizations/current/subscription/',route=>route.fulfill({json:{data:{monitoring_allowed:true,limits:{min_check_interval_seconds:300}}}}));
  await login(page,admin); await page.clock.install(); await page.goto('/monitoring');
  await page.getByRole('button',{name:'Pausar auto-refresco'}).click();
  await page.getByRole('link',{name:'Dashboard',exact:true}).click();
  await page.clock.fastForward(40000);
  await page.getByRole('link',{name:'Uptime & Latencia',exact:true}).click();
  await expect(page.getByRole('button',{name:'Activar auto-refresco'})).toHaveText('Actualización automática pausada');
  await page.getByRole('button',{name:'Activar auto-refresco'}).click();
  await expect(page.getByTestId('automatic-refresh-control')).toHaveAttribute('title', /4:[12]\d min$/);
});

test('inactive subscription disables live polling despite valid plan metadata',async({page})=>{
  await mockDashboard(page);
  await page.route('**/api/v1/organizations/current/subscription/',route=>route.fulfill({json:{data:{monitoring_allowed:false,limits:{min_check_interval_seconds:60}}}}));
  await login(page,admin); await page.clock.install();
  let reads=0;
  page.on('request',r=>{if(r.method()==='GET'&&new URL(r.url()).pathname==='/api/v1/monitoring/')reads++;});
  await page.goto('/monitoring');
  await expect(page.getByRole('button',{name:'Activar auto-refresco'})).toHaveText('Suscripción no vigente');
  await expect(page.getByRole('button',{name:'Activar auto-refresco'})).toBeDisabled();
  const initial=reads;
  await page.clock.fastForward(120000);
  expect(reads).toBe(initial);
});

test('live clock revalidates a changed plan automatically without scans',async({page})=>{
  await mockDashboard(page);
  let floor=60;
  await page.route('**/api/v1/organizations/current/subscription/',route=>route.fulfill({json:{data:{monitoring_allowed:true,limits:{min_check_interval_seconds:floor}}}}));
  await login(page,admin); await page.clock.install(); await page.goto('/monitoring');
  await expect(page.getByTestId('automatic-refresh-control')).toHaveAttribute('title', /(1:00 min|5\d s)$/);
  floor=300;
  await page.clock.fastForward(61000);
  await expect(page.getByTestId('automatic-refresh-control')).toHaveAttribute('title', /4:5\d min$/);
});

test('return after missed live cycles skips catch-up bursts and preserves phase',async({page})=>{
  await mockDashboard(page);
  await page.route('**/api/v1/organizations/current/subscription/',route=>route.fulfill({json:{data:{monitoring_allowed:true,limits:{min_check_interval_seconds:300}}}}));
  await login(page,admin); await page.clock.install(); await page.goto('/monitoring');
  await expect(page.getByRole('button',{name:'Pausar auto-refresco'})).toBeVisible();
  await page.clock.fastForward(20000);
  await page.getByRole('link',{name:'Monitoreo SSL',exact:true}).click();
  await page.clock.fastForward(720000);
  let reads=0;
  page.on('request',r=>{if(r.method()==='GET'&&new URL(r.url()).pathname==='/api/v1/monitoring/')reads++;});
  await page.getByRole('link',{name:'Uptime & Latencia',exact:true}).click();
  await expect(page.getByTestId('automatic-refresh-control')).toHaveAttribute('title', /2:[34]\d min$/);
  await expect.poll(()=>reads).toBe(1);
  await page.clock.fastForward(1000);
  expect(reads).toBe(1);
});

test('live pause and deadline are isolated between users in the same tenant',async({page})=>{
  await mockDashboard(page);
  await page.route('**/api/v1/organizations/current/subscription/',route=>route.fulfill({json:{data:{monitoring_allowed:true,limits:{min_check_interval_seconds:300}}}}));
  await login(page,admin); await page.goto('/monitoring');
  await page.getByRole('button',{name:'Pausar auto-refresco'}).click();
  await login(page,viewer); await page.goto('/monitoring');
  await expect(page.getByRole('button',{name:'Pausar auto-refresco'})).toBeVisible();
  await expect(page.getByTestId('automatic-refresh-control')).toHaveAttribute('title', /(5:00|4:5\d) min$/);
  expect(await page.evaluate(()=>Object.keys(sessionStorage).filter(key=>key.startsWith('sentinel:refresh:')&&key.endsWith(':connectivity')).length)).toBe(2);
});

test('Pro refresh follows the sixty second floor and updates after a plan change', async ({ page }) => {
  await mockDashboard(page);
  let floor = 60;
  await page.route('**/api/v1/organizations/current/subscription/', route => route.fulfill({ json: {
    data: { monitoring_allowed: true, plan_tier: floor === 60 ? 'pro' : 'free', limits: { min_check_interval_seconds: floor } },
  } }));
  await login(page, admin);
  await page.goto('/monitoring');
  await expect(page.getByTestId('automatic-refresh-control')).toHaveAttribute('title', /(1:00 min|5\d s)$/);
  floor = 300;
  await page.getByRole('button', { name: 'Actualizar datos', exact: true }).click();
  await expect(page.getByTestId('automatic-refresh-control')).toHaveAttribute('title', /(5:00|4:5\d) min$/);
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

test('missing operational permission fails closed despite a valid cadence',async({page})=>{
  await mockDashboard(page);
  await page.route('**/api/v1/organizations/current/subscription/',route=>route.fulfill({json:{data:{limits:{min_check_interval_seconds:60}}}}));
  await login(page,admin);
  await expect(page.getByTestId('automatic-refresh-control')).toHaveText('Frecuencia no disponible');
  await expect(page.getByTestId('automatic-refresh-control')).toBeDisabled();
  await page.goto('/monitoring');
  await expect(page.getByTestId('automatic-refresh-control')).toBeDisabled();
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
  await expect(page.getByRole('dialog',{name:'Public Web'})).toHaveCSS('background-color','rgb(16, 24, 32)');
  await expect(page.getByRole('dialog',{name:'Public Web'})).toHaveCSS('border-left-color','rgb(38, 51, 64)');
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
    await expect(page.locator('main')).toHaveCSS('--sentinel-bg-card','16 24 32');
    await expect(page.locator('main')).toHaveCSS('--sentinel-bg-card-hover','22 32 43');
    await expect(page.locator('main')).toHaveCSS('--sentinel-border-base','38 51 64');
    await expect(page.locator('main')).toHaveCSS('--sentinel-border-accent','64 80 96');
    const surface=page.locator('main .bg-bg-card, main .dashboard-panel').first();
    if(await surface.count()) await expect(surface).toHaveCSS('background-color','rgb(16, 24, 32)');
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

test('authentication uses the shared opaque graphite surface', async ({page}) => {
  await page.goto('/login');
  await expect(page.locator('.bg-bg-card.rounded-3xl').first()).toHaveCSS('background-color','rgb(16, 24, 32)');
  await page.screenshot({path:'test-results/graphite-auth-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/graphite-auth-mobile.png'});
});

for(const scenario of [
  {name:'degraded without outages',states:['up','slow'],color:'rgb(251, 191, 36)',score:'50%'},
  {name:'outages',states:['up','slow','down'],color:'rgb(255, 115, 132)',score:'33%'},
  {name:'healthy',states:['up','up'],color:'rgb(74, 222, 128)',score:'100%'},
  {name:'unknown resources',states:['up','unknown'],color:'rgb(226, 232, 240)',score:'50%'},
  {name:'degraded and unknown',states:['slow','unknown'],color:'rgb(251, 191, 36)',score:'0%'},
  {name:'empty',states:[],color:'rgb(226, 232, 240)',score:'—'},
  {name:'partial failure',states:['up'],color:'rgb(226, 232, 240)',score:'—',failure:true},
]) {
  test(`graphite dashboard health agrees for ${scenario.name}`, async ({page}) => {
    await page.setViewportSize({width:1440,height:900});
    await mockDashboard(page);
    for(const path of ['api-checks/','ssl-certificates/','domains/','dns-records/','security-headers/','agent-probes/']) {
      await page.route(`**/api/v1/${path}*`,route=>route.fulfill({status:scenario.failure&&path==='security-headers/'?500:200,json:{success:true,data:[]}}));
    }
    const now=new Date().toISOString();
    await page.route('**/api/v1/monitoring/',route=>route.fulfill({json:{success:true,data:scenario.states.map((state,index)=>({
      id:`tone-${index}`,name:`Tone ${index}`,target_type:'https',endpoint:'https://example.com',enabled:true,interval:300,
      last_status:state==='unknown'?null:state,last_checked_at:state==='unknown'?null:now,
      last_latency:state==='slow'?600:100,runner_type:'cloud',created_at:now,updated_at:now,
    }))}}));
    await login(page,viewer);
    await expect(page.getByTestId('dashboard-health-score')).toHaveText(scenario.score);
    await expect(page.getByTestId('dashboard-health-score')).toHaveCSS('color',scenario.color);
    await expect(page.getByTestId('dashboard-kpi-health-score')).toHaveCSS('color',scenario.color);
    await expect(page.getByTestId('dashboard-kpi-health-score')).toHaveText(scenario.score==='—'?'Sin datos':scenario.score);
    await expect(page.getByTestId('dashboard-health-donut')).toHaveCSS('background-color','rgb(16, 24, 32)');
    await expect(page.getByTestId('dashboard-performance')).toHaveCSS('background-color','rgb(16, 24, 32)');
    await expect(page.getByTestId('dashboard-performance').locator('.recharts-cartesian-grid-horizontal line').first()).toHaveCSS('stroke','rgb(38, 51, 64)');
    if(scenario.name==='degraded without outages') {
      await page.screenshot({path:'test-results/graphite-dashboard-desktop.png'});
      await page.setViewportSize({width:390,height:844});
      await page.getByTestId('dashboard-health-donut').scrollIntoViewIfNeeded();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
      await page.screenshot({path:'test-results/graphite-dashboard-mobile.png'});
    }
  });
}

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
