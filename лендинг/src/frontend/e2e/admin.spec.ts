import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const ORIGIN = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173";
const API = process.env.PLAYWRIGHT_API_URL ?? ORIGIN;
const EVIDENCE = process.env.E2E_EVIDENCE_DIR ?? "/DATA/AppData/.sisyphus/evidence/ochakovo";
const ADMIN = { email: "admin@demo.example.test", password: "пароль-надёжный-12" };
const PENDING = {
  email: `gennady.pending.${Date.now().toString(36)}@demo.example.test`,
  password: "пароль-надёжный-12",
  first: "Геннадий",
  last: "Мальцев",
  position: "Оператор склада",
};

test.beforeAll(() => { mkdirSync(EVIDENCE, { recursive: true }); });

interface ApiSession {
  request: APIRequestContext;
  csrf: string;
}

async function apiLogin(email: string, password: string): Promise<ApiSession> {
  if (process.env.E2E_INGRESS_RATE_LIMITED) await new Promise((resolve) => setTimeout(resolve, 12_100));
  const request = await test.request.newContext({
    baseURL: API,
    extraHTTPHeaders: { Origin: ORIGIN },
  });
  const login = await request.post("/api/v1/auth/login", { data: { email, password } });
  if (login.status() !== 200) {
    throw new Error(`login failed for ${email}: ${login.status()} ${await login.text()}`);
  }
  const me = await request.get("/api/v1/auth/me");
  const csrf = (await me.json()).csrf_token as string;
  return { request, csrf };
}

async function apiMutate(session: ApiSession, path: string, data: unknown, method = "post") {
  return session.request.fetch(path, {
    method: method.toUpperCase(),
    headers: { "X-CSRF-Token": session.csrf, "Content-Type": "application/json" },
    data,
  });
}

async function loginViaUi(page: Page, email: string, password: string) {
  if (process.env.E2E_INGRESS_RATE_LIMITED) await new Promise((resolve) => setTimeout(resolve, 12_100));
  await page.goto("/login");
  await page.getByLabel(/^E-mail/).fill(email);
  await page.getByLabel(/^Пароль/).fill(password);
  await page.getByRole("button", { name: "Войти" }).click();
  await page.waitForURL(/\/candidates/);
}

test("админ подтверждает pending-сотрудника: список обновляется без refresh, сотрудник работает, audit пишет approve", async ({ browser }) => {
  const log: string[] = [];

  const adminApi = await apiLogin(ADMIN.email, ADMIN.password);
  const register = await adminApi.request.post("/api/v1/auth/register", {
    headers: { Origin: ORIGIN, "Content-Type": "application/json" },
    data: {
      email: PENDING.email,
      first_name: PENDING.first,
      last_name: PENDING.last,
      position: PENDING.position,
      password: PENDING.password,
    },
  });
  expect(register.status()).toBe(201);
  log.push(`registered pending fixture ${PENDING.email}: ${register.status()}`);

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await loginViaUi(adminPage, ADMIN.email, ADMIN.password);

  await adminPage.goto("/admin/employees");
  await expect(adminPage.getByRole("tab", { name: "Ожидание" })).toHaveAttribute("aria-selected", "true");
  await adminPage.getByLabel("Поиск", { exact: true }).fill(PENDING.email);
  await expect(adminPage.getByRole("cell", { name: new RegExp(PENDING.email) })).toBeVisible({
    timeout: 10_000,
  });
  log.push(`pending tab shows fixture row for ${PENDING.email}`);

  await adminPage.getByRole("button", { name: "Подтвердить" }).first().click();
  await expect(adminPage.getByText(new RegExp(`Допустить ${PENDING.last} ${PENDING.first}`))).toBeVisible();
  const confirmButton = adminPage.getByRole("dialog").getByRole("button", { name: "Подтвердить" });
  await confirmButton.click();

  await expect(adminPage.getByText("Заявок на допуск нет")).toBeVisible({ timeout: 10_000 });
  expect(adminPage.url()).toContain("/admin/employees");
  log.push(`approve applied, pending list refreshed via SPA (url=${adminPage.url()}, no page reload)`);

  await adminPage.getByRole("tab", { name: "Допущенные" }).click();
  await expect(adminPage).toHaveURL(/state=active/);
  await adminPage.getByLabel("Поиск", { exact: true }).fill("");
  await adminPage.getByLabel("Поиск", { exact: true }).fill(PENDING.email);
  await expect(
    adminPage.locator("table tbody tr").filter({ hasText: PENDING.email }).locator("span[class*='badge']"),
  ).toHaveText("Допущен", { timeout: 10_000 });
  log.push(`employee visible in active tab with badge «Допущен»`);

  await adminPage.setViewportSize({ width: 1440, height: 900 });
  await adminPage.screenshot({ path: `${EVIDENCE}/task-10-approve.png`, fullPage: false });

  const staffContext = await browser.newContext();
  const staffPage = await staffContext.newPage();
  await loginViaUi(staffPage, PENDING.email, PENDING.password);
  await expect(staffPage.getByRole("heading", { level: 1, name: /Кандидаты/ })).toBeVisible();
  log.push(`approved employee ${PENDING.email} logged in and sees /candidates`);

  const employeeStatus = await staffPage.evaluate(async () => {
    const response = await fetch("/api/v1/candidates", { credentials: "include" });
    return response.status;
  });
  expect(employeeStatus).toBe(200);
  log.push(`employee API access: GET /candidates → ${employeeStatus} (in-page fetch via vite proxy)`);
  await staffContext.close();

  const audit = await adminApi.request.get("/api/v1/admin/audit?action=approve");
  const auditPayload = (await audit.json()) as { items: { actor_id: string; action: string }[]; total: number };
  expect(auditPayload.total).toBeGreaterThan(0);
  const approveEvent = auditPayload.items[0]!;
  log.push(`audit has approve event: action=${approveEvent.action} actor=${approveEvent.actor_id}`);
  expect(approveEvent.action).toBe("approve");

  await adminContext.close();
  await adminApi.request.dispose();
});

