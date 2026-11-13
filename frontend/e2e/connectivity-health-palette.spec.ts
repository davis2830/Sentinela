import { expect, request, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const apiURL = (
  process.env.E2E_API_URL || "http://127.0.0.1:8000/api/v1"
).replace(/\/$/, "");
const suffix = process.env.E2E_FIXTURE_SUFFIX || "local-beta-fixture";
const colors = {
  success: "rgb(74, 222, 128)",
  warning: "rgb(251, 191, 36)",
  danger: "rgb(255, 115, 132)",
  muted: "rgb(203, 213, 225)",
};
const evidence = "../docs/assets/connectivity-health-20261112";
let session: { access_token: string; refresh_token: string; user: object };
test.beforeAll(async () => {
  const api = await request.newContext();
  const login = await api.post(`${apiURL}/auth/login/`, {
    data: {
      email: `e2e-admin-${suffix}@example.test`,
      password: "E2e-Admin-Password-123!",
    },
  });
  expect(login.status()).toBe(200);
  session = (await login.json()).data;
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
      "ssl_certificates",
      "ssl",
      "domains",
      "dns_records",
      "api_checks",
      "security_headers",
    ])
      localStorage.setItem(`sentinel_view_mode_${key}`, "table");
  }, session);
}

const now = new Date().toISOString();
const issued = new Date(Date.now() - 30 * 86400000).toISOString();
const expires = new Date(Date.now() + 120 * 86400000).toISOString();
const base = {
  id: "good",
  organization: "fixture",
  name: "healthy",
  domain: "healthy.example.test",
  url: "https://healthy.example.test",
  enabled: true,
  created_at: issued,
  updated_at: now,
};
const certificate = {
  ...base,
  is_valid: true,
  days_remaining: 120,
  last_scanned_at: now,
  issued_at: issued,
  expiration_date: expires,
  error_message: null,
  last_error_code: "",
  security_grade: "A+",
  tls_version: "TLSv1.3",
  issuer: "Fixture CA",
  port: 443,
  san_domains: [],
};
const domain = {
  ...base,
  status: "active",
  last_scanned_at: now,
  days_until_expiration: 120,
  creation_date: issued,
  expiration_date: expires,
  registrar: "Fixture registrar",
  is_locked: true,
  name_servers: ["ns1.example.test"],
  error_message: null,
};
const apiCheck = {
  ...base,
  last_checked_at: now,
  last_status: "pass",
  last_response_time_ms: 100,
  last_http_status: 200,
  method: "GET",
  expected_status: 200,
  expected_response_time_ms: 500,
  expected_schema: {},
  check_interval: 300,
};
const dns = {
  ...base,
  record_type: "A",
  value: "192.0.2.1",
  ttl: 300,
  response_time_ms: 0,
  last_scanned_at: now,
  last_successful_at: now,
  last_error_code: "",
  last_change_at: null,
};
const security = {
  ...base,
  last_checked_at: now,
  last_score: 90,
  last_grade: "A",
  last_response_time_ms: 100,
  has_hsts: true,
  has_csp: true,
  has_xfo: true,
  info_leak_detected: false,
  server_header: "",
  powered_by_header: "",
};
type Check = { name: string; label: string; tone: keyof typeof colors };
const modules: {
  path: string;
  route: string;
  rows: Record<string, unknown>[];
  checks: Check[];
}[] = [
  {
    path: "ssl",
    route: "ssl-certificates",
    rows: [
      certificate,
      {
        ...certificate,
        id: "warning",
        domain: "warning.example.test",
        days_remaining: 20,
      },
      {
        ...certificate,
        id: "critical",
        domain: "critical.example.test",
        days_remaining: 5,
      },
      {
        ...certificate,
        id: "none",
        domain: "unknown.example.test",
        last_scanned_at: null,
        days_remaining: null,
        security_grade: undefined,
        is_valid: false,
      },
      {
        ...certificate,
        id: "invalid",
        domain: "invalid.example.test",
        last_error_code: "INVALID_CERTIFICATE",
        is_valid: false,
      },
      {
        ...certificate,
        id: "failed",
        domain: "failed.example.test",
        last_error_code: "TIMEOUT",
        error_message: "Controlled timeout",
      },
    ],
    checks: [
      { name: base.domain, label: "Válido", tone: "success" },
      { name: "warning.example.test", label: "Por expirar", tone: "warning" },
      {
        name: "critical.example.test",
        label: "Vence en 7 días o menos",
        tone: "danger",
      },
      { name: "unknown.example.test", label: "Sin medición", tone: "muted" },
      {
        name: "invalid.example.test",
        label: "Certificado inválido",
        tone: "danger",
      },
      {
        name: "failed.example.test",
        label: "Error de medición",
        tone: "warning",
      },
    ],
  },
  {
    path: "domains",
    route: "domains",
    rows: [
      domain,
      {
        ...domain,
        id: "warning",
        domain: "warning.example.test",
        days_until_expiration: 20,
        is_locked: false,
      },
      {
        ...domain,
        id: "critical",
        domain: "critical.example.test",
        days_until_expiration: 5,
      },
      {
        ...domain,
        id: "none",
        domain: "unknown.example.test",
        last_scanned_at: null,
        days_until_expiration: null,
        is_locked: null,
      },
    ],
    checks: [
      { name: base.domain, label: "Protegido", tone: "success" },
      { name: "warning.example.test", label: "20 días", tone: "warning" },
      { name: "critical.example.test", label: "5 días", tone: "danger" },
      {
        name: "unknown.example.test",
        label: "Sin información EPP",
        tone: "muted",
      },
    ],
  },
  {
    path: "api-checks",
    route: "api-checks",
    rows: [
      apiCheck,
      {
        ...apiCheck,
        id: "slow",
        name: "slow",
        last_status: "slow",
        last_response_time_ms: 800,
      },
      {
        ...apiCheck,
        id: "fail",
        name: "failed",
        last_status: "fail",
        last_http_status: 500,
      },
      {
        ...apiCheck,
        id: "none",
        name: "unknown",
        last_checked_at: null,
        last_status: null,
        last_response_time_ms: null,
      },
    ],
    checks: [
      { name: "healthy", label: "Pass", tone: "success" },
      { name: "slow", label: "Lento", tone: "warning" },
      { name: "failed", label: "Fallo", tone: "danger" },
      { name: "unknown", label: "Sin medición", tone: "muted" },
    ],
  },
  {
    path: "dns",
    route: "dns-records",
    rows: [
      dns,
      {
        ...dns,
        id: "slow",
        domain: "warning.example.test",
        response_time_ms: 800,
      },
      {
        ...dns,
        id: "critical",
        domain: "critical.example.test",
        response_time_ms: 1500,
      },
      {
        ...dns,
        id: "none",
        domain: "unknown.example.test",
        response_time_ms: null,
        last_scanned_at: null,
        last_successful_at: null,
        value: "",
      },
    ],
    checks: [
      { name: base.domain, label: "0ms", tone: "success" },
      { name: "warning.example.test", label: "800ms", tone: "warning" },
      { name: "critical.example.test", label: "1500ms", tone: "danger" },
      { name: "unknown.example.test", label: "Sin medición", tone: "muted" },
    ],
  },
  {
    path: "security-headers",
    route: "security-headers",
    rows: [
      security,
      {
        ...security,
        id: "warning",
        name: "warning",
        last_score: 60,
        last_grade: "C",
      },
      {
        ...security,
        id: "critical",
        name: "critical",
        last_score: 40,
        last_grade: "F",
      },
      {
        ...security,
        id: "none",
        name: "unknown",
        last_checked_at: null,
        last_score: null,
        last_grade: "",
      },
      { ...security, id: "leak", name: "leak", info_leak_detected: true },
    ],
    checks: [
      { name: "healthy", label: "Grado A", tone: "success" },
      { name: "warning", label: "Grado C", tone: "warning" },
      { name: "critical", label: "Grado F", tone: "danger" },
      { name: "unknown", label: "Grado -", tone: "muted" },
      { name: "leak", label: "Grado A", tone: "warning" },
    ],
  },
];

