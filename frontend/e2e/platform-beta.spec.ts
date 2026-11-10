import { expect, test } from "@playwright/test";
import { fixture, organization } from "./platform-fixtures";

test("beta console: only the selected section queries and summary prepares the exact beta filter", async ({
  page,
}) => {
  const paths: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/platform-admin/")) paths.push(r.url());
  });
  await fixture(page);
  expect(
    paths.filter(
      (p) =>
        p.includes("/stats/") ||
        p.includes("/health/") ||
        p.includes("/beta/?") ||
        p.includes("/audit-logs/"),
    ),
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Revisar accesos bloqueados", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Atención", exact: true }),
  ).toHaveValue("blocked");
  await expect
    .poll(() => paths.filter((p) => p.includes("/beta/?")).length)
    .toBe(1);
  expect(
    new URL(paths.find((p) => p.includes("/beta/?"))!).searchParams.get(
      "attention",
    ),
  ).toBe("blocked");
  await page.getByRole("link", { name: "Resumen SaaS", exact: true }).click();
  await page.getByText("Contexto comercial", { exact: true }).click();
  await expect
    .poll(() => paths.filter((p) => p.includes("/stats/")).length)
    .toBe(1);
});

test("beta console: health stays manual, handles a failed refresh and copies only diagnostic fields", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await fixture(page);
  let reads = 0;
  await page.route("**/api/v1/platform-admin/health/", (route) => {
    reads++;
    return reads === 1
      ? route.fulfill({
          json: {
            data: {
              status: "degraded",
              queried_at: new Date().toISOString(),
              environment: "development",
              scope: "Mensajes listos",
              components: { database: { status: "healthy", latency_ms: 2 } },
              queues: [
                { name: "monitoring", ready: null, status: "unavailable" },
              ],
              connection: "PRIVATE_SECRET",
            },
          },
        })
      : route.fulfill({ status: 503, json: { message: "Fixture failure" } });
  });
  await page
    .getByRole("link", { name: "Salud de plataforma", exact: true })
    .click();
  await expect(page.getByText("No disponible", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Copiar diagnóstico", exact: true })
    .click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("monitoring: No disponible");
  expect(copied).not.toContain("PRIVATE_SECRET");
  await page.getByRole("link", { name: "Usuarios", exact: true }).click();
  await page
    .getByRole("link", { name: "Salud de plataforma", exact: true })
    .click();
  expect(reads).toBe(1);
  await page
    .getByRole("button", { name: "Actualizar diagnóstico", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Los datos anteriores pueden estar desactualizados",
  );
  expect(reads).toBe(2);
});

test("beta console: user detail is fetched on demand and shows custom access without changing directory context", async ({
  page,
}) => {
  await fixture(page);
  let details = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/users/user/")) details++;
  });
  await page.getByRole("link", { name: "Usuarios", exact: true }).click();
  expect(details).toBe(0);
  await page
    .getByRole("button", {
      name: "Ver ficha de member@example.test",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Ficha de usuario",
    exact: true,
  });
  await expect(
    dialog.getByText("Operador personalizado", { exact: true }),
  ).toBeVisible();
  await dialog
    .getByText("Consultar permisos efectivos (1)", { exact: true })
    .click();
  await expect(
    dialog.getByText("monitoring.read", { exact: true }),
  ).toBeVisible();
  expect(details).toBe(1);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", {
      name: "Ver ficha de member@example.test",
      exact: true,
    }),
  ).toBeFocused();
});

