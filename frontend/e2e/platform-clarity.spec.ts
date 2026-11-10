import { expect, test, type Page } from "@playwright/test";
import { fixture, organization, betaOverview } from "./platform-fixtures";

const base = "/api/v1/platform-admin/";
const now = new Date().toISOString();
const future = new Date(Date.now() + 3 * 86400000).toISOString();
const past = new Date(Date.now() - 2 * 86400000).toISOString();
const sent = { status: "sent", attempts: 1, last_attempt_at: now };
const auditEvents = [
  {
    id: "audit1",
    action: "update",
    module: "platform_users",
    result: "success",
    user_email: "operador@example.test",
    organization_id: "client",
    timestamp: now,
    description:
      "Se extendió la prueba de Atlas Logistics por 14 días. Motivo: acompañamiento de incorporación.",
  },
  {
    id: "audit2",
    action: "update",
    module: "platform_users",
    result: "failure",
    user_email: "operador@example.test",
    organization_id: "north",
    timestamp: past,
    description:
      "La solicitud administrativa no pudo completarse. Los datos anteriores se conservaron.",
  },
];
const common = {
  expires_at: future,
  created_at: now,
  reason: "Participante de demostración",
  user_id: null,
  account_active: null,
  email_verified: false,
  access_status: null,
  beta_status: null,
  has_resources: false,
  has_measurements: false,
  delivery: sent,
  invitation_delivery: sent,
  verification_delivery: null,
  organization_name: "",
  user__organization_id: null,
};
const betaRows = [
  {
    ...common,
    id: "p1",
    email: "camila@atlas.example.test",
    status: "pending_verification",
    user_id: "u1",
    account_active: true,
    verification_delivery: {
      status: "failed",
      attempts: 2,
      last_attempt_at: now,
    },
    delivery: { status: "failed", attempts: 2, last_attempt_at: now },
  },
  {
    ...common,
    id: "p2",
    email: "esteban@meridian.example.test",
    status: "active",
    user_id: "u2",
    account_active: true,
    email_verified: true,
    access_status: "active",
    beta_status: "active",
    has_resources: true,
    organization_name: "Meridian Labs",
    user__organization_id: "other",
  },
  {
    ...common,
    id: "p3",
    email: "laura@atlas.example.test",
    status: "active",
    user_id: "u3",
    account_active: true,
    email_verified: true,
    access_status: "active",
    beta_status: "active",
    organization_name: "Atlas Logistics",
    user__organization_id: "client",
  },
  {
    ...common,
    id: "p4",
    email: "diego@northstar.example.test",
    status: "suspended",
    user_id: "u4",
    account_active: true,
    email_verified: true,
    access_status: "suspended",
    beta_status: "suspended",
    has_resources: true,
    has_measurements: true,
    organization_name: "Northstar Networks",
    user__organization_id: "north",
  },
  {
    ...common,
    id: "p5",
    email: "sofia@vertex.example.test",
    status: "invited",
  },
  {
    ...common,
    id: "p6",
    email: "marcos@orbit.example.test",
    status: "invited",
    expires_at: past,
  },
  {
    ...common,
    id: "p7",
    email: "elena@harbor.example.test",
    status: "active",
    user_id: "u7",
    account_active: true,
    email_verified: true,
    access_status: "active",
    beta_status: "active",
    has_resources: true,
    has_measurements: true,
    organization_name: "Harbor Systems",
    user__organization_id: "harbor",
  },
];
const org = {
  ...organization,
  name: "Atlas Logistics",
  slug: "atlas-logistics",
  billing_email: "laura@atlas.example.test",
  beta_managed: true,
  beta_status: "active",
};
const people = [
  {
    id: "user",
    email: "carla@atlas.example.test",
    name: "Carla Mendoza",
    organization_id: "client",
    organization_name: org.name,
    role: "admin",
    authorization_mode: "legacy",
    is_active: true,
    email_verified: true,
    mfa_enabled: true,
    last_login: now,
  },
  {
    id: "user2",
    email: "bruno@meridian.example.test",
    name: "Bruno Reyes",
    organization_id: "other",
    organization_name: "Meridian Labs",
    role: "viewer",
    authorization_mode: "custom",
    is_active: true,
    email_verified: true,
    mfa_enabled: false,
    last_login: past,
  },
  {
    id: "user3",
    email: "mario@northstar.example.test",
    name: "Mario Castillo",
    organization_id: "north",
    organization_name: "Northstar Networks",
    role: "viewer",
    authorization_mode: "legacy",
    is_active: false,
    email_verified: true,
    mfa_enabled: false,
    last_login: past,
  },
];
async function setup(page: Page) {
  await fixture(page, false, {
    [base + "beta/overview/"]: {
      ...betaOverview,
      reserved: 6,
      available: 44,
      invited: 1,
      verification: 1,
      registered: 4,
      attention: {
        failed_delivery: 1,
        expired: 1,
        verification: 1,
        blocked: 1,
        unconfigured: 1,
        unmeasured: 1,
      },
    },
    [base + "beta/"]: {
      capacity: 50,
      reserved: 6,
      available: 44,
      admissions_open: true,
      total: 7,
      page: 1,
      page_size: 25,
      has_next: false,
      invitations: betaRows,
      feedback_submission_url: "",
      feedback_management_url: "",
    },
    [base + "organizations/"]: [
      org,
      {
        ...org,
        id: "other",
        name: "Meridian Labs",
        slug: "meridian-labs",
        billing_email: "esteban@meridian.example.test",
        plan_tier: "business",
        subscription_status: "trialing",
        is_in_trial: true,
        trial_days_remaining: 5,
        trial_ends_at: future,
        targets_count: 8,
        max_targets: 50,
      },
      {
        ...org,
        id: "north",
        name: "Northstar Networks",
        slug: "northstar",
        billing_email: "diego@northstar.example.test",
        access_status: "suspended",
        beta_status: "suspended",
        targets_count: 3,
        max_targets: 10,
      },
      {
        ...org,
        id: "harbor",
        name: "Harbor Systems",
        slug: "harbor-systems",
        billing_email: "elena@harbor.example.test",
        plan_tier: "free",
        targets_count: 2,
        max_targets: 3,
      },
    ],
    [base + "organizations/client/"]: {
      ...org,
      users_count: 3,
      max_users: 5,
      sla_target_percentage: 99.9,
      contact_phone: "+502 5550 0101",
      website: "https://atlas.example.test",
      tax_id: "ATLAS-001",
      limits: { min_check_interval_seconds: 60 },
      counts: { users: 3, targets: 4, probes: 0, audit: 0 },
      users: [],
      targets: [],
      probes: [],
      recent_audits: [],
      has_next: false,
      resource_usage: [
        {
          module: "monitoring",
          label: "Uptime",
          total: 4,
          measured: 3,
          limit: 10,
          limit_key: "max_monitoring_targets",
        },
        {
          module: "agents",
          label: "Agentes",
          total: 0,
          measured: 0,
          limit: 1,
          limit_key: "max_private_agents",
        },
      ],
    },
    [base + "audit-logs/"]: { events: auditEvents, has_next: false },
    [base + "audit-logs/audit1/"]: auditEvents[0],
    [base + "users/"]: { users: people, total: 3, page_size: 25 },
    [base + "users/user/"]: {
      ...people[0],
      roles: [],
      effective_permissions: ["monitoring.read", "monitoring.scan"],
      created_at: past,
    },
  });
}
async function nav(page: Page, name: string) {
  if ((page.viewportSize()?.width || 1440) < 768)
    await page
      .getByRole("button", { name: "Abrir menú administrativo", exact: true })
      .click();
  await page.getByRole("link", { name, exact: true }).click();
}
test.use({ viewport: { width: 1440, height: 900 } });
test("clarity: six sections, focused forms and contextual fichas at three viewports", async ({
  page,
}) => {
  test.setTimeout(120000);
  const failures: string[] = [];
  page.on("pageerror", (e) => failures.push(e.message));
  let auditRequests = 0;
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === base + "audit-logs/") auditRequests++;
  });
  await setup(page);
  for (const [name, slug] of [
    ["Resumen SaaS", "summary"],
    ["Beta", "beta"],
    ["Organizaciones", "organizations"],
    ["Usuarios", "users"],
    ["Salud de plataforma", "health"],
    ["Auditoría", "audit"],
  ]) {
    await nav(page, name);
    if (slug === "health")
      await expect(
        page.getByRole("heading", {
          name: "Servicios de plataforma",
          exact: true,
        }),
      ).toBeVisible();
    if (slug === "beta")
      await expect(
        page
          .getByRole("listitem")
          .filter({ hasText: "camila@atlas.example.test" }),
      ).toBeVisible();
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1366, height: 768 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.getByRole("main").evaluate((el) => {
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
        path: test.info().outputPath(slug + "-" + viewport.width + ".png"),
        fullPage: true,
      });
    }
  }
  expect(auditRequests).toBe(0);
  await page.getByLabel("Correo del usuario").fill("operador@example.test");
  expect(auditRequests).toBe(0);
  await page
    .getByRole("button", { name: "Consultar auditoría", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Ver evento", exact: true }),
  ).toHaveCount(2);
  expect(auditRequests).toBe(1);
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.getByRole("main").evaluate((el) => {
      el.scrollTop = 0;
    });
    expect(
      await page
        .getByRole("main")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page.screenshot({
      path: test.info().outputPath("audit-results-" + viewport.width + ".png"),
      fullPage: true,
    });
  }
  await page
    .getByRole("button", { name: "Ver evento", exact: true })
    .first()
    .click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(
    page.getByRole("dialog", { name: "Detalle del evento", exact: true }),
  ).toContainText("acompañamiento");
  await page.screenshot({
    path: test.info().outputPath("audit-event-1440.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await nav(page, "Beta");
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(
    page.getByLabel("Correo de invitación", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Invitar participante", exact: true })
    .click();
  await expect(
    page.getByLabel("Correo de invitación", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("invite-1440.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Configuración de beta", exact: true })
    .click();
  await page.screenshot({
    path: test.info().outputPath("configuration-1440.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await nav(page, "Organizaciones");
  await page
    .getByRole("button", { name: "Ver ficha de Atlas Logistics", exact: true })
    .click();
  const drawer = page.getByRole("dialog", {
    name: "Ficha de organización",
    exact: true,
  });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await expect(drawer).toBeVisible();
    expect(
      await drawer.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page.screenshot({
      path: test.info().outputPath("organization-dossier-" + width + ".png"),
      fullPage: true,
    });
  }
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1440, height: 900 });
  await nav(page, "Usuarios");
  await page
    .getByRole("button", {
      name: "Ver ficha de carla@atlas.example.test",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Ficha de usuario", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("user-dossier-1440.png"),
    fullPage: true,
  });
  expect(failures).toEqual([]);
});