for (const config of modules) {
  test(`${config.path} uses measured health colors independently of brand`, async ({
    page,
  }) => {
    await login(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    const rows = config.rows.map((row) => {
      const days =
        config.path === "ssl"
          ? row.days_remaining
          : config.path === "domains"
            ? row.days_until_expiration
            : undefined;
      return typeof days === "number"
        ? {
            ...row,
            expiration_date: new Date(
              Date.now() + days * 86400000,
            ).toISOString(),
          }
        : days === null
          ? {
              ...row,
              expiration_date: null,
              issued_at: null,
              creation_date: null,
            }
          : row;
    });
    const stats: Record<string, object> = {
      ssl: { total: 6, valid: 3, expiring_30d: 2, expired: 0, invalid: 1 },
      domains: { total: 4, active: 3, expiring_30d: 2, locked_count: 2 },
      "api-checks": {
        total: 4,
        pass_count: 1,
        slow_count: 1,
        fail_count: 1,
        paused_count: 0,
      },
      dns: { total: 4, changes_24h: 0 },
      "security-headers": {
        total: 5,
        healthy: 1,
        warning: 2,
        critical: 1,
        unmeasured: 1,
        info_leaks_count: 1,
      },
    };
    await page.route(`**/api/v1/${config.route}/stats/**`, (r) =>
      r.fulfill({ json: { success: true, data: stats[config.path] } }),
    );
    await page.route(`**/api/v1/${config.route}/?*`, (r) =>
      r.fulfill({
        json: {
          success: true,
          data: rows,
          meta: {
            page: 1,
            page_size: 25,
            total: config.rows.length,
            total_pages: 1,
            has_next: false,
          },
        },
      }),
    );
    await page.goto(`/${config.path}`);
    await page.getByRole("button", { name: "Lista", exact: true }).click();
    for (const check of config.checks) {
      const row = page.getByRole("row", { name: check.name, exact: true });
      await expect(
        row.getByText(check.label, { exact: true }).first(),
      ).toHaveCSS("color", colors[check.tone]);
    }
    const headerColor = await page.evaluate(
      () =>
        `rgba(${getComputedStyle(document.documentElement).getPropertyValue("--sentinel-bg-dark").trim().split(/\s+/).join(", ")}, 0.8)`,
    );
    await expect(
      page.getByTestId("connectivity-table").locator("thead tr"),
    ).toHaveCSS("background-color", headerColor);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({ path: `${evidence}/${config.path}-table.png` });
    if (config.path === "ssl") {
      const good = page.getByRole("row", { name: base.domain, exact: true });
      await expect(
        good.locator('[title^="Vida del certificado"]').locator("div"),
      ).toHaveCSS("background-color", colors.success);
      await page
        .getByRole("button", { name: "Cuadrícula", exact: true })
        .click();
      const unknown = page
        .locator(".group")
        .filter({
          has: page.getByRole("heading", {
            name: "unknown.example.test",
            exact: true,
          }),
        })
        .first();
      await expect(unknown.getByText("A", { exact: true })).toHaveCount(0);
      const warning = page
        .locator(".group")
        .filter({
          has: page.getByRole("heading", {
            name: "critical.example.test",
            exact: true,
          }),
        })
        .first();
      await expect(warning.getByText("5 días", { exact: true })).toHaveCSS(
        "color",
        colors.danger,
      );
      await page.screenshot({ path: `${evidence}/ssl-grid.png` });
      await page.setViewportSize({ width: 390, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({ path: `${evidence}/ssl-mobile.png` });
      await page.route("**/api/v1/ssl-certificates/test-connection/", (r) =>
        r.fulfill({
          json: {
            success: true,
            data: {
              is_valid: true,
              days_remaining: 5,
              issuer: "Fixture CA",
              port: 443,
              tls_version: "TLSv1.3",
              san_domains: [],
            },
          },
        }),
      );
      await page
        .getByRole("button", { name: "Nuevo Certificado", exact: true })
        .click();
      await page
        .getByPlaceholder("ej. api.tuempresa.com", { exact: true })
        .fill("preview.example.test");
      await page
        .getByRole("button", { name: "Probar configuración", exact: true })
        .click();
      await expect(
        page.getByRole("dialog").getByText("5 días", { exact: true }),
      ).toHaveCSS("color", colors.danger);
      await page.screenshot({ path: `${evidence}/ssl-preview-mobile.png` });
    }
  });
}
