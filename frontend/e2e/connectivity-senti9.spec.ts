import { expect, request, test, type Page } from "@playwright/test";
import { readFile, unlink, mkdir } from "node:fs/promises";
import path from "node:path";

const url = (process.env.E2E_API_URL || "http://127.0.0.1:8000/api/v1").replace(
  /\/$/,
  "",
);
const suffix = process.env.E2E_FIXTURE_SUFFIX || "local-beta-fixture";
let session: { access_token: string; refresh_token: string; user: object };
test.beforeAll(async () => {
  const api = await request.newContext();
  const r = await api.post(url + "/auth/login/", {
    data: {
      email: `e2e-admin-${suffix}@example.test`,
      password: "E2e-Admin-Password-123!",
    },
  });
  expect(r.ok()).toBeTruthy();
  session = (await r.json()).data;
  const me = await api.get(url + "/auth/me/", {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  session.user = (await me.json()).data;
  await api.dispose();
});
async function login(page: Page) {
  await page.addInitScript((s) => {
    localStorage.setItem("access_token", s.access_token);
    localStorage.setItem("refresh_token", s.refresh_token);
    localStorage.setItem(
      "auth-storage",
      JSON.stringify({
        state: {
          user: s.user,
          accessToken: s.access_token,
          refreshToken: s.refresh_token,
          isAuthenticated: true,
        },
        version: 0,
      }),
    );
  }, session);
}

test("Senti9 registration, private token file, first signal and archive use real isolated API", async ({
  page,
  request: api,
}) => {
  await login(page);
  await page.goto("/senti9");
  const name = `Senti9 browser ${Date.now()}`;
  await page
    .getByRole("button", { name: "Registrar Senti9", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Registrar Senti9" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "Nombre del agente" }).fill(name);
  await dialog.getByRole("radio", { name: /Windows/ }).check();
  const created = page.waitForResponse(
    (r) =>
      r.url().endsWith("/agent-probes/") && r.request().method() === "POST",
  );
  await dialog
    .getByRole("button", { name: "Registrar agente", exact: true })
    .click();
  const probe = (await (await created).json()).data;
  expect(probe.version).toBe("");
  expect(await dialog.innerText()).not.toContain(probe.raw_token);
  const download = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Descargar archivo de token", exact: true })
    .click();
  const file = path.resolve("../.tmp/senti9-browser-token.txt");
  await (await download).saveAs(file);
  try {
    const token = await readFile(file, "utf8");
    expect(token).toBe(probe.raw_token);
    const storage = await page.evaluate(() =>
      JSON.stringify({ ...localStorage }),
    );
    expect(storage).not.toContain(token);
    await dialog
      .getByRole("checkbox", {
        name: "Guardé el archivo en una ubicación privada.",
      })
      .check();
    await dialog
      .getByRole("textbox", { name: "Ruta del archivo de token" })
      .fill("C:\\Agente Sentinel\\senti9-token.txt");
    await expect(
      dialog
        .getByRole("region", { name: "4. Inicia el agente" })
        .locator("pre"),
    ).toContainText(/\$\{?TokenPath/);
    await dialog.screenshot({
      path: "../docs/assets/connectivity-implementation-20261110/senti9-install-windows.png",
    });
    await dialog
      .getByRole("button", { name: "Comprobar conexión", exact: true })
      .click();
    const heartbeat = await api.post(url + "/agent-probes/heartbeat/", {
      headers: { "X-Probe-Token": token },
      data: {
        hostname: "browser-isolated",
        version: "1.8.0",
        delivery_protocol: 2,
        capacity: 0,
      },
    });
    expect(heartbeat.ok()).toBeTruthy();
    await expect(
      dialog.getByRole("heading", { name: "Conexión confirmada", exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await page.screenshot({
      path: "../docs/assets/connectivity-implementation-20261110/senti9-first-signal.png",
    });
    await dialog
      .getByRole("button", { name: "Crear monitor privado", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`agent=${probe.id}`));
    await expect(
      page
        .getByRole("dialog")
        .locator("select")
        .filter({ has: page.locator(`option[value="${probe.id}"]`) }),
    ).toHaveValue(probe.id);
    await page.keyboard.press("Escape");
    await page.goto("/senti9");
    await page.getByRole("textbox", { name: "Buscar agente" }).fill(name);
    await page
      .getByRole("button", { name: `Ver detalle de ${name}`, exact: true })
      .click();
    const detail = page.getByRole("dialog");
    await detail
      .getByRole("button", { name: "Administrar", exact: true })
      .click();
    await detail
      .getByRole("button", { name: "Retirar agente", exact: true })
      .click();
    await detail
      .getByLabel("Motivo obligatorio")
      .fill("Retiro de fixture aislado");
    await detail
      .getByRole("button", {
        name: "Revocar agente y pausar monitores",
        exact: true,
      })
      .click();
    await expect(detail).toContainText("Sus monitores quedaron pausados");
    const rejected = await api.get(url + "/agent-probes/diagnostic/", {
      headers: { "X-Probe-Token": token },
    });
    expect(rejected.status()).toBe(401);
  } finally {
    await unlink(file).catch(() => {});
  }
});

for (const size of [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
]) {
  test(`connectivity directories have readable states without document overflow at ${size.width}`, async ({
    page,
  }) => {
    await login(page);
    await page.setViewportSize(size);
    await mkdir("../docs/assets/connectivity-consistency-real-20261112", {
      recursive: true,
    });
    for (const route of [
      "monitoring",
      "ssl",
      "dns",
      "domains",
      "api-checks",
      "security-headers",
      "senti9",
    ]) {
      const endpoint =
        (
          {
            ssl: "ssl-certificates",
            dns: "dns-records",
            senti9: "agent-probes",
          } as Record<string, string>
        )[route] || route;
      const directoryResponse = page.waitForResponse((response) => {
        const location = new URL(response.url());
        return (
          response.request().method() === "GET" &&
          location.pathname.endsWith(`/api/v1/${endpoint}/`) &&
          location.searchParams.has("page")
        );
      });
      await page.goto("/" + route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const { meta } = await (await directoryResponse).json();
      expect(meta.page_size).toBe(25);
      const pagination = page.getByRole("navigation", {
        name: "Páginas de recursos",
      });
      if (meta.total_pages > 1)
        await expect(pagination).toContainText(/\d+ resultados/);
      else await expect(pagination).toHaveCount(0);
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
      await page.screenshot({
        path: `../docs/assets/connectivity-consistency-real-20261112/${route}-${size.width}.png`,
        fullPage: true,
      });
    }
  });
}

test("ambiguous bulk API failure keeps selection and sends no individual retries", async ({
  page,
}) => {
  await login(page);
  let individual = 0,
    bulk = 0;
  await page.route("**/api/v1/api-checks/**", async (route) => {
    const req = route.request();
    const endpoint = new URL(req.url()).pathname;
    if (req.method() === "DELETE") {
      individual++;
      return route.fulfill({ status: 503, json: { success: false } });
    }
    if (endpoint.endsWith("/bulk-action/")) {
      bulk++;
      return route.fulfill({ status: 503, json: { success: false } });
    }
    if (endpoint.endsWith("/api-checks/"))
      return route.fulfill({
        json: {
          success: true,
          data: [
            {
              id: "a1",
              name: "Ambiguous fixture",
              url: "https://example.test",
              method: "GET",
              enabled: true,
              last_status: "pass",
            },
          ],
          meta: {
            page: 1,
            total: 1,
            page_size: 25,
            has_next: false,
            total_pages: 1,
          },
        },
      });
    return route.continue();
  });
  await page.goto("/api-checks");
  await page.getByRole("checkbox").first().check();
  await page
    .getByRole("button", { name: "Eliminar", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Eliminar selección", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: /selección|confirmar/ }),
  ).toBeVisible();
  expect(bulk).toBe(1);
  expect(individual).toBe(0);
  await expect(page.getByRole("checkbox").first()).toBeChecked();
});

test("Senti9 stops verification after two minutes, reports copy failure and restores focus", async ({
  page,
}) => {
  await page.clock.install();
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("blocked");
        },
      },
    }),
  );
  await login(page);
  await page.goto("/senti9");
  const trigger = page.getByRole("button", {
    name: "Registrar Senti9",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Registrar Senti9" });
  await dialog.getByLabel("Nombre del agente").fill(`Sin señal ${Date.now()}`);
  await dialog
    .getByRole("button", { name: "Registrar agente", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Copiar: 1. Comprueba Docker", exact: true })
    .first()
    .click();
  await expect(dialog).toContainText("No se pudo copiar");
  const download = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Descargar archivo de token", exact: true })
    .click();
  await download;
  await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "Comprobar conexión", exact: true })
    .click();
  await page.clock.runFor(121000);
  await expect(
    dialog.getByRole("heading", {
      name: "Conexión sin confirmar",
      exact: true,
    }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Volver a las instrucciones de instalación" })
    .click();
  await expect(
    dialog.getByRole("button", {
      name: "Descargar archivo de token",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(dialog.getByRole("checkbox")).toBeChecked();
  await dialog
    .getByRole("button", { name: "Comprobar conexión", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", {
      name: "Esperando la primera señal",
      exact: true,
    }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("deleting the last directory page returns to a valid page without another mutation", async ({
  page,
}) => {
  await login(page);
  let deleted = false,
    mutations = 0;
  const item = (id: string) => ({
    id,
    name: `Recurso ${id}`,
    url: "https://example.test",
    method: "GET",
    enabled: true,
    last_status: null,
    expected_response_time_ms: 2000,
  });
  await page.route("**/api/v1/api-checks/**", async (route) => {
    const request = route.request(),
      location = new URL(request.url());
    if (location.pathname.endsWith("/bulk-action/")) {
      mutations++;
      deleted = true;
      return route.fulfill({
        json: {
          success: true,
          data: { results: [{ id: "last", state: "applied" }] },
        },
      });
    }
    if (location.pathname.endsWith("/stats/"))
      return route.fulfill({
        json: {
          data: {
            total: deleted ? 25 : 26,
            pass_count: 0,
            slow_count: 0,
            fail_count: 0,
            paused_count: 0,
            avg_latency: null,
          },
        },
      });
    const pageNumber = Number(location.searchParams.get("page") || 1);
    if (pageNumber === 2 && deleted)
      return route.fulfill({
        status: 400,
        json: { page: ["Página fuera de rango."] },
      });
    const rows =
      pageNumber === 2
        ? [item("last")]
        : Array.from({ length: 25 }, (_, i) => item(String(i)));
    return route.fulfill({
      json: {
        success: true,
        data: rows,
        meta: {
          page: pageNumber,
          page_size: 25,
          total: deleted ? 25 : 26,
          total_pages: deleted ? 1 : 2,
          has_next: pageNumber === 1 && !deleted,
        },
      },
    });
  });
  await page.goto("/api-checks");
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect(
    page.getByRole("row", { name: "Recurso last", exact: true }),
  ).toBeVisible();
  await page.getByRole("checkbox").first().check();
  await page
    .getByRole("button", { name: "Eliminar", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Eliminar selección", exact: true })
    .click();
  await expect(
    page.getByRole("navigation", { name: "Páginas de recursos" }),
  ).toHaveCount(0);
  await expect(
    page.getByTestId("connectivity-table").locator("tbody tr"),
  ).toHaveCount(25);
  await expect(
    page.getByRole("row", { name: "Recurso last", exact: true }),
  ).toHaveCount(0);
  expect(mutations).toBe(1);
});
