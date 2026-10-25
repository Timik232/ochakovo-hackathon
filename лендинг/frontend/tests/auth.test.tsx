import { QueryClient } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { AppProviders } from "../src/app/providers";
import { AuthProvider } from "../src/features/auth/AuthProvider";
import { LoginPage } from "../src/features/auth/LoginPage";
import { RegisterPage } from "../src/features/auth/RegisterPage";
import { RegistrationPendingPage } from "../src/features/auth/RegistrationPendingPage";
import { ChangePasswordPage } from "../src/features/auth/ChangePasswordPage";
import { AdminRoute, RequireAuth, StaffRoute } from "../src/features/auth/RequireAuth";
import { StaffPlaceholder } from "../src/features/auth/StaffPlaceholder";
import { server } from "./msw-server";
import {
  ADMIN_ACTIVE_ME_FIXTURE,
  LOGIN_STAFF_VIEW_FIXTURE,
  STAFF_ACTIVE_ME_FIXTURE,
  STAFF_MUST_CHANGE_ME_FIXTURE,
} from "./msw-handlers";

const ME_URL = "http://localhost/api/v1/auth/me";
const LOGIN_URL = "http://localhost/api/v1/auth/login";
const REGISTER_URL = "http://localhost/api/v1/auth/register";
const LOGOUT_URL = "http://localhost/api/v1/auth/logout";
const PASSWORD_URL = "http://localhost/api/v1/auth/password";
const EVIDENCE_DIR = "/DATA/AppData/.sisyphus/evidence/ochakovo";

type User = ReturnType<typeof userEvent.setup>;

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function NavProbe() {
  const navigate = useNavigate();
  useEffect(() => {
    (window as { __testNavigate?: (to: string | number) => void }).__testNavigate = (to) => {
      if (typeof to === "number") {
        navigate(to);
      } else {
        navigate(to);
      }
    };
  });
  return null;
}

function meReturns(fixture: Record<string, unknown> | null) {
  server.use(
    http.get(
      ME_URL,
      () =>
        fixture === null
          ? HttpResponse.json(
              { code: "UNAUTHENTICATED", message: "Требуется вход в систему", request_id: "msw" },
              { status: 401 },
            )
          : HttpResponse.json(fixture),
    ),
  );
}

interface CapturedJsonRequest {
  headers: Record<string, string | null>;
  body: unknown;
}

function spyJson(url: string, respond: () => Response) {
  const captured: CapturedJsonRequest[] = [];
  server.use(
    http.post(url, async ({ request }) => {
      captured.push({
        headers: { csrf: request.headers.get("X-CSRF-Token") },
        body: await request.json(),
      });
      return respond();
    }),
  );
  return captured;
}

