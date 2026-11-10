import { expect, test, type Page } from "@playwright/test";

async function navigate(page: Page, name: string, touch = false) {
  if ((page.viewportSize()?.width || 1440) < 768) {
    const menu = page.getByRole("button", {
      name: "Abrir menú administrativo",
      exact: true,
    });
    if (touch) await menu.tap();
    else await menu.click();
  }
  const link = page.getByRole("link", { name, exact: true });
  if (touch) await link.tap();
  else await link.click();
}

import { fixture, organization } from "./platform-fixtures";

test("design: attention and four complete indicators fit desktop; mobile preserves order and width", async ({
  page,
}) => {
  await fixture(page);
  for (const size of [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    const main = page.getByRole("main", { name: "Administración SaaS" });
    await main.evaluate((e) => {
      e.scrollTop = 0;
    });
    const metrics = page.getByRole("region", { name: "Indicadores de beta" });
    if (size.width > 400) {
      await expect(metrics).toBeInViewport({ ratio: 1 });
      await expect(
        page.getByRole("button", { name: "Revisar envíos fallidos" }),
      ).toBeInViewport();
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(size.width);
    expect(await main.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
      true,
    );
    for (const label of [
      "Cupos disponibles",
      "Invitaciones vigentes",
      "Correos por verificar",
      "Organizaciones registradas",
    ])
      await expect(metrics.getByText(label, { exact: true })).toBeVisible();
    await page.screenshot({
      path: `.tmp/platform-validation/redesign-summary-${size.width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.getByText("Contexto comercial", { exact: true }).click();
  for (const [label, key, value] of [
    ["Ver 46 organizaciones con pago pendiente", "status", "past_due"],
    ["Ver 3 organizaciones con prueba por vencer", "trial_expiring", "true"],
    ["Ver 2 organizaciones suspendidas", "status", "suspended"],
  ]) {
    const request = page.waitForRequest(
      (r) =>
        r.url().includes("/platform-admin/organizations/?") &&
        new URL(r.url()).searchParams.get(key) === value,
    );
    await page.getByRole("button", { name: label, exact: true }).click();
    const url = new URL((await request).url());
    expect(url.searchParams.get("classification")).toBe("customers");
    await expect(
      page.getByRole("button", {
        name: "Quitar filtro: Clientes",
        exact: true,
      }),
    ).toBeVisible();
    await navigate(page, "Resumen SaaS");
  }
});

test("design: zero attention is neutral; directory disclosures support keyboard and retain context", async ({
  page,
}) => {
  await fixture(page, true);
  const emptyCriteria = page.getByLabel("Sin pendientes en este criterio", {
    exact: true,
  });
  await expect(emptyCriteria).toHaveCount(6);
  await expect(emptyCriteria.first()).toBeVisible();
  await page.getByText("Continuar incorporación", { exact: true }).click();
  for (const empty of await emptyCriteria.all())
    await expect(empty).toBeVisible();
  await expect(page.getByRole("button", { name: /^Revisar / })).toHaveCount(0);
  await page.getByText("Contexto comercial", { exact: true }).click();
  await expect(
    page.getByText("Sin agentes registrados", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Ver \d+ organizaciones/ }),
  ).toHaveCount(0);
  await navigate(page, "Organizaciones");
  const trigger = page.getByLabel("Más acciones de " + organization.name, {
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Cambiar plan", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Cambiar plan", exact: true }),
  ).toBeHidden();
  await page.getByText("Filtros avanzados", { exact: true }).click();
  await page.getByRole("button", { name: "Pro", exact: true }).click();
  await navigate(page, "Usuarios");
  await navigate(page, "Organizaciones");
  await expect(
    page.getByRole("button", { name: "Quitar filtro: Plan: pro", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Quitar filtro: Plan: pro", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Quitar filtro: Plan: pro", exact: true }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", {
      name: "Ver ficha de " + organization.name,
      exact: true,
    })
    .scrollIntoViewIfNeeded();
  await page.getByText("Detalles de organización", { exact: true }).click();
  expect(
    await page
      .getByRole("main")
      .evaluate((e) => e.scrollWidth <= e.clientWidth),
  ).toBe(true);
  await page.screenshot({
    path: ".tmp/platform-validation/redesign-organizations-390.png",
    fullPage: true,
  });
});

test("design: audit drafts never query events; applied scope remains explicit after editing", async ({
  page,
}) => {
  await fixture(page);
  let requests = 0;
  page.on("request", (r) => {
    if (r.url().includes("/audit-logs/?")) requests++;
  });
  await navigate(page, "Auditoría");
  await page.getByLabel("Correo del usuario").fill("member@example.test");
  await page.getByRole("button", { name: "7 días", exact: true }).click();
  await page.getByText("Filtros avanzados", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "Acción", exact: true })
    .selectOption("update");
  expect(requests).toBe(0);
  await page
    .getByRole("button", { name: "Consultar auditoría", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sin eventos" }),
  ).toBeVisible();
  expect(requests).toBe(1);
  await page.getByLabel("Correo del usuario").fill("another@example.test");
  await expect(page.getByText(/Filtros modificados/)).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Consulta aplicada" }),
  ).toContainText("member@example.test");
  expect(requests).toBe(1);
  await navigate(page, "Usuarios");
  await navigate(page, "Auditoría");
  expect(requests).toBe(1);
});

test("design: all directories and forms adapt at three widths; drawer disclosures and nested dialogs keep focus", async ({
  page,
  browser,
}) => {
  await fixture(page);
  for (const [tab, slug] of [
    ["Organizaciones", "organizations"],
    ["Usuarios", "users"],
    ["Beta", "beta"],
    ["Auditoría", "audit"],
    ["Salud de plataforma", "health"],
  ]) {
    await navigate(page, tab);
    for (const size of [
      { width: 1440, height: 900 },
      { width: 1366, height: 768 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      await page.getByRole("main").evaluate((e) => {
        e.scrollTop = 0;
      });
      if (size.width >= 768)
        await expect(
          page.getByRole("link", { name: tab, exact: true }),
        ).toHaveAttribute("aria-current", "page");
      expect(
        await page
          .getByRole("main")
          .evaluate((e) => e.scrollWidth <= e.clientWidth),
      ).toBe(true);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(size.width);
      await page.screenshot({
        path: `.tmp/platform-validation/redesign-${slug}-${size.width}.png`,
        fullPage: true,
      });
      if (tab === "Beta") {
        // Invitations and settings are deliberate tasks, not forms mixed into the directory.
        await expect(
          page.getByLabel("Correo de invitación", { exact: true }),
        ).toHaveCount(0);
        const inviteTrigger = page.getByRole("button", {
          name: "Invitar participante",
          exact: true,
        });
        await inviteTrigger.click();
        const invite = page.getByRole("dialog", {
          name: "Invitar participante",
          exact: true,
        });
        await expect(
          invite.getByLabel("Correo de invitación", { exact: true }),
        ).toBeVisible();
        await invite
          .getByLabel("Correo de invitación", { exact: true })
          .fill("design-participant@example.test");
        await expect(
          invite.getByRole("button", {
            name: "Enviar invitación",
            exact: true,
          }),
        ).toBeEnabled();
        expect(
          await invite.evaluate((e) => e.scrollWidth <= e.clientWidth),
        ).toBe(true);
        await expect(invite.locator(":focus")).toBeVisible();
        await page.screenshot({
          path: `.tmp/platform-validation/redesign-beta-invite-${size.width}.png`,
          fullPage: true,
        });
        await page.keyboard.press("Escape");
        await expect(invite).toHaveCount(0);
        await expect(inviteTrigger).toBeFocused();

        const settingsTrigger = page.getByRole("button", {
          name: "Configuración de beta",
          exact: true,
        });
        await settingsTrigger.click();
        const settings = page.getByRole("dialog", {
          name: "Configuración de beta",
          exact: true,
        });
        await settings
          .getByRole("button", { name: "Cupos y admisiones", exact: true })
          .click();
        await expect(
          settings.getByLabel("Cupos", { exact: true }),
        ).toBeVisible();
        expect(
          await settings.evaluate((e) => e.scrollWidth <= e.clientWidth),
        ).toBe(true);
        await page.screenshot({
          path: `.tmp/platform-validation/redesign-beta-capacity-${size.width}.png`,
          fullPage: true,
        });
        await settings
          .getByRole("button", { name: "Comentarios", exact: true })
          .click();
        await expect(
          settings.getByLabel("Enlace del formulario", { exact: true }),
        ).toBeVisible();
        await expect(
          settings.getByRole("button", {
            name: "Guardar canal de comentarios",
            exact: true,
          }),
        ).toBeVisible();
        expect(
          await settings.evaluate((e) => e.scrollWidth <= e.clientWidth),
        ).toBe(true);
        await page.screenshot({
          path: `.tmp/platform-validation/redesign-beta-feedback-${size.width}.png`,
          fullPage: true,
        });
        await page.keyboard.press("Escape");
        await expect(settings).toHaveCount(0);
        await expect(settingsTrigger).toBeFocused();
      }
    }
  }
  await navigate(page, "Organizaciones");
  const open = page.getByRole("button", {
    name: "Ver ficha de " + organization.name,
    exact: true,
  });
  await open.click();
  const drawer = page.getByRole("dialog", { name: "Ficha de organización" });
  await expect(
    drawer.getByRole("heading", { name: organization.name }),
  ).toBeVisible();
  await drawer
    .getByLabel("Cerrar ficha de organización", { exact: true })
    .focus();
  await drawer
    .getByRole("button", { name: "Cambiar plan", exact: true })
    .focus();
  await expect(
    drawer.getByRole("button", { name: "Cambiar plan", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  const modal = page.getByRole("dialog", { name: "Cambiar plan", exact: true });
  // Plan loads asynchronously; focus starts on the first enabled control.
  await expect(modal.locator(":focus")).toBeVisible();
  await expect(
    modal.getByRole("button", { name: "Cambiar plan", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: ".tmp/platform-validation/redesign-confirmation-390.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(
    drawer.getByRole("button", { name: "Cambiar plan", exact: true }),
  ).toBeFocused();

  for (const size of [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await page.screenshot({
      path: `.tmp/platform-validation/redesign-dossier-${size.width}.png`,
      fullPage: true,
    });
    expect(await drawer.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
      true,
    );
  }
  await page.keyboard.press("Escape");
  await expect(open).toBeFocused();
  const touchContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    baseURL: test.info().project.use.baseURL,
  });
  try {
    const touch = await touchContext.newPage();
    await fixture(touch);
    await navigate(touch, "Organizaciones", true);
    await touch
      .getByLabel("Más acciones de " + organization.name, { exact: true })
      .tap();
    await touch
      .getByRole("button", { name: "Extender prueba", exact: true })
      .tap();
    const trial = touch.getByRole("dialog", {
      name: "Extender prueba",
      exact: true,
    });
    await trial.getByLabel("Días de extensión").fill("7");
    await trial.getByRole("button", { name: "Cancelar", exact: true }).tap();
    await expect(trial).toHaveCount(0);
    await navigate(touch, "Auditoría", true);
    await touch.getByRole("button", { name: "Hoy", exact: true }).tap();
    await touch
      .getByRole("button", { name: "Consultar auditoría", exact: true })
      .tap();
    await expect(
      touch.getByRole("heading", { name: "Sin eventos" }),
    ).toBeVisible();
  } finally {
    await touchContext.close();
  }
});
