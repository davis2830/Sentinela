import { expect, test, type Page } from '@playwright/test';

async function config(page: Page) {
  await page.route('**/api/v1/auth/beta/config/', route => route.fulfill({json:{success:true,data:{admissions_open:false,turnstile_site_key:''}}}));
}

test('email format errors are inline and prevent a recovery request', async ({page}) => {
  await config(page);
  let requests=0;
  await page.route('**/api/v1/auth/password/recovery/', route => {requests++; return route.fulfill({status:202,json:{success:true}});});
  await page.goto('/forgot-password');
  const email=page.getByRole('textbox',{name:'Correo electrónico',exact:true});
  const submit=page.getByRole('button',{name:'Solicitar enlace',exact:true});
  await expect(submit).toBeEnabled();
  for(const value of ['', 'correo', 'nombre@', 'nombre@empresa', 'nombre@@empresa.com']) {
    await email.fill(value); await submit.click();
    await expect(email).toHaveAttribute('aria-invalid','true');
    await expect(email).toBeFocused();
    await expect(page.getByRole('alert')).toContainText(value ? 'Escribe un correo válido' : 'Escribe tu correo electrónico');
  }
  expect(requests).toBe(0);
});

for(const width of [1440,390]) {
  test(`recovery label and focus ring do not overlap at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:width===390?844:900}); await config(page); await page.goto('/forgot-password');
    const email=page.getByRole('textbox',{name:'Correo electrónico',exact:true}); await email.focus();
    const label=await page.locator('label[for="recovery-email"]').boundingBox(); const input=await email.boundingBox();
    expect(input!.y-(label!.y+label!.height)).toBeGreaterThanOrEqual(7);
    expect(await email.evaluate(el=>Number.parseFloat(getComputedStyle(el).outlineOffset))).toBeGreaterThanOrEqual(2);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
    await page.screenshot({path:`test-results/recovery-email-${width}.png`});
  });

  test(`successful password reset has a clear completion state at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:width===390?844:900});
    await page.route('**/api/v1/auth/password/reset/',route=>route.fulfill({json:{success:true,message:'Technical response: refresh tokens revoked, maximum 15 minutes.'}}));
    await page.goto('/reset-password#token=controlled-ui-fixture');
    await page.getByLabel('Nueva contraseña',{exact:true}).fill('Controlled-test-password-931!');
    await page.getByLabel('Confirmar contraseña',{exact:true}).fill('Controlled-test-password-931!');
    await page.getByRole('button',{name:'Guardar contraseña',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Contraseña cambiada correctamente',exact:true})).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Inicia sesión nuevamente con tu nueva contraseña');
    await expect(page.getByText(/refresh tokens/)).toHaveCount(0);
    await expect(page.getByLabel('Nueva contraseña',{exact:true})).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('link',{name:'Volver a iniciar sesión',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
    await page.screenshot({path:`test-results/recovery-success-${width}.png`});
  });
}

test('valid email gets a neutral confirmation without exposing account existence',async({page})=>{
  await config(page);
  await page.route('**/api/v1/auth/password/recovery/',route=>{
    expect(route.request().postDataJSON().email).toBe('controlled@example.test');
    return route.fulfill({status:202,json:{success:true}});
  });
  await page.goto('/forgot-password');
  await page.getByRole('textbox',{name:'Correo electrónico',exact:true}).fill('controlled@example.test');
  await page.getByRole('button',{name:'Solicitar enlace',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Revisa tu correo',exact:true})).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Si hay una cuenta habilitada');
  await expect(page.getByRole('status')).toContainText('carpeta de spam');
});

for(const failure of [{status:400,message:'El enlace no es válido o venció.',missingSuccess:false}, {status:503,message:'',missingSuccess:false}, {status:200,message:'',missingSuccess:true}]) {
  test(`reset failure ${failure.status} stays an error and offers recovery`,async({page})=>{
    await config(page);
    await page.route('**/api/v1/auth/password/reset/',route=>route.fulfill({status:failure.status,json:failure.missingSuccess ? {} : {success:false,message:failure.message}}));
    await page.goto('/reset-password#token=controlled-ui-fixture');
    await page.getByLabel('Nueva contraseña',{exact:true}).fill('Controlled-test-password-931!');
    await page.getByLabel('Confirmar contraseña',{exact:true}).fill('Controlled-test-password-931!');
    await page.getByRole('button',{name:'Guardar contraseña',exact:true}).click();
    await expect(page.getByRole('alert')).toContainText('No pudimos cambiar tu contraseña');
    await expect(page.getByRole('alert')).toContainText(failure.message || 'No pudimos completar la solicitud');
    await expect(page.getByRole('heading',{name:'Contraseña cambiada correctamente',exact:true})).toHaveCount(0);
    await expect(page.getByRole('link',{name:'Solicitar otro enlace',exact:true})).toBeVisible();
    await expect(page.getByLabel('Nueva contraseña',{exact:true})).toBeVisible();
    await page.getByRole('link',{name:'Solicitar otro enlace',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Recupera tu acceso',exact:true})).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}

test('auth pages do not display a placeholder product version',async({page})=>{
  await config(page);
  for(const path of ['/login','/register','/forgot-password']) {
    await page.goto(path); await expect(page.getByText(/v1\.0\.0/)).toHaveCount(0);
  }
});
