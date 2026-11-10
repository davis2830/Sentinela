import { test, expect, type Page } from "@playwright/test";

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
import { createHmac } from "node:crypto";

test.skip(
  process.env.PLATFORM_ISOLATED !== "1",
  "Requires seed_platform_audit and isolated API/database.",
);
test.setTimeout(120000);
test.use({ viewport: { width: 1440, height: 900 }, actionTimeout: 10000 });
function otp() {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const mac = createHmac("sha1", Buffer.from("48656c6c6f21deadbeef", "hex"))
    .update(counter)
    .digest();
  const offset = mac[19] & 15;
  return String((mac.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(
    6,
    "0",
  );
}
async function login(page: Page) {
  await page.goto("/admin/login");
  const suffix = test.info().title.includes("organizations,")
    ? "orgs"
    : test.info().title.includes("beta independent")
      ? "beta"
      : "users";
  await page
    .getByLabel("Correo administrativo")
    .fill(
      test.info().title.includes("portal visual parity")
        ? "operator@example.test"
        : `operator-${suffix}@example.test`,
    );
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("Isolated-platform-fixture-2026");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("Código de autenticación").fill(otp());
  const verification = page.waitForResponse((r) =>
    r.url().includes("/platform-admin/session/verify/"),
  );
  await page
    .getByRole("button", { name: "Entrar a la consola", exact: true })
    .click();
  if ((await verification).status() === 429) {
    await page.waitForTimeout(31000 - (Date.now() % 30000));
    await page.getByLabel("Código de autenticación").fill(otp());
    await page
      .getByRole("button", { name: "Entrar a la consola", exact: true })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "Resumen de plataforma", exact: true }),
  ).toBeVisible();
}
async function reason(page: Page, label: string, confirmLabel = label) {
  const dialog = page.getByRole("dialog", { name: label, exact: true });
  await dialog
    .getByLabel("Motivo para auditoría")
    .fill("Isolated browser validation");
  await dialog.getByRole("button", { name: confirmLabel, exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

test("real API: organizations, lazy detail, classification, plan, trial, suspension and CSV", async ({
  page,
}) => {
  await login(page);
  await navigate(page, "Organizaciones");
  await expect(page.getByRole("row")).toHaveCount(26);
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect(page.getByText(/Página 2 · \d+ organizaciones/)).toBeVisible();
  await page.getByRole("textbox").fill("Audit Customer");
  await expect(page.getByRole("row")).toHaveCount(2);
  await page.getByText("Filtros avanzados", { exact: true }).click();
  await page.getByRole("button", { name: "Pro", exact: true }).click();
  await page.getByRole("button", { name: "Activas", exact: true }).click();
  await page
    .getByRole("combobox", { name: /Clasificación/ })
    .selectOption("customers");
  await expect(page.getByRole("row")).toHaveCount(2);
  await page.getByRole("button", { name: "Todos", exact: true }).click();
  await page
    .getByRole("button", { name: "Todos los estados", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: /Clasificación/ })
    .selectOption("all");
  await page.getByLabel("Exportar CSV", { exact: true }).click();
  const csv = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar resultados filtrados", exact: true })
    .click();
  expect((await csv).suggestedFilename()).toContain(".csv");
  await page.getByLabel("Exportar CSV", { exact: true }).click();
  const allCsv = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar todas", exact: true })
    .click();
  expect((await allCsv).suggestedFilename()).toContain(".csv");
  await page
    .getByRole("button", { name: "Ver ficha de Audit Customer" })
    .click();
  const drawer = page.getByRole("dialog", { name: "Ficha de organización" });
  await expect(
    drawer.getByRole("heading", { name: "Audit Customer", exact: true }),
  ).toBeVisible();
  await drawer.getByRole("button", { name: /^Usuarios \(/ }).click();
  await expect(
    drawer.getByText("member@example.test", { exact: true }),
  ).toBeVisible();
  await drawer
    .getByRole("button", { name: "Recursos y límites", exact: true })
    .click();
  await drawer.getByRole("button", { name: /^Agentes/ }).click();
  await expect(
    drawer.getByText("Sin recursos en este módulo.", { exact: true }),
  ).toBeVisible();
  await drawer
    .getByRole("button", { name: "Historial administrativo", exact: true })
    .click();
  await expect(
    drawer.getByText(/Controlled event|Isolated browser validation/).first(),
  ).toBeVisible();
  await drawer
    .getByRole("button", { name: "General y contacto", exact: true })
    .click();
  await drawer
    .getByRole("button", { name: "Marcar como prueba", exact: true })
    .click();
  await reason(page, "Clasificar organización", "Marcar como prueba");
  await expect(
    drawer.getByRole("button", { name: "Marcar como cliente", exact: true }),
  ).toBeVisible();
  await drawer
    .getByRole("button", { name: "Marcar como cliente", exact: true })
    .click();
  await reason(page, "Clasificar organización", "Marcar como cliente");
  await drawer
    .getByRole("button", { name: "Cambiar plan", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Cambiar plan", exact: true })
    .getByRole("combobox", { name: "Plan", exact: true })
    .selectOption("free");
  await reason(page, "Cambiar plan");
  await drawer
    .getByRole("button", { name: "Extender prueba", exact: true })
    .click();
  await reason(page, "Extender prueba");
  await drawer
    .getByRole("button", { name: "Cerrar ficha de organización" })
    .click();
  await page
    .getByLabel("Más acciones de Audit Customer", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Suspender acceso", exact: true })
    .click();
  await reason(page, "Suspender acceso");
  await page
    .getByLabel("Más acciones de Audit Customer", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Reactivar acceso", exact: true })
    .click();
  await reason(page, "Reactivar acceso");
  await page
    .getByRole("main", { name: "Administración SaaS" })
    .evaluate((element) => {
      element.scrollTop = 0;
    });
  await page.screenshot({
    path: ".tmp/platform-validation/platform-real-organizations.png",
    fullPage: true,
  });
});

test("real API: user actions and manual audit filters persist across tabs", async ({
  page,
}) => {
  let eventRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/platform-admin/audit-logs/?")) eventRequests++;
  });
  await login(page);
  await navigate(page, "Usuarios");
  await page
    .getByPlaceholder("Buscar por nombre, correo u organización")
    .fill("member@example.test");
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
  await page.getByText("Filtros avanzados", { exact: true }).click();
  await page
    .getByLabel("Organización por nombre o slug")
    .fill("audit-customer");
  await page
    .getByRole("combobox", { name: "Rol", exact: true })
    .selectOption("viewer");
  await page
    .getByRole("combobox", { name: "Correo confirmado", exact: true })
    .selectOption("true");
  await page
    .getByRole("combobox", { name: "2FA", exact: true })
    .selectOption("false");
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
  await page
    .getByRole("combobox", { name: "Rol", exact: true })
    .selectOption("");
  await page
    .getByRole("combobox", { name: "Correo confirmado", exact: true })
    .selectOption("");
  await page
    .getByRole("combobox", { name: "2FA", exact: true })
    .selectOption("");
  for (const label of [
    "Desactivar cuenta",
    "Activar cuenta",
    "Asignar como administrador",
    "Asignar lectura heredada",
    "Cerrar sesiones web",
  ]) {
    await page
      .getByLabel("Más acciones de member@example.test", { exact: true })
      .click();
    await page.getByRole("button", { name: label, exact: true }).click();
    const modal = page.getByRole("dialog", { name: label, exact: true });
    await modal
      .getByLabel("Motivo para la auditoría")
      .fill("Isolated browser validation");
    await modal.getByRole("button", { name: label, exact: true }).click();
    await expect(modal).toHaveCount(0);
  }
  await page
    .getByLabel("Más acciones de member@example.test", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ver auditoría", exact: true })
    .click();
  const audit = page.getByRole("region", { name: "Eventos de auditoría" });
  await expect(
    audit.getByText("Los eventos se consultan únicamente al solicitarlos."),
  ).toBeVisible();
  expect(eventRequests).toBe(0);
  await audit.getByLabel("Desde", { exact: true }).fill("2026-11-09T00:00");
  await audit.getByLabel("Hasta (exclusivo)").fill("2026-11-08T00:00");
  await expect(
    audit.getByRole("button", { name: "Consultar auditoría", exact: true }),
  ).toBeDisabled();
  expect(eventRequests).toBe(0);
  await audit
    .getByRole("button", { name: "Limpiar filtros", exact: true })
    .click();
  await audit.getByLabel("Organización (nombre o slug)").fill("audit-customer");
  await audit
    .getByRole("button", { name: "Consultar auditoría", exact: true })
    .click();
  await expect(audit.getByRole("button", { name: "Ver evento" })).toHaveCount(
    25,
  );
  await audit.getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect(audit.getByText("Página 2", { exact: true })).toBeVisible();
  const consultedRequests = eventRequests;
  await navigate(page, "Resumen SaaS");
  await navigate(page, "Auditoría");
  await expect(audit.getByText("Página 2", { exact: true })).toBeVisible();
  expect(eventRequests).toBe(consultedRequests);
  await audit.getByRole("button", { name: "Ver evento" }).first().click();
  await expect(
    page.getByRole("dialog", { name: "Detalle del evento" }),
  ).toContainText("Organización");
  await page
    .getByRole("dialog", { name: "Detalle del evento" })
    .getByRole("button", { name: "Cerrar detalle", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("main", { name: "Administración SaaS" })
    .evaluate((element) => {
      element.scrollTop = 0;
    });
  await page.screenshot({
    path: ".tmp/platform-validation/platform-real-audit-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.clock.install();
  await page.clock.fastForward(481000);
  await expect(
    page.getByText(/Tu sesión administrativa vence en/),
  ).toBeVisible();
  await page.clock.fastForward(121000);
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(
    page.getByText(/La sesión administrativa terminó/),
  ).toBeVisible();
});

test("real API: beta independent capacity, admissions and all invitation actions", async ({
  page,
}) => {
  await login(page);
  await navigate(page, "Beta");
  await page
    .getByRole("button", { name: "Configuración de beta", exact: true })
    .click();
  await expect(page.getByLabel("Cupos", { exact: true })).toHaveValue("50");
  await page.getByLabel("Cupos", { exact: true }).fill("49");
  await page
    .getByRole("button", { name: "Guardar cupos", exact: true })
    .click();
  await reason(page, "Guardar cupos");
  await page
    .getByRole("button", { name: "Cerrar admisiones", exact: true })
    .click();
  await reason(page, "Cerrar admisiones");
  await page
    .getByRole("button", { name: "Abrir admisiones", exact: true })
    .click();
  await reason(page, "Abrir admisiones");
  await page.keyboard.press("Escape");
  const pending = page
    .getByRole("listitem")
    .filter({ hasText: "invited@example.test" });
  await pending
    .getByLabel("Acciones de invited@example.test", { exact: true })
    .click();
  await pending
    .getByRole("button", { name: "Reenviar invitación", exact: true })
    .click();
  await reason(page, "Reenviar invitación");
  await pending
    .getByLabel("Acciones de invited@example.test", { exact: true })
    .click();
  await pending
    .getByRole("button", { name: "Revocar invitación", exact: true })
    .click();
  await reason(page, "Revocar invitación");
  await page
    .getByLabel("Acciones de pending_verification@example.test", {
      exact: true,
    })
    .click();
  await page
    .getByRole("listitem")
    .filter({ hasText: "pending_verification@example.test" })
    .getByRole("button", { name: "Rechazar solicitud", exact: true })
    .click();
  await reason(page, "Rechazar solicitud");
  const active = page
    .getByRole("listitem")
    .filter({ hasText: "active@example.test" });
  await active
    .getByLabel("Acciones de active@example.test", { exact: true })
    .click();
  await active
    .getByRole("button", { name: "Suspender acceso", exact: true })
    .click();
  await reason(page, "Suspender acceso");
  await active
    .getByLabel("Acciones de active@example.test", { exact: true })
    .click();
  await active
    .getByRole("button", { name: "Reactivar acceso", exact: true })
    .click();
  await reason(page, "Reactivar acceso");
  const invitedEmail = `new-invite-${Date.now()}@example.test`;
  await page
    .getByRole("button", { name: "Invitar participante", exact: true })
    .click();
  await page.getByLabel("Correo de invitación").fill(invitedEmail);
  await page
    .getByRole("button", { name: "Enviar invitación", exact: true })
    .click();
  await reason(page, "Enviar invitación");
  await page
    .getByRole("button", { name: "Volver a participantes", exact: true })
    .click();
  await expect(
    page.getByRole("listitem").filter({ hasText: invitedEmail }),
  ).toBeVisible();
  await page
    .getByRole("main", { name: "Administración SaaS" })
    .evaluate((element) => {
      element.scrollTop = 0;
    });
  await page.screenshot({
    path: ".tmp/platform-validation/platform-real-beta.png",
    fullPage: true,
  });
});

test("real API: portal visual parity visual parity use independent sessions", async ({
  page,
  browser,
}) => {
  await login(page);
  await expect(
    page.getByRole("button", {
      name: "Buscar clientes y usuarios",
      exact: true,
    }),
  ).toHaveCount(0);
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
  });
  try {
    const portal = await context.newPage();
    await portal.goto("/login");
    const suffix = process.env.E2E_FIXTURE_SUFFIX || "superadmin-final-1108";
    await portal
      .getByPlaceholder("usuario@dominio.com")
      .fill(`e2e-admin-${suffix}@example.test`);
    await portal
      .getByPlaceholder("••••••••••••")
      .fill("E2e-Admin-Password-123!");
    await portal
      .getByRole("button", { name: "Ingresar a la Plataforma" })
      .click();
    await expect(portal).toHaveURL(/\/dashboard$/);
    await portal.goto("/monitoring");
    await expect(
      portal.getByRole("heading", { name: "Uptime & Latencia", exact: true }),
    ).toBeVisible();
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1366, height: 768 },
      { width: 390, height: 844 },
    ]) {
      await portal.setViewportSize(viewport);
      await portal.screenshot({
        path: `.tmp/platform-validation/shell-portal-${viewport.width}.png`,
        fullPage: true,
      });
      expect(
        await portal.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(viewport.width);
    }
  } finally {
    await context.close();
  }
});
