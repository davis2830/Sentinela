import { expect, test, type Page } from "@playwright/test";

function probe() {
  return {
    is_online: true,
    telemetry: {
      state: "current",
      received_at: "2026-10-22T12:00:00Z",
      snapshot: {
        schema_version: 1,
        queue: { queued: 1, running: 2, ready: 3 },
        queue_limit: 1000,
        draining: false,
        rejected_retained: 0,
        last_ack_at: "2026-10-22T11:59:00Z",
        last_rejection_at: null,
        errors: [] as { component: string; code: string; failures: number }[],
      },
    },
  };
}
async function render(
  page: Page,
  data: unknown,
  queryFailed = false,
  variant: "compact" | "card" = "compact",
) {
  await page.evaluate(
    ({ data, queryFailed, variant }) =>
      (window as any).renderProbe(data, queryFailed, variant),
    { data, queryFailed, variant },
  );
}
test.beforeEach(async ({ page }) => {
  await page.goto("/e2e/fixtures/probe-telemetry.html");
  await page.waitForFunction(
    () => typeof (window as any).renderProbe === "function",
  );
});

test("elevated queue shows current occupancy and removes progress when the reading becomes stale", async ({
  page,
}) => {
  const data = probe();
  data.telemetry.snapshot.queue = { queued: 0, running: 0, ready: 0 };
  await render(page, data, false, "card");
  const card = page.getByRole("region", { name: "Cola local reportada" });
  await expect(card.getByText("Sin errores reportados")).toBeVisible();
  await expect(card.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  await expect(card.getByRole("progressbar")).toHaveAttribute(
    "aria-valuemax",
    "1000",
  );
  data.telemetry.snapshot.queue = { queued: 1, running: 2, ready: 3 };
  await render(page, data, false, "card");
  await expect(card.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "6",
  );
  await expect(card.getByText("Cola 6/1000", { exact: true })).toBeVisible();
  await render(page, data, true, "card");
  await expect(
    card.getByText("Telemetría interna desactualizada"),
  ).toBeVisible();
  await expect(card.getByText("—", { exact: true })).toHaveCount(3);
  await expect(card.getByRole("progressbar")).toHaveCount(0);
  await expect(card.getByText("Sin errores reportados")).toHaveCount(0);
});

test("elevated queue preserves storage errors and unknown capacity without a fabricated percentage", async ({
  page,
}) => {
  const data = probe();
  data.telemetry.snapshot.queue_limit = 0;
  data.telemetry.snapshot.errors = [
    { component: "storage", code: "local_storage", failures: 4 },
  ];
  await render(page, data, false, "card");
  await expect(page.getByText("Revisar agente", { exact: true })).toBeVisible();
  await expect(page.getByText(/Revisar disco y permisos/)).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(
    page.getByText("Sin datos actuales", { exact: true }),
  ).toBeVisible();
  await render(page, { is_online: true }, false, "card");
  await expect(
    page.getByText("Sin telemetría interna", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("—", { exact: true })).toHaveCount(3);
});

test("local queue, drain and concise errors are distinct", async ({ page }) => {
  const data = probe();
  await render(page, data);
  await expect(page.getByText("Procesando comprobaciones")).toHaveClass(
    /text-accent-yellow/,
  );
  await expect(page.getByText("Cola 6/1000", { exact: false })).toBeVisible();
  data.telemetry.snapshot.draining = true;
  await render(page, data);
  await expect(page.getByText("Modo drenaje")).toBeVisible();
  await expect(
    page.getByText("Termina lo pendiente sin solicitar tareas nuevas."),
  ).toBeVisible();
  data.telemetry.snapshot.errors = [
    { component: "delivery", code: "delivery_unconfirmed", failures: 2 },
  ];
  await render(page, data);
  await expect(page.getByText("Revisar agente")).toHaveClass(/text-accent-red/);
  await expect(page.getByText(/Envío sin confirmación/)).toBeVisible();
});

test("stale, failed-query and legacy telemetry never show healthy current counts", async ({
  page,
}) => {
  const data = probe();
  data.telemetry.snapshot.queue = { queued: 0, running: 0, ready: 0 };
  await render(page, data);
  await expect(page.getByText("Sin errores reportados")).toHaveClass(
    /text-accent-green/,
  );
  await render(page, data, true);
  await expect(page.getByText("Telemetría interna desactualizada")).toHaveClass(
    /text-text-muted/,
  );
  await expect(page.getByText("—", { exact: true })).toHaveCount(3);
  await render(page, { is_online: true });
  await expect(page.getByText("Sin telemetría interna")).toBeVisible();
  await expect(page.getByText("Sin errores reportados")).toHaveCount(0);
});

test("unknown storage queue and historical rejections fit mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const data = probe();
  (data.telemetry.snapshot as any).queue = null;
  data.telemetry.snapshot.errors = [
    { component: "storage", code: "local_storage", failures: 4 },
  ];
  data.telemetry.snapshot.rejected_retained = 5;
  await render(page, data);
  await expect(page.getByText("—", { exact: true })).toHaveCount(3);
  await expect(page.getByText(/Revisar disco y permisos/)).toBeVisible();
  await page
    .getByText("5 rechazo(s) conservados en el historial local")
    .click();
  await expect(page.getByText(/no indica un error activo/)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
