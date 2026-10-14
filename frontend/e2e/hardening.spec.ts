// The six audit reproductions are part of normal Chromium discovery.
import '../audit/system-audit.spec';
import {test, expect} from '@playwright/test';

test('invitation fragment is removed and activation remains explicit without stale bearer', async ({page})=>{
  await page.addInitScript(()=>localStorage.setItem('access_token','stale-invitation-fixture'));
  let accepted=0;
  let validated=0;
  let bearer=false;
  let queryToken=false;
  await page.route('**/api/v1/organizations/invitations/**',route=>{
    const request=route.request();
    bearer ||= Boolean(request.headers().authorization);
    queryToken ||= new URL(request.url()).searchParams.has('token');
    expect(request.postDataJSON().token).toBe('isolated-fragment-token');
    if(request.url().includes('/validate/')) {
      validated++;
      expect(request.method()).toBe('POST');
      return route.fulfill({json:{data:{email:'invite@example.test',organization_name:'Isolated organization',role:'viewer'}}});
    }
    accepted++;
    return route.fulfill({json:{data:{message:'Confirmed'}}});
  });
  await page.goto('/accept-invitation#token=isolated-fragment-token');
  await expect(page.getByRole('heading',{name:'Aceptar Invitación'})).toBeVisible();
  expect(new URL(page.url()).hash).toBe('');
  expect(accepted).toBe(0);
  expect(validated).toBeGreaterThan(0);
  await page.getByPlaceholder('Mínimo 8 caracteres').fill('Invitation-Test-927!');
  await page.getByPlaceholder('Repite tu contraseña').fill('Invitation-Test-927!');
  await page.getByRole('button',{name:'Activar Cuenta e Ingresar'}).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(accepted).toBe(1);
  expect(bearer || queryToken).toBe(false);
});

test('not-found recovery is keyboard accessible and does not overflow on mobile', async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/unknown-isolated-route');
  await expect(page.getByRole('heading',{name:'Página no encontrada'})).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link',{name:'Volver al inicio'})).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/login$/);
});
