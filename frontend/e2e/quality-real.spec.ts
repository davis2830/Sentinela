import { expect, test } from '@playwright/test';

test.skip(process.env.QUALITY_ISOLATED !== '1', 'Requires seed_quality_audit and isolated API/database.');
test.use({hasTouch:true});
const api = process.env.E2E_API_URL || 'http://127.0.0.1:31800/api/v1';
for(const viewport of [{width:1440,height:900},{width:1366,height:768},{width:390,height:844}]) {
  test(`real quality UI: directory, authorization and billing ${viewport.width}`, async ({page,request}) => {
    await page.setViewportSize(viewport);
    await page.goto('/login');
    await page.getByPlaceholder('usuario@dominio.com').fill('quality.admin@sentinel.invalid');
    await page.getByPlaceholder('••••••••••••').fill('Quality-Portal-Fixture-123!');
    await page.getByRole('button',{name:'Ingresar a la Plataforma',exact:true}).click();
    await expect(page).not.toHaveURL(/\/login$/);
    await page.goto('/users');
    await expect(page.getByRole('navigation',{name:'Páginas del directorio'})).toContainText('31 resultados');
    await page.getByRole('button',{name:'Siguiente',exact:true}).click();
    await expect(page.getByRole('navigation',{name:'Páginas del directorio'})).toContainText('Página 2');
    const rolesButton = page.getByRole('button',{name:'Roles y permisos',exact:true});
    if(viewport.width === 390) await rolesButton.tap(); else await rolesButton.click();
    await page.getByLabel('Buscar integrante',{exact:true}).fill('quality.member02');
    await expect(page.getByRole('combobox',{name:'Integrante',exact:true}).locator('option')).toHaveCount(2);
    const memberId = await page.getByRole('combobox',{name:'Integrante',exact:true}).locator('option').last().getAttribute('value');
    await page.getByRole('combobox',{name:'Integrante',exact:true}).selectOption(memberId!);
    await expect(page.getByText('Acceso actual: legacy',{exact:true})).toBeVisible();
    await page.getByLabel('Quality Monitoring Reader',{exact:true}).check();
    await page.getByLabel('Motivo de autorización',{exact:true}).fill('Isolated UI quality regression');
    await page.getByLabel(/Confirmo el acceso de la vista previa/).check();
    const old = await request.post(api+'/auth/login/',{data:{email:'quality.member02@sentinel.invalid',password:'Quality-Portal-Fixture-123!'}});
    const token = (await old.json()).data.access_token;
    const adminToken = await page.evaluate(() => localStorage.getItem('access_token'));
    try {
      await page.getByRole('button',{name:'Aplicar autorización',exact:true}).click();
      await expect(page.getByText('Acceso actual: custom',{exact:true})).toBeVisible();
      expect((await request.get(api+'/auth/me/',{headers:{Authorization:'Bearer '+token}})).status()).toBe(401);
      const login = await request.post(api+'/auth/login/',{data:{email:'quality.member02@sentinel.invalid',password:'Quality-Portal-Fixture-123!'}});
      const current = (await login.json()).data;
      expect(current.user.effective_permissions).toEqual(['monitoring.read']);
      expect((await request.get(api+'/monitoring/',{headers:{Authorization:'Bearer '+current.access_token}})).status()).toBe(200);
      expect((await request.post(api+'/monitoring/',{headers:{Authorization:'Bearer '+current.access_token},data:{}})).status()).toBe(403);
      const operator = await page.context().browser()!.newContext({viewport,hasTouch:true});
      try {
        const restricted = await operator.newPage();
        await restricted.goto('/login');
        await restricted.getByPlaceholder('usuario@dominio.com').fill('quality.member02@sentinel.invalid');
        await restricted.getByPlaceholder('••••••••••••').fill('Quality-Portal-Fixture-123!');
        await restricted.getByRole('button',{name:'Ingresar a la Plataforma',exact:true}).click();
        await expect(restricted).not.toHaveURL(/login/);
        await restricted.goto('/monitoring');
        await expect(restricted.getByRole('heading',{name:'Uptime & Latencia',exact:true})).toBeVisible();
        await expect(restricted.getByRole('button',{name:'Buscar en Sentinel',exact:true})).toHaveCount(0);
        await expect(restricted.getByRole('button',{name:/Nuevo Target/})).toHaveCount(0);
        await expect(restricted.getByRole('link',{name:'Monitoreo SSL',exact:true})).toHaveCount(0);
        await restricted.goto('/ssl');
        await expect(restricted.getByRole('heading',{name:'Tu espacio de operación',exact:true})).toBeVisible();
      } finally { await operator.close(); }
      await page.screenshot({path:test.info().outputPath(`roles-${viewport.width}.png`),fullPage:true});
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    } finally {
      const reset = await request.put(api+`/users/${memberId}/authorization/`,{headers:{Authorization:'Bearer '+adminToken},data:{authorization_mode:'legacy',reason:'Reset isolated fixture after regression'}});
      expect(reset.status()).toBe(200);
    }
    await page.goto('/organization?tab=billing');
    await expect(page.getByText('Facturación no disponible. No hay comprobantes ni pagos confirmados.',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:/comprobante|recibo/i})).toHaveCount(0);
  });
}
