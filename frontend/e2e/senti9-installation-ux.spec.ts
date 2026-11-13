import { expect, request, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const apiURL = (
  process.env.E2E_API_URL || "http://127.0.0.1:8000/api/v1"
).replace(/\/$/, "");
const suffix = process.env.E2E_FIXTURE_SUFFIX || "local-beta-fixture";
const evidence = "../docs/assets/senti9-ux-20261111";
type Session = { access_token: string; refresh_token: string; user: object };
const sessions = new Map<boolean, Session>();

async function login(page: Page, viewer = false) {
  let session = sessions.get(viewer);
  if (!session) {
    const api = await request.newContext();
    const response = await api.post(`${apiURL}/auth/login/`, {
      data: {
        email: `e2e-${viewer ? "viewer" : "admin"}-${suffix}@example.test`,
        password: viewer
          ? "E2e-Viewer-Password-123!"
          : "E2e-Admin-Password-123!",
      },
    });
    expect(response.status(), "Isolated fixture login").toBe(200);
    const authenticated: Session = (await response.json()).data;
    const me = await api.get(`${apiURL}/auth/me/`, {
      headers: { Authorization: `Bearer ${authenticated.access_token}` },
    });
    authenticated.user = (await me.json()).data;
    sessions.set(viewer, authenticated);
    session = authenticated;
    await api.dispose();
  }
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

test("installation guide is read-only, keyboard accessible and returns focus", async ({
  page,
}) => {
  await login(page);
  let profileRequests = 0;
  let writes = 0;
  page.on("request", (r) => {
    if (
      r.url().includes("/agent-probes/") &&
      r.url().includes("/installation/")
    )
      profileRequests++;
    if (r.url().includes("/agent-probes/") && r.method() !== "GET") writes++;
  });
  await page.goto("/senti9");
  const trigger = page.getByRole("button", {
    name: "Guía de instalación",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Guía de instalación de Senti9",
  });
  await expect(dialog.getByRole("radio", { name: /Windows/ })).toBeChecked();
  await dialog.getByRole("radio", { name: /Windows/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    dialog.getByRole("radio", { name: /Linux Docker/ }),
  ).toBeChecked();
  await expect(
    dialog.getByRole("link", { name: "Instalar Docker" }),
  ).toHaveAttribute("href", "https://docs.docker.com/engine/install/");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(profileRequests).toBe(0);
  expect(writes).toBe(0);
});

test("existing agent instructions safely quote local paths without rotating or persisting credentials", async ({
  page,
}) => {
  await login(page);
  let writes = 0;
  const urls: string[] = [];
  page.on("request", (r) => {
    urls.push(r.url());
    if (r.url().includes("/agent-probes/") && r.method() !== "GET") writes++;
  });
  await page.goto("/senti9");
  const trigger = page.getByRole("button", { name: /^Instalar / }).first();
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: /Windows/ }).check();
  const input = dialog.getByRole("textbox", {
    name: "Ruta del archivo de token",
  });
  const start = dialog.getByRole("button", {
    name: "Copiar: 4. Inicia el agente",
    exact: true,
  });
  await expect(start).toBeDisabled();
  await expect(
    dialog.getByRole("region", { name: "2. Descarga la imagen" }),
  ).toContainText("no necesitas una cuenta de Docker");
  await input.fill("archivo-relativo.txt");
  await expect(start).toBeDisabled();
  await input.fill("C:\\Equipo,privado\\token.txt");
  await expect(start).toBeDisabled();
  const windowsPath = "C:\\Agente O'Neil\\$(privado)\\token.txt";
  await input.fill(windowsPath);
  await expect(start).toBeEnabled();
  await expect(
    dialog.getByRole("region", { name: "Preparar archivo guardado" }),
  ).toContainText(
    "Resolve-Path -LiteralPath 'C:\\Agente O''Neil\\$(privado)\\token.txt'",
  );
  await expect(
    dialog.getByRole("region", { name: "4. Inicia el agente" }),
  ).toContainText("readonly");
  await dialog.getByRole("radio", { name: /Linux Docker/ }).check();
  await expect(input).toHaveValue("");
  await expect(start).toBeDisabled();
  const linuxPath = "/home/Operador O'Neil/$(privado)/token.txt";
  await input.fill(linuxPath);
  await expect(start).toBeEnabled();
  await expect(
    dialog.getByRole("region", { name: "Preparar archivo guardado" }),
  ).toContainText(
    "TOKEN_PATH='/home/Operador O'\"'\"'Neil/$(privado)/token.txt'",
  );
  await expect(
    dialog.getByRole("button", {
      name: "Descargar archivo de token",
      exact: true,
    }),
  ).toHaveCount(0);
  const storage = await page.evaluate(() =>
    JSON.stringify({ ...localStorage, ...sessionStorage }),
  );
  expect(storage).not.toContain(windowsPath);
  expect(storage).not.toContain(linuxPath);
  expect(urls.some((url) => url.includes("privado"))).toBe(false);
  await page.keyboard.press("Escape");
  await trigger.click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("textbox", { name: "Ruta del archivo de token" }),
  ).toHaveValue("");
  expect(writes).toBe(0);
});

