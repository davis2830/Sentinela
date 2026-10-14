import {test, expect, type Page} from '@playwright/test';

const suffix = process.env.E2E_FIXTURE_SUFFIX || 'local-beta-fixture';
if (!/^[a-z0-9-]+$/.test(suffix)) throw new Error('Invalid isolated fixture suffix.');
const fixtureSessions = new Map<string, any>();
async function session(page: Page, role = 'viewer') {
  let data = fixtureSessions.get(role);
  if (!data) {
  const response = await page.request.post('http://127.0.0.1:8000/api/v1/auth/login/', {
    data: {email: `e2e-${role}-${suffix}@example.test`, password: `E2e-${role==='admin'?'Admin':'Viewer'}-Password-123!`},
  });
  expect(response.status(), 'Isolated fixture login must succeed without bypassing auth limits').toBe(200);
  data = (await response.json()).data;
  fixtureSessions.set(role, data);
  }
  await page.addInitScript(data => {
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    localStorage.setItem('auth-storage', JSON.stringify({state:{user:data.user,accessToken:data.access_token,
      refreshToken:data.refresh_token,isAuthenticated:true},version:0}));
  }, data);
  // Audit data is proven separately in the disposable DB; never capture real global logs here.
  await page.route('**/api/v1/audit-logs/**', r=>r.fulfill({json:{success:true,data:[]}}));
}

for (const viewport of [{width:1440,height:900},{width:390,height:844}]) {
  test(`read-only module smoke ${viewport.width}x${viewport.height}`, async ({page}) => {
    await session(page); await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', error=>errors.push(error.message));
    for (const route of ['/dashboard','/gestion','/monitoring','/ssl','/dns','/domains','/api-checks',
      '/security-headers','/alerts','/incidents','/maintenance','/status-page','/notifications',
      '/reports','/organization','/users','/profile','/audit-logs']) {
      await test.step(route, async()=>{
        await page.goto(route);
        await expect(page.locator('h1').first()).toBeVisible();
        await page.waitForTimeout(300);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route).toBe(true);
      });
    }
    expect(errors).toEqual([]);
  });
}

test('Viewer does not see member or team mutation controls', async({page})=>{
  await session(page); await page.goto('/users');
  await expect(page.getByRole('heading',{name:'Usuarios y Equipos'})).toBeVisible();
  for (const name of ['Nuevo Equipo', 'Crear Usuario', 'Invitar por Correo (SMTP)']) {
    await expect(page.getByRole('button',{name,exact:true})).toHaveCount(0);
  }
});

test('unknown route gives a useful not-found screen', async({page})=>{
  await session(page); await page.goto('/audit-nonexistent-route');
  await expect(page.getByText(/página no encontrada|no encontramos esta página|ruta no encontrada/i)).toBeVisible();
});

async function monitoringFixture(page: Page, healthy = false) {
  await session(page);
  const now=new Date().toISOString();
  await page.route('**/api/v1/monitoring/',r=>r.fulfill({json:{data:[{
    id:'audit-target',name:'Audit unmeasured',target_type:'https',endpoint:'https://example.test',interval:300,
    enabled:true,runner_type:'cloud',last_checked_at:null,last_status:null,last_latency:null,
    created_at:now,updated_at:now,scan_availability:{status:'ready',next_allowed_at:null,retry_after_seconds:null},
  }]}}));
  await page.route('**/api/v1/monitoring/audit-target/timeseries/**',r=>r.fulfill(healthy ? {json:{data:{
    summary:{uptime_percentage:100,total_checks:1,up_checks:1,down_checks:0,avg_latency:100,
      incidents_count:0,total_downtime_seconds:0},timeseries:[],daily_availability:[],incidents:[]}}}
    : {status:500,json:{message:'Controlled unavailable'}}));
  await page.goto('/monitoring');
  await page.getByRole('row',{name:'Audit unmeasured',exact:true}).click();
  await expect(page.getByRole('button',{name:'Métricas & SLA',exact:true})).toBeVisible();
}

test('failed resource history never claims 100 percent availability', async({page})=>{
  await monitoringFixture(page);
  await page.waitForTimeout(1800);
  await expect(page.getByText('100.00%',{exact:true})).toHaveCount(0);
});

test('Free resource drawer does not refresh history before five minutes', async({page})=>{
  await page.clock.install();
  await monitoringFixture(page, true);
  let reads=0;
  await page.route('**/api/v1/monitoring/audit-target/timeseries/**',r=>{
    reads++;
    return r.fulfill({json:{data:{summary:{uptime_percentage:null,total_checks:0,up_checks:0,down_checks:0,
      avg_latency:null,incidents_count:0,total_downtime_seconds:0},timeseries:[],daily_availability:[],incidents:[]}}});
  });
  await page.clock.fastForward(35000);
  await page.waitForTimeout(250);
  expect(reads).toBe(0);
});
