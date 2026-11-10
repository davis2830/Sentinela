import { expect, test } from '@playwright/test';
import { fixture } from './platform-fixtures';


test('shell: sidebar has its own collapse state, supports browser history and mobile touch with focus restoration',async({page})=>{
  await fixture(page);
  const sidebar=page.getByRole('complementary',{name:'Navegación de Sentinel'});
  await expect(sidebar).toHaveCSS('width','256px');
  await page.getByRole('button',{name:'Contraer menú lateral'}).click();
  await expect(sidebar).toHaveCSS('width','80px');
  expect(await page.evaluate(()=>localStorage.getItem('sentinel_platform_sidebar_collapsed'))).toBe('true');
  expect(await page.evaluate(()=>localStorage.getItem('sentinel_sidebar_collapsed'))).toBeNull();
  await page.screenshot({path:'.tmp/platform-validation/shell-collapsed-1440.png'});
  await page.getByRole('link',{name:'Usuarios',exact:true}).click();
  await expect(page.getByRole('link',{name:'Usuarios',exact:true})).toHaveAttribute('aria-current','page');
  await page.goBack();await expect(page.getByRole('heading',{name:'Resumen de plataforma',exact:true})).toBeVisible();
  await page.goForward();await expect(page.getByRole('heading',{name:'Usuarios',exact:true})).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  const menu=page.getByRole('button',{name:'Abrir menú administrativo'});
  await menu.click();
  await page.screenshot({path:'.tmp/platform-validation/shell-menu-390.png'});
  await page.keyboard.press('Escape');await expect(menu).toBeFocused();
  await menu.click();await page.getByRole('dialog',{name:'Menú administrativo'}).getByRole('link',{name:'Auditoría',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Menú administrativo'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Auditoría de plataforma',exact:true})).toBeVisible();
  expect(await page.getByRole('main').evaluate(element=>element.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.getByRole('button',{name:'Buscar clientes y usuarios',exact:true})).toHaveCount(0);
  await page.keyboard.press('Control+k');
  await page.keyboard.press('Meta+k');
  await expect(page.getByRole('dialog',{name:'Buscar clientes y usuarios'})).toHaveCount(0);
});