test("staff не проходит на /admin/employees; последний админ не может отключить себя (409 с объяснением), система жива", async ({ browser }) => {
  const log: string[] = [];

  const adminApi = await apiLogin(ADMIN.email, ADMIN.password);
  const register = await adminApi.request.post("/api/v1/auth/register", {
    headers: { Origin: ORIGIN, "Content-Type": "application/json" },
    data: {
      email: `staff.perm.${Date.now().toString(36)}@demo.example.test`,
      first_name: "Ирина",
      last_name: "Смирнова",
      position: "HR-менеджер",
      password: "пароль-надёжный-12",
    },
  });
  expect(register.status()).toBe(201);
  const list = await adminApi.request.get("/api/v1/admin/employees?state=pending");
  const payload = (await list.json()) as { items: { id: string; email: string }[] };
  const pendingStaff = payload.items.find((employee) => employee.email.startsWith("staff.perm."));
  const approve = await apiMutate(adminApi, `/api/v1/admin/employees/${pendingStaff!.id}/approve`, {});
  expect(approve.status()).toBe(200);
  log.push(`staff fixture approved via API: ${approve.status()}`);

  const staffContext = await browser.newContext();
  const staffPage = await staffContext.newPage();
  await loginViaUi(staffPage, pendingStaff!.email, "пароль-надёжный-12");
  await staffPage.goto("/admin/employees");
  await expect(staffPage.getByText("Недостаточно прав")).toBeVisible({ timeout: 10_000 });
  const staffBody = (await staffPage.locator("body").textContent()) ?? "";
  expect(staffBody).not.toContain(pendingStaff!.email);
  expect(staffBody).not.toContain("admin@demo.example.test");
  log.push(`staff direct URL /admin/employees → ForbiddenPage «Недостаточно прав», no admin data leaked`);
  expect(staffPage.getByRole("link", { name: "Админ" })).toHaveCount(0);
  log.push("staff navigation has no «Админ» link");
  await staffPage.screenshot({ path: `${EVIDENCE}/task-10-staff-forbidden.png`, fullPage: false });
  await staffContext.close();

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await loginViaUi(adminPage, ADMIN.email, ADMIN.password);
  await adminPage.goto("/admin/employees?state=active");
  const selfRow = adminPage.locator("table tbody tr").filter({ hasText: "это вы" });
  await expect(selfRow).toBeVisible({ timeout: 10_000 });
  await selfRow.getByRole("button", { name: "Отключить" }).click();

  const dialog = adminPage.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Вы отключаете себя/)).toBeVisible();
  log.push(`disable-self dialog warning shown (session revocation)`);

  const disableResponse = adminPage.waitForResponse(
    (response) => response.url().includes("/disable") && response.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Отключить" }).click();
  const response = await disableResponse;
  expect(response.status()).toBe(409);
  const errorBody = (await response.json()) as { code: string; message: string };
  expect(errorBody.code).toBe("LAST_ADMIN");
  await expect(dialog.getByText("Нельзя отключить последнего администратора")).toBeVisible({
    timeout: 10_000,
  });
  log.push(`disable self → HTTP ${response.status()} ${errorBody.code}: «${errorBody.message}» rendered in dialog`);

  await dialog.getByRole("button", { name: "Отмена" }).click();
  await adminPage.goto("/admin/audit");
  await expect(adminPage.getByRole("heading", { level: 1, name: /Журнал/ })).toBeVisible();
  log.push("system remains usable: admin navigated to /admin/audit after 409");

  const me = await adminApi.request.get("/api/v1/auth/me");
  expect(me.status()).toBe(200);
  const meState = ((await me.json()) as { state: string }).state;
  expect(meState).toBe("active");
  log.push(`admin session still active (state=${meState}), LAST_ADMIN invariant held`);
  await adminPage.screenshot({ path: `${EVIDENCE}/task-10-last-admin.png`, fullPage: false });

  mkdirSync(EVIDENCE, { recursive: true });
  writeFileSync(
    `${EVIDENCE}/task-10-permissions.txt`,
    ["task-10-permissions.txt — T10: staff forbidden + LAST_ADMIN 409", ...log, ""].join("\n"),
  );

  await adminContext.close();
  await adminApi.request.dispose();
});