for (const size of [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
]) {
  test(`Senti9 directory and installation remain readable at ${size.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await login(page);
    await mkdir(evidence, { recursive: true });
    await page.goto("/senti9");
    const agent = page.getByRole("article").first();
    await expect(agent).toBeVisible();
    const name = agent.getByRole("heading");
    const nameBox = await name.boundingBox();
    expect(nameBox!.width).toBeGreaterThan(100);
    expect(nameBox!.height).toBeLessThan(65);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({ path: `${evidence}/after-${size.width}.png` });
    await page
      .getByRole("button", { name: "Guía de instalación", exact: true })
      .click();
    let dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Cerrar guía de instalación" }),
    ).toBeInViewport();
    await page.screenshot({ path: `${evidence}/guide-${size.width}.png` });
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: /^Instalar / })
      .first()
      .click();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("radio", { name: /Windows/ }).check();
    await dialog
      .getByRole("textbox", { name: "Ruta del archivo de token" })
      .fill("C:\\Agente Sentinel\\senti9-token.txt");
    await expect(
      dialog.getByRole("button", {
        name: "Copiar: 4. Inicia el agente",
        exact: true,
      }),
    ).toBeEnabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `${evidence}/install-windows-${size.width}.png`,
    });
    await dialog.getByRole("radio", { name: /Linux Docker/ }).check();
    await dialog
      .getByRole("textbox", { name: "Ruta del archivo de token" })
      .fill("/home/operador/.config/senti9/token.txt");
    await dialog
      .getByRole("region", { name: "4. Inicia el agente" })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${evidence}/install-linux-${size.width}.png`,
    });
  });
}

test("read-only users can consult agents and guide without installation or administration controls", async ({
  page,
}) => {
  await login(page, true);
  await page.goto("/senti9");
  await expect(page.getByRole("article").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Registrar Senti9", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Instalar / })).toHaveCount(0);
  await page
    .getByRole("button", { name: /^Ver detalle de / })
    .first()
    .click();
  const drawer = page.getByRole("dialog");
  await expect(
    drawer.getByRole("button", { name: "Instalación", exact: true }),
  ).toHaveCount(0);
  await expect(
    drawer.getByRole("button", { name: "Administrar", exact: true }),
  ).toHaveCount(0);
  await expect(
    drawer.getByRole("link", { name: /Crear monitor privado/ }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Guía de instalación", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("administrador");
});

test("compact Senti9 refresh preserves server filters, pause and read-only manual refresh", async ({
  page,
}) => {
  await page.clock.install();
  await login(page);
  const reads: string[] = [];
  const writes: string[] = [];
  page.on("request", (r) => {
    if (!/\/agent-probes\/\?/.test(r.url())) return;
    if (r.method() === "GET") reads.push(r.url());
    else writes.push(r.url());
  });
  await page.goto("/senti9");
  const first = page.getByRole("article").first();
  await expect(first).toBeVisible();
  const name = await first.getByRole("heading").innerText();
  const pause = page.getByRole("button", {
    name: "Pausar auto-refresco",
    exact: true,
  });
  await expect(pause).toBeEnabled();
  await pause.click();
  await page
    .getByRole("combobox", { name: "Estado", exact: true })
    .selectOption("all");
  await page
    .getByRole("textbox", { name: "Buscar agente", exact: true })
    .fill(name);
  await page.clock.runFor(350);
  await expect
    .poll(() =>
      reads.some((url) => {
        const params = new URL(url).searchParams;
        return (
          params.get("search") === name && params.get("lifecycle") === "all"
        );
      }),
    )
    .toBe(true);
  const refresh = page.getByRole("button", {
    name: "Actualizar datos",
    exact: true,
  });
  await expect(refresh).toBeEnabled();
  const manual = page.waitForResponse(
    (r) =>
      r.request().method() === "GET" &&
      /\/agent-probes\/\?/.test(r.url()) &&
      new URL(r.url()).searchParams.get("search") === name,
  );
  await refresh.click();
  const response = await manual;
  expect(new URL(response.url()).searchParams.get("lifecycle")).toBe("all");
  expect(new URL(response.url()).searchParams.get("page")).toBe("1");
  await expect(page.getByTestId("senti9-refresh-status")).toContainText(
    "Pausado",
  );
  const pausedReads = reads.length;
  await page.clock.runFor(16_000);
  expect(reads.length).toBe(pausedReads);
  await page
    .getByRole("button", { name: "Activar auto-refresco", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pausar auto-refresco", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.clock.runFor(16_000);
  await expect.poll(() => reads.length).toBeGreaterThan(pausedReads);
  expect(writes).toEqual([]);
});

test("Senti9 equipment identifier copies exactly and never reports success on clipboard failure", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          (window as Window & { senti9Copied?: string }).senti9Copied = value;
        },
      },
    }),
  );
  await login(page);
  await page.goto("/senti9");
  const card = page.getByRole("article").first();
  const copy = card.getByRole("button", { name: /^Copiar / });
  const expected = (await copy.getAttribute("aria-label"))!
    .split(": ")
    .slice(1)
    .join(": ");
  await copy.click();
  await expect(card.getByRole("status")).toHaveText("Identificador copiado");
  expect(
    await page.evaluate(
      () => (window as Window & { senti9Copied?: string }).senti9Copied,
    ),
  ).toBe(expected);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Clipboard denied");
        },
      },
    }),
  );
  await copy.click();
  await expect(card.getByRole("status")).toHaveText(
    "No se pudo copiar el identificador.",
  );
  await expect(
    card.getByText("Identificador copiado", { exact: true }),
  ).toHaveCount(0);
});
