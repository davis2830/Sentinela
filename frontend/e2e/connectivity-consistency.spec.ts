import { expect, request, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const apiURL = (
  process.env.E2E_API_URL || "http://localhost:8000/api/v1"
).replace(/\/$/, "");
const suffix = process.env.E2E_FIXTURE_SUFFIX || "local-beta-fixture";
const evidence = "../docs/assets/connectivity-direct-actions-20261112";
let session: { access_token: string; refresh_token: string; user: object };
test.beforeAll(async () => {
  const api = await request.newContext();
  const response = await api.post(`${apiURL}/auth/login/`, {
    data: {
      email: `e2e-admin-${suffix}@example.test`,
      password: "E2e-Admin-Password-123!",
    },
  });
  expect(response.status()).toBe(200);
  session = (await response.json()).data;
  const me = await api.get(`${apiURL}/auth/me/`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  session.user = (await me.json()).data;
  await api.dispose();
  await mkdir(evidence, { recursive: true });
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
    for (const key of [
      "monitoring",
      "ssl",
      "ssl_certificates",
      "domains",
      "dns_records",
      "api_checks",
      "security_headers",
    ])
      localStorage.setItem(`sentinel_view_mode_${key}`, "table");
  }, session);
}
const modules = [
  ["monitoring", "monitoring"],
  ["ssl", "ssl-certificates"],
  ["dns", "dns-records"],
  ["domains", "domains"],
  ["api-checks", "api-checks"],
  ["security-headers", "security-headers"],
] as const;
const stamp = new Date().toISOString();
function resources(module: string, count: number): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `resource-${i}`,
    organization: "fixture",
    name: `Servicio ${String(i + 1).padStart(2, "0")}`,
    domain: `example-${i + 1}.test`,
    endpoint: `https://example-${i + 1}.test`,
    url: `https://example-${i + 1}.test`,
    enabled: true,
    created_at: stamp,
    updated_at: stamp,
    interval: 300,
    target_type: "https",
    tags: ["produccion"],
    runner_type: "cloud",
    last_status: module === "api-checks" ? "pass" : "up",
    last_checked_at: stamp,
    last_scanned_at: stamp,
    last_successful_at: stamp,
    last_latency: 110,
    max_latency_ms: 2000,
    issuer: "Fixture CA",
    is_valid: true,
    days_remaining: 120,
    port: 443,
    san_domains: [],
    security_grade: "A",
    tls_version: "TLSv1.3",
    issued_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    expiration_date: new Date(Date.now() + 120 * 86400000).toISOString(),
    error_message: "",
    last_error_code: "",
    status: "active",
    days_until_expiration: 120,
    is_locked: true,
    registrar: "Fixture registrar",
    name_servers: [],
    record_type: "A",
    value: "203.0.113.10",
    ttl: 300,
    response_time_ms: 30,
    last_attempt_status: "resolved",
    last_change_at: null,
    method: "GET",
    expected_status: 200,
    expected_response_time_ms: 500,
    expected_schema: {},
    last_http_status: 200,
    last_response_time_ms: 110,
    last_score: 87,
    last_grade: "A",
    has_hsts: true,
    has_csp: true,
    has_x_frame_options: true,
    info_leak_detected: false,
  }));
}
async function transport(
  page: Page,
  module: string,
  count = 3,
  suppliedRows?: Record<string, unknown>[],
) {
  const writes: string[] = [],
    reads: string[] = [];
  const rows = suppliedRows ?? resources(module, count);
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    const path = url.pathname.replace("/api/v1/", "");
    if (req.method() !== "GET") {
      writes.push(`${req.method()} ${path}`);
      return route.fulfill({
        status: 500,
        json: { message: "Unexpected mutation in read-only UI test" },
      });
    }
    reads.push(path);
    if (path === "organizations/current/subscription/")
      return route.fulfill({
        json: {
          data: {
            monitoring_allowed: true,
            limits: { min_check_interval_seconds: 300 },
          },
        },
      });
    if (path === `${module}/stats/`)
      return route.fulfill({
        json: {
          data: {
            total: count,
            valid: count,
            expiring: 0,
            expiring_30d: 0,
            expiring_15d: 0,
            expired: 0,
            invalid: 0,
            active: count,
            locked: count,
            pass: count,
            slow: 0,
            fail: 0,
            paused: 0,
            healthy: count,
            warning: 0,
            critical: 0,
            unmeasured: 0,
            pass_count: count,
            slow_count: 0,
            fail_count: 0,
            paused_count: 0,
            info_leaks_count: 0,
          },
        },
      });
    if (path === `${module}/`) {
      const p = url.searchParams,
        search = (p.get("search") || "").toLowerCase();
      let selected = rows.filter(
        (r) =>
          !search ||
          String(r.name).toLowerCase().includes(search) ||
          String(r.domain).includes(search),
      );
      if (p.get("type") && p.get("type") !== "all")
        selected = selected.filter(
          (r) =>
            (module === "dns-records" ? r.record_type : r.target_type) ===
            p.get("type"),
        );
      if (p.get("method") && p.get("method") !== "all")
        selected = selected.filter((r) => r.method === p.get("method"));
      if (
        ["down", "slow", "disabled", "expiring", "expired", "fail"].includes(
          p.get("status") || "",
        )
      )
        selected = [];
      const current = Number(p.get("page") || 1);
      return route.fulfill({
        json: {
          success: true,
          data: selected.slice((current - 1) * 25, current * 25),
          meta: {
            page: current,
            page_size: 25,
            total: selected.length,
            total_pages: Math.max(1, Math.ceil(selected.length / 25)),
            has_next: current * 25 < selected.length,
            summary: {
              total: count,
              up: rows.filter((row) => row.enabled && row.last_status === "up")
                .length,
              down: rows.filter(
                (row) =>
                  row.enabled &&
                  ["down", "error"].includes(String(row.last_status)),
              ).length,
              slow: rows.filter(
                (row) => row.enabled && row.last_status === "slow",
              ).length,
              paused: rows.filter((row) => !row.enabled).length,
            },
          },
        },
      });
    }
    return route.fallback();
  });
  return { writes, reads };
}