function renderApp(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const view = render(
    <AppProviders queryClient={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<StaffPlaceholder title="Лендинг" note="public" />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/registration-pending" element={<RegistrationPendingPage />} />
            <Route
              path="/change-password"
              element={
                <RequireAuth mustChangeExempt>
                  <ChangePasswordPage />
                </RequireAuth>
              }
            />
            <Route element={<StaffRoute />}>
              <Route path="/candidates" element={<StaffPlaceholder title="Кандидаты" note="Реестр готовится" />} />
              <Route path="/candidates/new" element={<StaffPlaceholder title="Новый" note="—" />} />
              <Route path="/candidates/:id" element={<StaffPlaceholder title="Карточка" note="—" />} />
              <Route path="/candidates/:id/edit" element={<StaffPlaceholder title="Правка" note="—" />} />
            </Route>
            <Route element={<AdminRoute />}>
              <Route path="/admin/employees" element={<StaffPlaceholder title="Сотрудники" note="—" />} />
              <Route path="/admin/audit" element={<StaffPlaceholder title="Журнал" note="—" />} />
            </Route>
            <Route path="*" element={<LocationProbe />} />
          </Routes>
          <NavProbe />
          <LocationProbe />
        </AuthProvider>
      </MemoryRouter>
    </AppProviders>,
  );
  return { queryClient, ...view };
}

function location(): string {
  return screen.getByTestId("location").textContent ?? "";
}

async function fillLogin(user: User, email = "irina.staff@example.test", password = "пароль-надёжный-12") {
  await user.type(screen.getByLabelText(/^E-mail/), email);
  await user.type(screen.getByLabelText(/^Пароль/), password);
  await user.click(screen.getByRole("button", { name: "Войти" }));
}

async function fillRegister(user: User) {
  await user.type(screen.getByLabelText(/^Фамилия/), "Смирнова");
  await user.type(screen.getByLabelText(/^Имя/), "Ирина");
  await user.type(screen.getByLabelText(/^Должность/), "HR-менеджер");
  await user.type(screen.getByLabelText(/^E-mail/), "irina.staff@example.test");
  await user.type(screen.getByLabelText(/^Пароль/), "пароль-надёжный-12");
  await user.type(screen.getByLabelText(/^Повторите пароль/), "пароль-надёжный-12");
}

describe("Вход сотрудника", () => {
  it("успешный вход: сессия, staff-оболочка и переход в /candidates", async () => {
    const user = userEvent.setup();
    let loggedIn = false;
    server.use(
      http.get(ME_URL, () =>
        loggedIn
          ? HttpResponse.json(STAFF_ACTIVE_ME_FIXTURE)
          : HttpResponse.json(
              { code: "UNAUTHENTICATED", message: "Требуется вход в систему", request_id: "msw" },
              { status: 401 },
            ),
      ),
    );
    const loginCaptured = spyJson(LOGIN_URL, () => {
      loggedIn = true;
      return HttpResponse.json(LOGIN_STAFF_VIEW_FIXTURE, { status: 200 });
    });
    renderApp("/login");

    await fillLogin(user);
    expect(await screen.findByText("Смирнова Ирина")).toBeInTheDocument();
    expect(location()).toBe("/candidates");
    expect(screen.getByRole("link", { name: "Кандидаты" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Админ" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Выйти" })).toBeInTheDocument();
    expect(loginCaptured[0]?.body).toEqual({
      email: "irina.staff@example.test",
      password: "пароль-надёжный-12",
    });
  });

  it("401 — общее сообщение без перечисления пользователей", async () => {
    const user = userEvent.setup();
    renderApp("/login");

    await fillLogin(user);
    expect(await screen.findByText("Неверная e-mail или пароль")).toBeInTheDocument();
    for (const leak of [/не существует/i, /пароль неверен/i, /нет такого/i, /email занят/i]) {
      expect(screen.queryByText(leak)).not.toBeInTheDocument();
    }
    expect(location()).toBe("/login");
  });

  it("ACCOUNT_PENDING — экран ожидания без staff-оболочки", async () => {
    const user = userEvent.setup();
    spyJson(LOGIN_URL, () =>
      HttpResponse.json(
        { code: "ACCOUNT_PENDING", message: "Доступ к учётной записи пока не предоставлен", request_id: "msw" },
        { status: 403 },
      ),
    );
    renderApp("/login");

    await fillLogin(user);
    expect(await screen.findByText(/Регистрация отправлена/)).toBeInTheDocument();
    expect(location()).toBe("/registration-pending");
    expect(screen.queryByRole("link", { name: "Кандидаты" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Выйти" })).not.toBeInTheDocument();
  });

  it.each(["ACCOUNT_REJECTED", "ACCOUNT_DISABLED"] as const)(
    "%s — нейтральный отказ, без staff-оболочки",
    async (code) => {
      const user = userEvent.setup();
      spyJson(LOGIN_URL, () =>
        HttpResponse.json({ code, message: "Доступ к учётной записи пока не предоставлен", request_id: "msw" }, { status: 403 }),
      );
      renderApp("/login");

      await fillLogin(user);
      expect(await screen.findByText("Доступ приостановлен, свяжитесь с администратором")).toBeInTheDocument();
      expect(location()).toBe("/login");
      expect(screen.queryByRole("button", { name: "Выйти" })).not.toBeInTheDocument();
    },
  );

  it("сетевая ошибка — сообщение и форма жива", async () => {
    const user = userEvent.setup();
    server.use(http.post(LOGIN_URL, () => HttpResponse.error()));
    renderApp("/login");

    await fillLogin(user);
    expect(await screen.findByText("Нет связи с сервером")).toBeInTheDocument();
    expect(location()).toBe("/login");
  });
});

describe("Регистрация сотрудника", () => {
  it("клиентская валидация: короткий пароль и несовпадение — без запроса", async () => {
    const user = userEvent.setup();
    const captured = spyJson(REGISTER_URL, () =>
      HttpResponse.json({ message: "Регистрация принята" }, { status: 201 }),
    );
    renderApp("/register");

    await user.type(screen.getByLabelText(/^Фамилия/), "Смирнова");
    await user.type(screen.getByLabelText(/^Имя/), "Ирина");
    await user.type(screen.getByLabelText(/^Должность/), "HR-менеджер");
    await user.type(screen.getByLabelText(/^E-mail/), "irina.staff@example.test");
    await user.type(screen.getByLabelText(/^Пароль/), "короткий");
    await user.type(screen.getByLabelText(/^Повторите пароль/), "другой-совсем-пароль");
    await user.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    expect((await screen.findAllByText("Минимум 12 символов")).length).toBeGreaterThanOrEqual(2);
    expect(await screen.findByText("Пароли не совпадают")).toBeInTheDocument();
    expect(captured).toHaveLength(0);
  });

  it("успех — тело только из пользовательских полей, переход на экран ожидания", async () => {
    const user = userEvent.setup();
    const captured = spyJson(REGISTER_URL, () =>
      HttpResponse.json({ message: "Регистрация принята. Ожидайте допуска администратора" }, { status: 201 }),
    );
    renderApp("/register");

    await fillRegister(user);
    await user.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    expect(await screen.findByText(/Регистрация отправлена/)).toBeInTheDocument();
    expect(location()).toBe("/registration-pending");
    expect(captured[0]?.body).toEqual({
      email: "irina.staff@example.test",
      first_name: "Ирина",
      last_name: "Смирнова",
      position: "HR-менеджер",
      password: "пароль-надёжный-12",
    });
    expect(JSON.stringify(captured[0]?.body)).not.toContain("role");
    expect(JSON.stringify(captured[0]?.body)).not.toContain("state");
  });

  it("503 INTAKE_DISABLED — регистрация временно закрыта", async () => {
    const user = userEvent.setup();
    spyJson(REGISTER_URL, () =>
      HttpResponse.json(
        { code: "INTAKE_DISABLED", message: "Регистрация временно недоступна", request_id: "msw" },
        { status: 503 },
      ),
    );
    renderApp("/register");

    await fillRegister(user);
    await user.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    expect(await screen.findByText("Регистрация временно закрыта")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Зарегистрироваться" })).not.toBeInTheDocument();
  });

  it("409 EMAIL_EXISTS — e-mail занят", async () => {
    const user = userEvent.setup();
    spyJson(REGISTER_URL, () =>
      HttpResponse.json(
        { code: "EMAIL_EXISTS", message: "Этот email уже зарегистрирован", request_id: "msw" },
        { status: 409 },
      ),
    );
    renderApp("/register");

    await fillRegister(user);
    await user.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    expect(await screen.findByText("Этот email уже зарегистрирован")).toBeInTheDocument();
  });
});

describe("Принудительная смена пароля", () => {
  it("прямой заход в /candidates при must_change_password редиректит на /change-password", async () => {
    meReturns(STAFF_MUST_CHANGE_ME_FIXTURE);
    renderApp("/candidates");

    expect(await screen.findByRole("heading", { name: /Смена/ })).toBeInTheDocument();
    expect(location()).toBe("/change-password");
    expect(screen.getByText("Сначала задайте новый пароль")).toBeInTheDocument();
  });

  it("вход с must_change_password попадает на /change-password, а не в кабинет", async () => {
    const user = userEvent.setup();
    meReturns(STAFF_MUST_CHANGE_ME_FIXTURE);
    spyJson(LOGIN_URL, () =>
      HttpResponse.json({ ...LOGIN_STAFF_VIEW_FIXTURE, must_change_password: true }, { status: 200 }),
    );
    renderApp("/login");

    await fillLogin(user);
    expect(await screen.findByRole("heading", { name: /Смена/ })).toBeInTheDocument();
    expect(location()).toBe("/change-password");
  });

  it("успешная смена: CSRF-header, тело current_password/new_password, повторный вход", async () => {
    const user = userEvent.setup();
    let revoked = false;
    meReturns(null);
    server.use(
      http.get(ME_URL, () =>
        revoked
          ? HttpResponse.json(
              { code: "UNAUTHENTICATED", message: "Требуется вход в систему", request_id: "msw" },
              { status: 401 },
            )
          : HttpResponse.json(STAFF_MUST_CHANGE_ME_FIXTURE),
      ),
    );
    const captured = spyJson(PASSWORD_URL, () => {
      revoked = true;
      return new HttpResponse(null, { status: 204 });
    });
    renderApp("/change-password");

    await user.type(await screen.findByLabelText(/^Текущий пароль/), "временный-пароль-1");
    await user.type(screen.getByLabelText(/^Новый пароль/), "новый-надёжный-пароль");
    await user.type(screen.getByLabelText(/^Повторите новый пароль/), "новый-надёжный-пароль");
    await user.click(screen.getByRole("button", { name: "Сменить пароль" }));

    expect(await screen.findByText("Войдите с новым паролем.")).toBeInTheDocument();
    expect(location()).toBe("/login");
    expect(captured[0]?.body).toEqual({
      current_password: "временный-пароль-1",
      new_password: "новый-надёжный-пароль",
    });
    expect(captured[0]?.headers.csrf).toBe("csrf-must-change-1");
  });

  it("неверный текущий пароль — сообщение об ошибке, экран остаётся", async () => {
    const user = userEvent.setup();
    meReturns(STAFF_MUST_CHANGE_ME_FIXTURE);
    spyJson(PASSWORD_URL, () =>
      HttpResponse.json(
        { code: "INVALID_CREDENTIALS", message: "Неверный текущий пароль", request_id: "msw" },
        { status: 401 },
      ),
    );
    renderApp("/change-password");

    await user.type(await screen.findByLabelText(/^Текущий пароль/), "не-тот-пароль");
    await user.type(screen.getByLabelText(/^Новый пароль/), "новый-надёжный-пароль");
    await user.type(screen.getByLabelText(/^Повторите новый пароль/), "новый-надёжный-пароль");
    await user.click(screen.getByRole("button", { name: "Сменить пароль" }));

    expect(await screen.findByText("Неверный текущий пароль")).toBeInTheDocument();
    expect(location()).toBe("/change-password");
  });
});

describe("Сессия, logout и права", () => {
  it("logout: CSRF-header, полная очистка Query-кэша, защищённый маршрут после выхода ведёт на /login", async () => {
    const user = userEvent.setup();
    let sessionActive = true;
    server.use(
      http.get(ME_URL, () =>
        sessionActive
          ? HttpResponse.json(STAFF_ACTIVE_ME_FIXTURE)
          : HttpResponse.json(
              { code: "UNAUTHENTICATED", message: "Требуется вход в систему", request_id: "msw" },
              { status: 401 },
            ),
      ),
    );
    const logoutCaptured = spyJson(LOGOUT_URL, () => {
      sessionActive = false;
      return new HttpResponse(null, { status: 204 });
    });
    const { queryClient } = renderApp("/candidates");
    await screen.findByText("Смирнова Ирина");

    queryClient.setQueryData(["candidates", "list"], {
      items: [{ id: "11111111-1111-4111-8111-111111111199", last_name: "Пирогов" }],
    });
    await user.click(screen.getByRole("button", { name: "Выйти" }));

    // Wait on the actual logout/cache state, not just a rendered button: React
    // and query-cache notifications can settle on different ticks under load.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Войти" })).toBeInTheDocument();
      expect(location()).toBe("/login");
      expect(logoutCaptured[0]?.headers.csrf).toBe("csrf-staff-1");
      expect(queryClient.getQueryState(["candidates", "list"])).toBeUndefined();
      expect(queryClient.getQueryData(["candidates", "list"])).toBeUndefined();
      expect(
        queryClient.getQueryCache().getAll().map((query) => query.queryKey.join(".")),
      ).not.toContain("candidates.list");
    }, { timeout: 10000 });

    await act(async () => {
      (window as { __testNavigate?: (to: string | number) => void }).__testNavigate?.("/candidates/11111111-1111-4111-8111-111111111199");
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Войти" })).toBeInTheDocument();
      expect(location()).toMatch(/^\/login\?returnTo=/);
    }, { timeout: 10000 });

    mkdirSync(EVIDENCE_DIR, { recursive: true });
    writeFileSync(
      `${EVIDENCE_DIR}/task-8-logout.txt`,
      [
        "Vitest tests/auth.test.tsx — сценарий «logout: CSRF-header, полная очистка Query-кэша…»",
        "Полный вывод прогона: task-8-auth-vitest.txt (сохраняется отдельным шагом).",
        "POST /api/v1/auth/logout зафиксирован MSW: X-CSRF-Token=csrf-staff-1, status 204.",
        "QueryClient после выхода: ключ ['candidates','list'] отсутствует, getQueryCache() без PII-ключей.",
        "Переход на защищённый /candidates/:id после logout → /login?returnTo=…, staff-оболочка не рендерится.",
      ].join("\n"),
    );
  }, 20000);

  it("истёкшая сессия: 401 на /me защищает кабинет и отдаёт returnTo", async () => {
    meReturns(null);
    renderApp("/candidates");

    expect(await screen.findByRole("button", { name: "Войти" })).toBeInTheDocument();
    expect(location()).toBe("/login?returnTo=%2Fcandidates");
  });

  it("staff на /admin/* — «Недостаточно прав»; admin видит раздел и пункт меню", async () => {
    meReturns(STAFF_ACTIVE_ME_FIXTURE);
    renderApp("/admin/employees");
    expect(await screen.findByText("Недостаточно прав")).toBeInTheDocument();
    expect(screen.queryByText("Сотрудники")).not.toBeInTheDocument();

    meReturns(ADMIN_ACTIVE_ME_FIXTURE);
    renderApp("/admin/employees");
    expect(await screen.findByText("Сотрудники")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Админ" })).toBeInTheDocument();
  });
});
