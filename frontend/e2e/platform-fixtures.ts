import { expect, type Page } from '@playwright/test';
export const stats = {
  financials: { mrr_usd: 1334, arr_usd: 16008, quoted_organizations: 0 },
  organizations: { total: 82, recent_signups_30d: 7, trial_expiring_7d: 3,
    by_plan: { free: 33, pro: 36, business: 12, enterprise: 1 },
    by_status: { past_due: 46, trialing: 3, active: 31, suspended: 2 } },
  infrastructure: { total_users: 157, total_targets: 40, active_targets: 40, total_probes: 0, online_probes: 0 },
};
export const betaOverview = {scope:"Toda la beta privada",capacity:50,reserved:12,available:38,admissions_open:true,invited:8,verification:3,registered:5,attention:{failed_delivery:2,expired:1,verification:3,blocked:1,unconfigured:2,unmeasured:1},queried_at:"2026-11-09T12:00:00Z",feedback_configured:false};
export const organization = { id:'client', name:'Cliente de demostración con nombre extendido', slug:'demo-client',
  billing_email:'contacto@example.test', plan_tier:'pro', subscription_status:'active', access_status:'active',access_protected:false,beta_managed:false,beta_status:null,is_test:false,
  targets_count:4, max_targets:10, probes_count:0, max_probes:1, is_in_trial:false, created_at:'2026-11-01T12:00:00Z' };
export async function fixture(page: Page, zero = false, overrides: Record<string, unknown> = {}) {
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if(path.endsWith('/session/login/')) data={challenge:'fixture'};
    if(path.endsWith('/session/verify/')) data={token:'design-fixture',expires_in:600,user:{id:'design-operator',email:'operator@example.test'}};
    if(path.endsWith('/beta/overview/')) data=zero ? {...betaOverview,attention:{failed_delivery:0,expired:0,verification:0,blocked:0,unconfigured:0,unmeasured:0}} : betaOverview;
    if(path.endsWith('/stats/')) data=zero ? {...stats,organizations:{...stats.organizations,trial_expiring_7d:0,by_status:{active:82}}} : stats;
    if(path.endsWith('/organizations/')) data=[organization];
    if(path.endsWith('/organizations/client/')) data={...organization, users_count:1,max_users:5,sla_target_percentage:99.9,limits:{min_check_interval_seconds:60},counts:{users:1,targets:4,probes:0,audit:0},users:[],targets:[],probes:[],recent_audits:[],has_next:false,resource_usage:[{module:'monitoring',label:'Uptime',total:4,measured:3,limit:10,limit_key:'max_monitoring_targets'},{module:'agents',label:'Agentes',total:0,measured:0,limit:1,limit_key:'max_private_agents'}]};
    if(path.endsWith('/catalog/')) data={plans:[{id:'pro',name:'Pro',price:29}]};
    if(path.endsWith('/beta/')) data={capacity:50,reserved:2,available:48,admissions_open:true,total:1,page:1,page_size:25,feedback_submission_url:'',feedback_management_url:'',invitations:[{id:'inv',email:'invitada@example.test',status:'invited',expires_at:'2026-12-01T12:00:00Z',delivery:{status:'sent',attempts:1}}],has_next:false};
    if(path.endsWith('/users/')) data={users:[{id:'user',email:'member@example.test',name:'Miembro de demostración',organization_id:'client',organization_name:organization.name,role:'viewer',authorization_mode:'legacy',is_active:true,email_verified:true,mfa_enabled:false,last_login:null}],total:1,page_size:25};
    if(path.endsWith('/users/user/')) data={id:'user',email:'member@example.test',name:'Miembro de demostración',organization_id:'client',organization_name:organization.name,role:'viewer',authorization_mode:'custom',effective_permissions:['monitoring.read'],roles:[{id:'reader',name:'Lector de monitoreo'}],is_active:true,email_verified:true,mfa_enabled:false,last_login:null,created_at:'2026-11-01T12:00:00Z'};
    if(path.endsWith('/health/')) data={status:'degraded',queried_at:'2026-11-09T12:00:00Z',environment:'development',components:{database:{status:'healthy',latency_ms:2},redis_cache:{status:'healthy',latency_ms:1},celery_broker:{status:'healthy',latency_ms:1},celery_workers:{status:'unavailable',latency_ms:null}},queues:[{name:'monitoring',ready:null,status:'unavailable'}],scope:'Mensajes listos; no incluye ejecución.'};
    if(path.endsWith('/plan-preview/')) data={current_plan:'pro',proposed_plan:'pro',current_subscription:'active',proposed_subscription:'active',current_limits:{min_check_interval_seconds:60,metrics_retention_days:30},proposed_limits:{min_check_interval_seconds:60,metrics_retention_days:30},consumption:[{label:'Uptime',key:'max_monitoring_targets',used:4,current_limit:10,proposed_limit:10,exceeds:false}],warnings:[],queried_at:'2026-11-09T12:00:00Z'};
    if(path.endsWith('/trial-preview/')) data={current_subscription:'active',proposed_subscription:'trialing',current_end:null,proposed_end:'2026-11-23T12:00:00Z',days:14,queried_at:'2026-11-09T12:00:00Z'};
    if(path.endsWith('/audit-options/')) data={actions:[{id:'update',label:'Actualización'}],modules:[{id:'platform_users',label:'Usuarios de plataforma'}]};
    if(path.endsWith('/audit-logs/')) data={events:[],has_next:false};
    if (Object.prototype.hasOwnProperty.call(overrides, path)) data = overrides[path];
    await route.fulfill({json:{success:true,data,...(path.endsWith("/organizations/")?{meta:{total:Array.isArray(data)?data.length:1,page:1,page_size:25,has_next:false}}:{})}});
  });
  await page.goto('/admin/login');
  await page.getByLabel('Correo administrativo').fill('operator@example.test');
  await page.getByLabel('Contraseña',{exact:true}).fill('Design-fixture-only');
  await page.getByRole('button',{name:'Continuar',exact:true}).click();
  await page.getByLabel('Código de autenticación').fill('123456');
  await page.getByRole('button',{name:'Entrar a la consola',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Requiere atención'})).toBeVisible();
}