test("beta console: a failed plan preview prevents submission including Enter", async ({
  page,
}) => {
  await fixture(page);
  let mutations = 0;
  await page.route(
    "**/api/v1/platform-admin/organizations/client/plan-preview/",
    (route) =>
      route.fulfill({
        status: 500,
        json: { message: "Fixture preview failure" },
      }),
  );
  page.on("request", (r) => {
    if (r.url().endsWith("/set-plan/")) mutations++;
  });
  await page.getByRole("link", { name: "Organizaciones", exact: true }).click();
  await page
    .getByLabel("Más acciones de " + organization.name, { exact: true })
    .click();
  await page.getByRole("button", { name: "Cambiar plan", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Cambiar plan", exact: true });
  await modal.getByLabel("Motivo para auditoría").fill("Valid operator reason");
  await expect(modal.getByRole("alert")).toContainText(
    "No se pudo calcular el impacto",
  );
  await expect(
    modal.getByRole("button", { name: "Cambiar plan", exact: true }),
  ).toBeDisabled();
  await modal
    .getByRole("combobox", { name: "Suscripción", exact: true })
    .press("Enter");
  expect(mutations).toBe(0);
});

test("beta console: feedback configuration has its own reason and does not silently save cups", async ({
  page,
}) => {
  await fixture(page);
  const payloads: Record<string, unknown>[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/beta/"))
      payloads.push(r.postDataJSON());
  });
  await page.getByRole("link", { name: "Beta", exact: true }).click();
  await page
    .getByRole("button", { name: "Configuración de beta", exact: true })
    .click();
  await page.getByRole("button", { name: "Comentarios", exact: true }).click();
  await page
    .getByLabel("Enlace del formulario", { exact: true })
    .fill("https://forms.example.test/beta");
  await page
    .getByLabel("Enlace de respuestas (sólo superadmins)", { exact: true })
    .fill("https://forms.example.test/private");
  await page
    .getByRole("button", { name: "Guardar canal de comentarios", exact: true })
    .click();
  const modal = page.getByRole("dialog", {
    name: "Guardar canal de comentarios",
    exact: true,
  });
  await modal
    .getByLabel("Motivo para auditoría")
    .fill("Enable isolated beta feedback");
  await modal
    .getByRole("button", { name: "Guardar canal de comentarios", exact: true })
    .click();
  await expect(modal).toHaveCount(0);
  expect(payloads).toEqual([
    {
      action: "configure_feedback",
      feedback_submission_url: "https://forms.example.test/beta",
      feedback_management_url: "https://forms.example.test/private",
      reason: "Enable isolated beta feedback",
    },
  ]);
});

test("beta portal: opens the external form without transmitting identity", async ({
  page,
}) => {
  const user = {
    id: "participant",
    email: "participant@example.test",
    is_staff: false,
    is_superuser: false,
    is_active: true,
    authorization_mode: "custom",
    effective_permissions: ["monitoring.read"],
    organization: {
      id: "beta-org",
      name: "Beta fixture",
      timezone: "America/Guatemala",
      locale: "es-GT",
      beta_managed: true,
    },
  };
  await page.addInitScript((user) => {
    localStorage.setItem("access_token", "isolated-portal-token");
    localStorage.setItem("refresh_token", "isolated-refresh-token");
    localStorage.setItem(
      "auth-storage",
      JSON.stringify({
        version: 0,
        state: { user, isAuthenticated: true, sessionId: "beta-fixture" },
      }),
    );
  }, user);
  let feedbackEnabled = true;
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith("/auth/me/")
      ? user
      : path.endsWith("/beta-feedback/")
        ? {
            enabled: feedbackEnabled,
            submission_url: feedbackEnabled
              ? "https://forms.example.test/beta"
              : null,
            beta_participant: true,
          }
        : path.endsWith("/subscription/")
          ? {
              plan_tier: "free",
              monitoring_allowed: true,
              limits: { min_check_interval_seconds: 300 },
              usage: {},
            }
          : [];
    return route.fulfill({ json: { success: true, data } });
  });
  await page.goto("/monitoring");
  const link = page.getByRole("link", {
    name: "Enviar comentario",
    exact: true,
  });
  await expect(link).toHaveAttribute("href", "https://forms.example.test/beta");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  expect(await link.getAttribute("href")).not.toContain(user.email);
  expect(await link.getAttribute("href")).not.toContain(user.organization.id);
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const bounds = await link.boundingBox();
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  feedbackEnabled = false;
  await page.reload();
  await expect(
    page.getByText("Comentarios: pendiente de configurar", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("beta console: a changed organization never renders the previous client's actions", async ({
  page,
}) => {
  await fixture(page);
  await page.route("**/api/v1/platform-admin/organizations/?*", (route) =>
    route.fulfill({
      json: {
        data: [
          organization,
          { ...organization, id: "other", name: "Another customer" },
        ],
        meta: { total: 2, page: 1, page_size: 25, has_next: false },
      },
    }),
  );
  let finish: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route(
    "**/api/v1/platform-admin/organizations/client/?*",
    async (route) => {
      await gate;
      await route
        .fulfill({
          json: {
            data: {
              ...organization,
              users: [],
              targets: [],
              probes: [],
              recent_audits: [],
              resource_usage: [],
            },
          },
        })
        .catch(() => undefined);
    },
  );
  await page.route("**/api/v1/platform-admin/organizations/other/?*", (route) =>
    route.fulfill({
      json: {
        data: {
          ...organization,
          id: "other",
          name: "Another customer",
          is_in_trial: false,
          trial_ends_at: "2030-01-01T00:00:00Z",
          users: [],
          targets: [],
          probes: [],
          recent_audits: [],
          resource_usage: [],
        },
      },
    }),
  );
  await page.getByRole("link", { name: "Organizaciones", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Ver ficha de " + organization.name,
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Cerrar ficha de organización", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ver ficha de Another customer", exact: true })
    .click();
  finish();
  const drawer = page.getByRole("dialog", {
    name: "Ficha de organización",
    exact: true,
  });
  await expect(
    drawer.getByRole("heading", { name: "Another customer", exact: true }),
  ).toBeVisible();
  await expect(
    drawer.getByRole("heading", { name: organization.name, exact: true }),
  ).toHaveCount(0);
  await expect(drawer).toContainText("Sin prueba vigente · fecha registrada:");
  await expect(drawer).not.toContainText("Finalizó:");
});
