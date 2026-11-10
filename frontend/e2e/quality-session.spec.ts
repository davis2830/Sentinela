import { test, expect } from '@playwright/test';

test('an old refresh cannot overwrite or expire a new identity', async ({page}) => {
  let release: (() => void) | undefined;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let started: (() => void) | undefined;
  const refreshing = new Promise<void>(resolve => { started = resolve; });
  const user = (id:string) => ({id,email:id+'@quality.test',is_staff:true,is_active:true,organization:{id:'org-'+id,name:id}});
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/refresh/')) {
      started?.(); await pending;
      await route.fulfill({status:401,json:{message:'Old session expired'}}).catch(() => undefined);
    } else if (path.includes('/session-regression/')) await route.fulfill({status:401,json:{}});
    else if (path.endsWith('/auth/login/')) await route.fulfill({json:{data:{user:user('B'),access_token:'access-B',refresh_token:'refresh-B'}}});
    else await route.fulfill({json:{data:[]}});
  });
  await page.goto('/login');
  await expect(page.getByRole('button',{name:'Ingresar a la Plataforma',exact:true})).toBeVisible();
  await page.evaluate(async initial => {
    const storePath='/src/store/authStore.ts'; const {useAuthStore}=await import(storePath);
    const apiPath='/src/services/api.ts'; const {api}=await import(apiPath);
    localStorage.setItem('access_token','access-A');localStorage.setItem('refresh_token','refresh-A');
    useAuthStore.setState({user:initial,isAuthenticated:true,sessionId:'session-A'});
    void api.get('session-regression/old/').catch(() => undefined);
  }, user('A'));
  await refreshing;
  await page.evaluate(async () => {
    const storePath='/src/store/authStore.ts'; const {useAuthStore}=await import(storePath);
    await useAuthStore.getState().logout();
    await useAuthStore.getState().login('B@quality.test','Fixture-only');
  });
  release?.();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('access_token'))).toBe('access-B');
  expect(await page.evaluate(() => localStorage.getItem('refresh_token'))).toBe('refresh-B');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.user?.id)).toBe('B');
});

test('session isolation: a second account receives only its own organization',async({page})=>{
  const errors: string[]=[]; page.on('pageerror', error=>errors.push(error.message));
  let tenant='A';const reads:string[]=[];
  const user=(id:string)=>({id:'user-'+id,email:'review-'+id.toLowerCase()+'@example.test',is_staff:true,is_superuser:false,is_active:true,organization:{id:'org-'+id,name:'Review tenant '+id}});
  await page.addInitScript(initial=>{
    localStorage.setItem('access_token','review-access-a');localStorage.setItem('refresh_token','review-refresh-a');
    localStorage.setItem('auth-storage',JSON.stringify({version:0,state:{user:initial,isAuthenticated:true,accessToken:'review-access-a',refreshToken:'review-refresh-a'}}));
  },user('A'));
  await page.route('**/api/v1/**',route=>{
    const path=new URL(route.request().url()).pathname;
    let data:unknown=[];
    if(path.endsWith('/auth/login/')){tenant='B';data={access_token:'review-access-b',refresh_token:'review-refresh-b',user:user('B')};}
    if(path.endsWith('/auth/me/'))data=user(tenant);
    if(path.endsWith('/organizations/current/')){reads.push(tenant);data={id:'org-'+tenant,name:'Organization '+tenant+' REVIEW_MARKER',slug:'org-'+tenant,created_at:'2026-11-01T00:00:00Z',timezone:'America/Guatemala',locale:'es-GT',sla_target_percentage:99.9};}
    if(path.endsWith('/monitoring/global-performance/'))data={period:'24h',summary:{avg_uptime:null,avg_latency:null,total_checks:0,checks_per_minute:0},points:[]};
    if(path.endsWith('/organizations/current/subscription/'))data={plan_tier:'pro',plan_name:'Pro',monitoring_allowed:true,limits:{},usage:{}};
    return route.fulfill({json:{success:true,data}});
  });
  await page.goto('/organization');
  const name=page.locator('input').first();
  await expect(name).toHaveValue('Organization A REVIEW_MARKER');
  await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByPlaceholder('usuario@dominio.com').fill('review-b@example.test');
  await page.getByPlaceholder('••••••••••••').fill('Synthetic-only');
  await page.getByRole('button',{name:'Ingresar a la Plataforma',exact:true}).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
  const onboarding = page.getByRole('button',{name:'Omitir por ahora',exact:true});
  if (await onboarding.isVisible()) await onboarding.click();
  await page.getByRole('button',{name:/^Sistema/}).click();
  await page.getByRole('link',{name:'Organización & Planes',exact:true}).click();
  await expect(page).toHaveURL(/\/organization$/);
  await expect(page.locator('input').first()).toHaveValue('Organization B REVIEW_MARKER');
  const active=await page.evaluate(async()=>{const {useAuthStore}=await import('/src/store/authStore.ts');return useAuthStore.getState().user?.organization?.id;});
  expect(active).toBe('org-B');expect(reads).toEqual(['A','B']);
  await page.screenshot({path:test.info().outputPath('tenant-isolation.png'),fullPage:true});
});
