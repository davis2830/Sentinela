import { expect, test, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";

test.skip(
  process.env.PLATFORM_ISOLATED !== "1",
  "Requires guarded isolated beta fixtures and locmem mail.",
);
test.setTimeout(120000);
test.use({
  viewport: { width: 1440, height: 900 },
  hasTouch: true,
  actionTimeout: 10000,
});
async function nav(page: Page, name: string) {
  if ((page.viewportSize()?.width || 1440) < 768)
    await page
      .getByRole("button", { name: "Abrir menú administrativo", exact: true })
      .tap();
  await page.getByRole("link", { name, exact: true }).click();
}
function otp() {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const mac = createHmac("sha1", Buffer.from("48656c6c6f21deadbeef", "hex"))
    .update(counter)
    .digest();
  return String(
    (mac.readUInt32BE(mac[19] & 15) & 0x7fffffff) % 1000000,
  ).padStart(6, "0");
}
test("real beta console: verification, feedback, contact, resources, user detail, manual audit and six responsive sections", async ({
  page,
}) => {
  let auditRequests = 0;
  const reactErrors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /same key|Cannot update a component|Uncaught/.test(message.text())
    )
      reactErrors.push(message.text());
  });
  page.on("pageerror", (error) => reactErrors.push(error.message));
  page.on("request", (r) => {
    if (r.url().includes("/platform-admin/audit-logs/?")) auditRequests++;
  });
  await page.goto("/admin/login");
  await page
    .getByLabel("Correo administrativo")
    .fill("operator-followup@example.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("Isolated-platform-fixture-2026");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("Código de autenticación").fill(otp());
  await page
    .getByRole("button", { name: "Entrar a la consola", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Indicadores de beta" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Revisar envíos fallidos", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Atención", exact: true }),
  ).toHaveValue("failed_delivery");
  const participant = page
    .getByRole("listitem")
    .filter({ hasText: "pending_verification@example.test" });
  await participant
    .getByRole("button", { name: "Reenviar verificación", exact: true })
    .click();
  const resend = page.getByRole("dialog", {
    name: "Reenviar verificación",
    exact: true,
  });
  await resend
    .getByLabel("Motivo para auditoría")
    .fill("Isolated beta recovery");
  await resend
    .getByRole("button", { name: "Reenviar verificación", exact: true })
    .click();
  await expect(resend).toHaveCount(0);
  await page
    .getByRole("button", { name: "Limpiar filtros", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Buscar participantes", exact: true })
    .fill("pending_verification@example.test");
  await expect(participant).toContainText(
    /Verificación: (En cola|Aceptado por servidor de correo)/,
  );
  await page
    .getByRole("button", { name: "Configuración de beta", exact: true })
    .click();
  await page.getByRole("button", { name: "Comentarios", exact: true }).click();
  await page
    .getByLabel("Enlace del formulario", { exact: true })
    .fill("https://forms.example.test/closed-beta");
  await page
    .getByLabel("Enlace de respuestas (sólo superadmins)", { exact: true })
    .fill("https://forms.example.test/responses");
  await page
    .getByRole("button", { name: "Guardar canal de comentarios", exact: true })
    .click();
  const feedback = page.getByRole("dialog", {
    name: "Guardar canal de comentarios",
    exact: true,
  });
  await feedback
    .getByLabel("Motivo para auditoría")
    .fill("Isolated external feedback");
  await feedback
    .getByRole("button", { name: "Guardar canal de comentarios", exact: true })
    .click();
  await expect(feedback).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Abrir respuestas", exact: true }),
  ).toHaveAttribute("href", "https://forms.example.test/responses");
  await page.keyboard.press("Escape");
  await nav(page, "Organizaciones");
  await page
    .getByPlaceholder(
      "Buscar por nombre de empresa, slug o email de facturación...",
    )
    .fill("Audit Customer");
  await page
    .getByRole("button", { name: "Ver ficha de Audit Customer", exact: true })
    .click();
  const drawer = page.getByRole("dialog", {
    name: "Ficha de organización",
    exact: true,
  });
  await drawer
    .getByRole("button", { name: "Editar contacto", exact: true })
    .click();
  const contact = page.getByRole("dialog", {
    name: "Editar contacto",
    exact: true,
  });
  await contact
    .getByLabel("Teléfono de contacto", { exact: true })
    .fill("5550-0101");
  await contact
    .getByLabel("Motivo para auditoría")
    .fill("Isolated contact correction");
  await contact
    .getByRole("button", { name: "Editar contacto", exact: true })
    .click();
  await expect(contact).toHaveCount(0);
  await expect(drawer).toHaveCount(1);
  await expect(drawer.getByText("5550-0101", { exact: true })).toBeVisible();
  await drawer
    .getByRole("button", { name: "Recursos y límites", exact: true })
    .click();
  await drawer.getByRole("button", { name: /^Uptime/ }).click();
  await expect(
    drawer.getByRole("heading", { name: "Uptime · 26 registros", exact: true }),
  ).toBeVisible();
  expect(await drawer.textContent()).not.toContain("PRIVATE_FIXTURE_QUERY");
  await drawer.getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect(drawer.getByText("Página 2", { exact: true })).toBeVisible();
  for (const name of [
    "SSL",
    "DNS",
    "Dominios",
    "API Checks",
    "Security Headers",
  ]) {
    await drawer.getByRole("button", { name: new RegExp("^" + name) }).click();
    await expect(
      drawer.getByRole("heading", {
        name: new RegExp("^" + name + " · 1 registros"),
      }),
    ).toBeVisible();
  }
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(drawer).toBeVisible();
    expect(
      await drawer.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page.screenshot({
      path: test.info().outputPath("Ficha-recursos-" + viewport.width + ".png"),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await drawer.getByRole("button", { name: /^Usuarios/ }).click();
  const member = drawer
    .getByRole("listitem")
    .filter({ hasText: "member@example.test" });
  await member
    .getByRole("button", { name: "Ver ficha de usuario", exact: true })
    .click();
  const user = page.getByRole("dialog", {
    name: "Ficha de usuario",
    exact: true,
  });
  await expect(
    user.getByRole("heading", { name: "member@example.test", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeVisible();
  await drawer
    .getByRole("button", { name: "General y contacto", exact: true })
    .click();
  await drawer
    .getByRole("button", {
      name: "Preparar consulta de auditoría",
      exact: true,
    })
    .click();
  expect(auditRequests).toBe(0);
  await page
    .getByRole("button", { name: "Consultar auditoría", exact: true })
    .click();
  await expect.poll(() => auditRequests).toBe(1);
  expect(reactErrors).toEqual([]);
  for (const section of [
    "Resumen SaaS",
    "Beta",
    "Organizaciones",
    "Usuarios",
    "Salud de plataforma",
    "Auditoría",
  ]) {
    await nav(page, section);
    if (section === "Salud de plataforma") {
      await expect(
        page.getByRole("heading", { name: "Colas de trabajo", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Copiar diagnóstico", exact: true }),
      ).toBeEnabled();
    }
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1366, height: 768 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page
        .getByRole("main", { name: "Administración SaaS" })
        .evaluate((el) => {
          el.scrollTop = 0;
        });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        await page
          .getByRole("main")
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      await page.screenshot({
        path: test
          .info()
          .outputPath(
            section.replaceAll(" ", "-") + "-" + viewport.width + ".png",
          ),
        fullPage: true,
      });
    }
  }
});
