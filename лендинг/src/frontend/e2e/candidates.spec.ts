import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const ORIGIN = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173";
const API = process.env.PLAYWRIGHT_API_URL ?? ORIGIN;
const EVIDENCE = process.env.E2E_EVIDENCE_DIR ?? "/DATA/AppData/.sisyphus/evidence/ochakovo";
const ADMIN = { email: "admin@demo.example.test", password: "пароль-надёжный-12" };
const STAFF = { email: "irina.staff@demo.example.test", password: "пароль-надёжный-12" };

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

async function apiMutate(session: ApiSession, method: "post" | "patch", path: string, data: unknown) {
  return session.request.fetch(path, {
    method: method.toUpperCase(),
    headers: { "X-CSRF-Token": session.csrf, "Content-Type": "application/json" },
    data,
  });
}

async function ensureStaffApproved(admin: ApiSession) {
  const register = await apiMutate(admin, "post", "/api/v1/auth/register", {
    email: STAFF.email,
    first_name: "Ирина",
    last_name: "Смирнова",
    position: "HR-менеджер",
    password: STAFF.password,
  });
  const list = await admin.request.get("/api/v1/admin/employees?state=pending&q=irina.staff");
  const payload = (await list.json()) as { items: { id: string; email: string; state: string }[] };
  const pending = payload.items.find((employee) => employee.email === STAFF.email);
  if (pending !== undefined) {
    const approve = await apiMutate(admin, "post", `/api/v1/admin/employees/${pending.id}/approve`, {});
    if (approve.status() !== 200) {
      throw new Error(`approve failed: ${approve.status()} ${await approve.text()}`);
    }
  } else if (register.status() !== 201) {
    const active = await admin.request.get("/api/v1/admin/employees?state=active&q=irina.staff");
    const activePayload = (await active.json()) as { items: { email: string }[] };
    if (!activePayload.items.some((employee) => employee.email === STAFF.email)) {
      throw new Error(`unexpected register response: ${register.status()} ${await register.text()}`);
    }
  }
}

async function ensureSemenCandidate(staff: ApiSession): Promise<string> {
  const search = await staff.request.get("/api/v1/candidates?q=%D1%81%D0%B5%D0%BC%D0%B5%D0%BD");
  const found = (await search.json()) as { items: { id: string }[]; total: number };
  if (found.total > 0) {
    return found.items[0]!.id;
  }
  const created = await apiMutate(staff, "post", "/api/v1/candidates", {
    last_name: "Семёнов",
    first_name: "Семён",
    middle_name: "Петрович",
    phone: "+79995550001",
    telegram: "semenov_spb",
    age: 22,
    who: "student",
    vacancy_id: null,
    position: null,
    city: null,
    employment: "practice",
    start_date: null,
    shifts: null,
    resume_url: null,
    experience: null,
    about: "Пришёл с ярмарки вакансий",
    event: "Ярмарка",
    status: "new",
    source: "walk_in",
    processing_basis: "candidate_consent",
    department: null,
    responsible_id: null,
    priority: "normal",
    expected_salary: null,
    interview_at: null,
    next_contact_at: null,
    hot: false,
    rating: 3,
    next_step: null,
  });
  if (created.status() !== 201) {
    throw new Error(`seed Семён failed: ${created.status()} ${await created.text()}`);
  }
  return ((await created.json()) as { id: string }).id;
}

let apiApplicationTotal: number | null = null;
let apiCsvStatus: number | null = null;

test.beforeAll(async () => {
  mkdirSync(EVIDENCE, { recursive: true });
  const admin = await apiLogin(ADMIN.email, ADMIN.password);
  await ensureStaffApproved(admin);
  const staff = await apiLogin(STAFF.email, STAFF.password);
  await ensureSemenCandidate(staff);
  const applicationList = await staff.request.get(
    "/api/v1/candidates?status%5B%5D=application&sort=last_name&direction=asc&page=1&page_size=20",
  );
  apiApplicationTotal = ((await applicationList.json()) as { total: number }).total;
  const csv = await staff.request.get("/api/v1/candidates/export.csv?status%5B%5D=application");
  apiCsvStatus = csv.status();
  await admin.request.dispose();
  await staff.request.dispose();
});

async function loginViaUi(page: Page, email: string, password: string) {
  if (process.env.E2E_INGRESS_RATE_LIMITED) await new Promise((resolve) => setTimeout(resolve, 12_100));
  await page.goto("/login");
  await page.getByLabel(/^E-mail/).fill(email);
  await page.getByLabel(/^Пароль/).fill(password);
  await page.getByRole("button", { name: "Войти" }).click();
  await page.waitForURL(/\/candidates/);
}

async function firstRowName(page: Page): Promise<string> {
  const link = page.locator('table tbody tr td a[class*="rowLink"]').first();
  return (await link.textContent())?.trim() ?? "";
}