for (const [path, module] of modules)
  test(`shared Connectivity controls: ${path}`, async ({ page }) => {
    const traffic = await transport(page, module);
    await login(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/${path}`);
    const toolbar = page.locator(".connectivity-toolbar"),
      table = page.getByTestId("connectivity-table");
    await expect(table).toBeVisible();
    await expect(page.locator(".compact-summary-status")).toHaveCount(0);
    await expect(page.getByText(/^Datos consultados/)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Actualizar datos", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Páginas de recursos" }),
    ).toHaveCount(0);
    const checkbox = table.getByRole("checkbox").nth(1);
    await expect(checkbox).toBeVisible();
    const hit = await checkbox.boundingBox(),
      mark = await checkbox
        .locator('[aria-hidden="true"]')
        .first()
        .boundingBox();
    expect(hit!.width).toBe(44);
    expect(hit!.height).toBe(44);
    expect(mark!.width).toBe(20);
    expect(mark!.height).toBe(20);
    await checkbox.press("Space");
    await expect(checkbox).toBeChecked();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await checkbox.press("Space");
    await expect(checkbox).not.toBeChecked();

    const row = table.locator("tbody tr").first();
    const edit = row.getByRole("button", { name: /Editar/ });
    const remove = row.getByRole("button", { name: /Eliminar/ });
    await expect(edit).toBeVisible();
    await expect(remove).toBeVisible();
    await remove.hover();
    const hover = await remove
      .locator('[aria-hidden="true"]')
      .first()
      .evaluate((el) => ({
        radius: getComputedStyle(el).borderRadius,
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height,
      }));
    expect(hover.radius).toBe("8px");
    expect(hover.width).toBe(32);
    expect(hover.height).toBe(32);
    expect((await remove.boundingBox())!.height).toBe(44);
    await expect(page.getByRole("menu")).toHaveCount(0);
    await page.screenshot({ path: `${evidence}/${path}-actions.png` });
    await remove.click();
    const confirmation = page.getByRole("dialog");
    await expect(confirmation).toBeVisible();
    await confirmation
      .getByRole("button", { name: "Cancelar", exact: true })
      .click();
    await expect(confirmation).toHaveCount(0);
    await expect(remove).toBeFocused();
    await edit.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    // Escape from a text field closes the dialog; native selects can consume it.
    await page.getByRole("dialog").getByRole("textbox").first().focus();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(edit).toBeFocused();

    for (const width of [1440, 1366]) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 768 });
      expect((await toolbar.boundingBox())!.height).toBeLessThan(75);
      const actionsHeader = await table
        .getByRole("columnheader", { name: "Acciones", exact: true })
        .boundingBox();
      const tableBox = await table.boundingBox();
      expect(actionsHeader!.x + actionsHeader!.width).toBeLessThanOrEqual(
        tableBox!.x + tableBox!.width + 1,
      );
      expect(
        await page
          .locator("main")
          .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBeTruthy();
      // Reset only the table's internal scroll after exercising its rightmost actions.
      await table.locator(".overflow-x-auto").evaluateAll((elements) =>
        elements.forEach((el) => {
          el.scrollLeft = 0;
        }),
      );
      await page.screenshot({ path: `${evidence}/${path}-${width}.png` });
    }
    await toolbar
      .getByRole("button", { name: "Cuadrícula", exact: true })
      .click();
    const card = page.getByTestId("connectivity-card").first();
    const gridMark = card.getByRole("checkbox");
    const heading = card.locator("h3").first();
    await expect(gridMark).toBeVisible();
    expect(
      (await gridMark.locator('[aria-hidden="true"]').first().boundingBox())!
        .width,
    ).toBe(20);
    const selectionBox = await gridMark.boundingBox(),
      headingBox = await heading.boundingBox();
    expect(selectionBox!.y).toBeGreaterThan(headingBox!.y + headingBox!.height);
    await expect(card.locator("[data-card-selection]")).toBeVisible();
    const titlePosition = () =>
      heading.evaluate((el) => {
        const own = el.getBoundingClientRect();
        const root = el
          .closest('[data-testid="connectivity-card"]')!
          .getBoundingClientRect();
        return { x: own.x - root.x, y: own.y - root.y, width: own.width };
      });
    const before = await titlePosition();
    await gridMark.press("Space");
    await expect(gridMark).toBeChecked();
    expect(await titlePosition()).toEqual(before);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await gridMark.press("Space");
    await expect(gridMark).not.toBeChecked();
    expect(await titlePosition()).toEqual(before);
    await expect(card.getByRole("button", { name: /Editar/ })).toBeVisible();
    await expect(card.getByRole("button", { name: /Eliminar/ })).toBeVisible();
    await toolbar.click({ position: { x: 2, y: 2 } });
    await page.screenshot({ path: `${evidence}/${path}-grid.png` });
    await toolbar.getByRole("button", { name: "Lista", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page
        .locator("main")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBeTruthy();
    await page.screenshot({ path: `${evidence}/${path}-390.png` });
    expect(traffic.writes).toEqual([]);
    if (path === "dns")
      expect(traffic.reads).not.toContain("dns-records/stats/");
    if (path === "security-headers") {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page
        .getByTestId("connectivity-table")
        .getByRole("row")
        .nth(1)
        .click();
      await expect(
        page.getByRole("button", { name: /Remediación|Snippet/ }),
      ).toHaveCount(0);
      await expect(
        page.getByLabel("Plantilla de cabeceras editable"),
      ).toHaveCount(0);
    }
  });

test("Uptime cards keep identity clear with agents, tags and mixed results", async ({
  page,
}) => {
  const rows = resources("monitoring", 4);
  rows[0] = {
    ...rows[0],
    name: "Sitio principal",
    last_status: "down",
    last_latency: null,
    tags: ["onboarding", "produccion"],
  };
  rows[1] = {
    ...rows[1],
    name: "Servicio privado",
    last_status: "down",
    last_latency: null,
    tags: [],
    runner_type: "agent",
    agent_probe_name: "Oficina central",
    agent_probe_online: true,
    endpoint: "192.0.2.10:3001",
    target_type: "tcp",
  };
  rows[2] = {
    ...rows[2],
    name: "Portal de atención a clientes",
    tags: [],
    interval: 60,
  };
  rows[3] = {
    ...rows[3],
    name: "Servicios de clientes",
    tags: ["clientes", "prod"],
    interval: 60,
  };
  const traffic = await transport(page, "monitoring", 4, rows);
  await login(page);
  await page.goto("/monitoring");
  await page.getByRole("button", { name: "Cuadrícula", exact: true }).click();
  const cards = page.getByTestId("connectivity-card");
  await expect(cards).toHaveCount(4);
  for (const width of [1900, 1440, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page
        .locator("main")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBeTruthy();
    const firstRowCount = await cards.evaluateAll((elements) => {
      const top = elements[0].getBoundingClientRect().top;
      return elements.filter(
        (element) => Math.abs(element.getBoundingClientRect().top - top) < 1,
      ).length;
    });
    expect(firstRowCount).toBe(width === 1900 ? 3 : width === 1440 ? 2 : 1);
    for (const card of await cards.all()) {
      const select = await card.getByRole("checkbox").boundingBox();
      const heading = await card.locator("h3").boundingBox();
      expect(select!.y).toBeGreaterThan(heading!.y + heading!.height);
      await expect(
        card.getByRole("button", { name: "Editar target", exact: true }),
      ).toBeVisible();
      await expect(
        card.getByRole("button", { name: "Eliminar target", exact: true }),
      ).toBeVisible();
    }
    await page.screenshot({
      path: `${evidence}/monitoring-mixed-grid-${width}.png`,
    });
  }
  expect(traffic.writes).toEqual([]);
});

test("empty directory utility menu closes with Escape when all actions are disabled", async ({
  page,
}) => {
  const traffic = await transport(page, "ssl-certificates", 0);
  await login(page);
  await page.goto("/ssl");
  const trigger = page
    .locator(".connectivity-toolbar")
    .getByRole("button", { name: "Más opciones del directorio", exact: true });
  await trigger.press("Enter");
  const menu = page.getByRole("menu");
  await expect(menu).toBeFocused();
  await expect(
    menu.getByRole("menuitem", { name: "Exportar resultados filtrados" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(traffic.writes).toEqual([]);
});

for (const count of [4, 25, 26, 51])
  test(`pagination appears only when useful: ${count} monitors`, async ({
    page,
  }) => {
    await transport(page, "monitoring", count);
    await login(page);
    await page.goto("/monitoring");
    const table = page.getByTestId("connectivity-table"),
      pagination = page.getByRole("navigation", {
        name: "Páginas de recursos",
      });
    await expect(table.locator("tbody tr")).toHaveCount(Math.min(25, count));
    if (count <= 25) {
      await expect(pagination).toHaveCount(0);
      return;
    }
    await expect(pagination).toContainText(
      `Mostrando 1–25 de ${count} resultados`,
    );
    await pagination.screenshot({
      path: `${evidence}/pagination-${count}.png`,
    });
    await expect(
      pagination.getByRole("button", { name: "Anterior", exact: true }),
    ).toBeDisabled();
    await table.getByRole("checkbox").nth(1).check();
    await pagination
      .getByRole("button", { name: "Siguiente", exact: true })
      .click();
    await expect(table.locator("tbody tr")).toHaveCount(
      Math.min(25, count - 25),
    );
    await expect(table.getByRole("checkbox").nth(1)).not.toBeChecked();
    await expect(
      pagination.getByLabel(`Página 2 de ${Math.ceil(count / 25)}`),
    ).toBeVisible();
    if (count === 26)
      await expect(
        pagination.getByRole("button", { name: "Siguiente", exact: true }),
      ).toBeDisabled();
    else {
      await pagination
        .getByRole("button", { name: "Siguiente", exact: true })
        .click();
      await expect(table.locator("tbody tr")).toHaveCount(1);
      await expect(pagination).toContainText(
        "Mostrando 51–51 de 51 resultados",
      );
    }
    await pagination
      .getByRole("button", { name: "Anterior", exact: true })
      .click();
    await expect(table.locator("tbody tr")).toHaveCount(25);
  });