test("реестр на 45 кандидатах: поиск, фильтры, сортировка, reload, deep-link, back-forward, page2, 390px", async ({ page }) => {
  const urlLog: string[] = [];
  await loginViaUi(page, STAFF.email, STAFF.password);
  await expect(page.getByRole("columnheader", { name: "Дата добавления" })).toBeVisible();
  await expect(page.getByText(/Найдено: \d+/)).toBeVisible();
  const activeTotal = await page.getByText(/^Найдено: \d+$/).textContent();
  urlLog.push(`after login: url=${page.url()} total=${activeTotal}`);

  await page.getByLabel("Поиск").fill("семен");
  await expect(page).toHaveURL(/q=%D1%81%D0%B5%D0%BC%D0%B5%D0%BD/);
  await expect(page.getByText("Найдено: 1")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("link", { name: /Семёнов Семён/ })).toBeVisible();
  urlLog.push(`q=семен: url=${page.url()} total=${await page.getByText(/^Найдено: \d+$/).textContent()}`);

  await page.getByLabel("Поиск").fill("");
  await page.waitForURL(/\/candidates$/, { timeout: 5_000 });
  await expect(page.getByText(/^Найдено: \d+$/)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Анкета" }).click();
  await expect(page).toHaveURL(/status=application/);
  // React Query retains the previous page while filters fetch: URL/visibility is not readiness.
  await expect(page.getByText(/^Найдено: \d+$/)).toHaveText(`Найдено: ${apiApplicationTotal}`, { timeout: 15_000 });
  urlLog.push(`status=application: url=${page.url()} total=${await page.getByText(/^Найдено: \d+$/).textContent()}`);
  const applicationTotal = Number((await page.getByText(/^Найдено: \d+$/).textContent())!.replace(/\D+/g, ""));
  expect(applicationTotal).toBeGreaterThan(0);
  const badges = page.locator("table tbody span[class*='badge']").first();
  await expect(badges).toHaveText(/Анкета/);

  const sortedResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/v1/candidates" && url.searchParams.get("sort") === "last_name" && url.searchParams.get("direction") === "asc";
  });
  await page.getByLabel("Сортировка").selectOption("last_name.asc");
  await expect(page).toHaveURL(/sort=last_name\.asc/);
  const sortedItems = (await (await sortedResponse).json()) as { items: { id: string }[] };
  await expect(page.locator('table tbody tr td a[class*="rowLink"]').first()).toHaveAttribute("href", `/candidates/${sortedItems.items[0]!.id}`);
  const sortedFirst = await firstRowName(page);
  urlLog.push(`sort=last_name.asc: url=${page.url()} firstRow=${sortedFirst}`);

  await page.reload();
  await expect(page.getByRole("columnheader", { name: "ФИО" })).toBeVisible();
  await expect(page.getByLabel("Поиск")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Анкета" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Сортировка")).toHaveValue("last_name.asc");
  await expect((await firstRowName(page))).toBe(sortedFirst);
  urlLog.push(`after reload: url=${page.url()} firstRow=${await firstRowName(page)}`);

  await page.goBack();
  await expect(page).toHaveURL(/status=application$/, { timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Анкета" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Сортировка")).toHaveValue("created_at.desc");
  urlLog.push(`after back: url=${page.url()}`);
  await page.goForward();
  await expect(page).toHaveURL(/status=application&sort=last_name\.asc/, { timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Анкета" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Сортировка")).toHaveValue("last_name.asc");
  urlLog.push(`after forward: url=${page.url()}`);

  await page.getByRole("button", { name: "Сбросить фильтры" }).click();
  await expect(page).toHaveURL(/\/candidates$/);
  await expect(page.getByText(/^Найдено: \d+$/)).toHaveText(activeTotal!, { timeout: 15_000 });
  await expect(page.locator("table tbody tr")).toHaveCount(20);
  const page1Names = await page.locator('table tbody tr td a[class*="rowLink"]').allTextContents();
  expect(page1Names.length).toBe(20);
  await page.getByRole("button", { name: "Страница 2" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect
    .poll(async () => (await firstRowName(page)).trim(), { timeout: 15_000 })
    .not.toBe(page1Names[0]!.trim());
  const page2Names = await page.locator('table tbody tr td a[class*="rowLink"]').allTextContents();
  expect(page2Names.length).toBe(20);
  const overlap = page2Names.filter((name) => page1Names.includes(name));
  expect(overlap, "page2 без дублей со page1").toHaveLength(0);
  urlLog.push(`page2: url=${page.url()} rows=${page2Names.length} noDupesWithPage1=true`);

  const deepLink = "/candidates?status=application&sort=last_name.asc";
  await page.goto(deepLink);
  await expect(page.getByRole("button", { name: "Анкета" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Сортировка")).toHaveValue("last_name.asc");
  urlLog.push(`deep link ${deepLink}: controls restored, url=${page.url()}`);

  urlLog.push(`api total for same filters (staff session): ${apiApplicationTotal}`);
  expect(apiApplicationTotal).toBe(applicationTotal);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/candidates");
  await expect(page.getByRole("list", { name: "Кандидаты" }).locator("li").first()).toBeVisible();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth, "нет горизонтального скролла на 390px").toBeLessThanOrEqual(390);
  urlLog.push(`390px: scrollWidth=${scrollWidth}, mobile cards visible`);

  urlLog.push(`csv status via staff session=${apiCsvStatus}`);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/candidates?status=application&sort=last_name.asc");
  await expect(page.getByRole("columnheader", { name: "Дата добавления" })).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE}/task-9-registry.png`, fullPage: false });

  const urlStateEvidence = [
    "task-9-url-state.txt — T9 реестр: URL/контролы/total против API",
    ...urlLog,
    "",
  ].join("\n");
  writeFileSync(`${EVIDENCE}/task-9-url-state.txt`, urlStateEvidence);
});

test("два сотрудника меняют одну карточку: A сохраняет статус, B получает 409, черновик жив, комментарий один", async ({ browser }) => {
  const log: string[] = [];

  const staffSession = await apiLogin(STAFF.email, STAFF.password);
  const list = await staffSession.request.get("/api/v1/candidates?sort=last_name&direction=asc");
  const candidates = (await list.json()) as { items: { id: string }[] };
  const candidateId = candidates.items[0]!.id;
  await staffSession.request.dispose();

  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  await loginViaUi(pageA, ADMIN.email, ADMIN.password);
  await pageA.goto(`/candidates/${candidateId}`);
  await expect(pageA.getByText(/Дата добавления:/)).toBeVisible();

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await loginViaUi(pageB, STAFF.email, STAFF.password);
  await pageB.goto(`/candidates/${candidateId}/edit`);
  await expect(pageB.getByLabel(/^Подразделение/)).toBeVisible();
  const stageBefore = await pageB.getByLabel(/^Этап/).inputValue();
  log.push(`B opened edit: stage=${stageBefore}, version page loaded`);

  await pageA.getByRole("button", { name: "Редактировать" }).click();
  await expect(pageA.getByLabel(/^Этап/)).toBeVisible();
  const targetStage = stageBefore === "interview" ? "offer" : "interview";
  await pageA.getByLabel(/^Этап/).selectOption(targetStage);
  await pageA.getByRole("button", { name: "Сохранить изменения" }).click();
  await pageA.waitForURL(new RegExp(`/candidates/${candidateId}$`));
  await expect(pageA.locator("span[class*='badge']").first()).toBeVisible();
  log.push(`A saved stage=${targetStage} and returned to detail`);

  await pageB.getByLabel(/^Подразделение/).fill("Цех розлива-конфликт");
  await pageB.getByRole("button", { name: "Сохранить изменения" }).click();
  await expect(pageB.getByText("Карточка изменилась на сервере")).toBeVisible({ timeout: 10_000 });
  const draftValue = await pageB.getByLabel(/^Подразделение/).inputValue();
  expect(draftValue).toBe("Цех розлива-конфликт");
  log.push(`B got 409 conflict UI, draft preserved: department="${draftValue}"`);

  await pageB.screenshot({ path: `${EVIDENCE}/task-9-conflict.png`, fullPage: false });

  await pageB.goto(`/candidates/${candidateId}`);
  await expect(pageB.getByText(/Дата добавления:/)).toBeVisible();
  const detailText = (await pageB.locator("body").textContent()) ?? "";
  expect(detailText).not.toContain("Цех розлива-конфликт");
  log.push(`B refreshed: A's stage present=${detailText!.includes("Собеседование") || detailText!.includes("Предложение")}, B's department NOT applied`);

  const commentBody = `Проверка конфликта ${Date.now()}`;
  await pageB.getByLabel("Новый комментарий").fill(commentBody);
  await pageB.getByRole("button", { name: "Добавить комментарий" }).click();
  await expect(pageB.getByText(commentBody).first()).toBeVisible({ timeout: 10_000 });
  log.push(`B posted comment "${commentBody}"`);

  await pageB.reload();
  await expect(pageB.getByText(/Дата добавления:/)).toBeVisible();
  await expect
    .poll(async () => pageB.getByText(commentBody, { exact: true }).count(), {
      timeout: 15_000,
    })
    .toBe(1);
  log.push("after reload comment appears exactly once (count=1)");

  mkdirSync(EVIDENCE, { recursive: true });
  writeFileSync(
    `${EVIDENCE}/task-9-conflict.txt`,
    ["task-9-conflict.txt — T9 конфликт версий 409 (два контекста A=admin, B=staff)", ...log, ""].join("\n"),
  );

  await contextA.close();
  await contextB.close();
});
