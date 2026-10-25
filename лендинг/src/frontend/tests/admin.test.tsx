import { QueryClient } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import { AppProviders } from "../src/app/providers";
import { AuthProvider } from "../src/features/auth/AuthProvider";
import { AdminRoute, StaffRoute } from "../src/features/auth/RequireAuth";
import { StaffShell } from "../src/features/auth/StaffShell";
import { EmployeesPage } from "../src/features/admin/EmployeesPage";
import { AuditPage } from "../src/features/admin/AuditPage";
import { VacanciesPage } from "../src/features/admin/VacanciesPage";
import { server } from "./msw-server";
import {
  ACTIVE_STAFF_EMPLOYEE_FIXTURE,
  ADMIN_ACTIVE_ME_FIXTURE,
  AUDIT_EVENTS_ALL_FIXTURE,
  DISABLED_EMPLOYEE_FIXTURE,
  LAST_ADMIN_EMPLOYEE_FIXTURE,
  PENDING_EMPLOYEE_FIXTURE,
  STAFF_ACTIVE_ME_FIXTURE,
} from "./msw-handlers";

const BASE = "http://localhost";
const ADMIN_EMPLOYEES_URL = `${BASE}/api/v1/admin/employees`;

function renderAdminApp(initialEntry: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AppProviders queryClient={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AuthProvider>
          <Routes>
            <Route element={<StaffRoute />}>
              <Route path="/candidates" element={<p>Реестр</p>} />
              <Route path="/vacancies" element={<VacanciesPage />} />
            </Route>
            <Route element={<AdminRoute />}>
              <Route path="/admin/employees" element={<EmployeesPage />} />
              <Route path="/admin/audit" element={<AuditPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </AppProviders>,
  );
}

function meReturns(fixture: Record<string, unknown> | null) {
  server.use(
    http.get(`${BASE}/api/v1/auth/me`, () =>
      fixture === null
        ? HttpResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход" }, { status: 401 })
        : HttpResponse.json(fixture),
    ),
  );
}

function captureGet(url: string, respond: () => unknown) {
  const captured: string[] = [];
  server.use(
    http.get(url, ({ request }) => {
      captured.push(request.url);
      return HttpResponse.json(respond() as object);
    }),
  );
  return captured;
}

interface CapturedRequest {
  url: string;
  csrf: string | null;
  body: unknown;
}

function captureMut(method: "post" | "patch", url: string, respond: () => unknown, status = 200) {
  const captured: CapturedRequest[] = [];
  server.use(
    http[method](url, async ({ request }) => {
      captured.push({
        url: request.url,
        csrf: request.headers.get("X-CSRF-Token"),
        body: await request.json().catch(() => null),
      });
      return HttpResponse.json(respond() as object, { status });
    }),
  );
  return captured;
}

const emptyPage = { items: [], total: 0, page: 1, page_size: 20 };

describe("T10 админ-интерфейс: сотрудники", () => {
  it("табы статусов — URL state: клик меняет state, deep-link восстанавливает таб", async () => {
    const user = userEvent.setup();
    const requests = captureGet(ADMIN_EMPLOYEES_URL, () => emptyPage);
    meReturns(ADMIN_ACTIVE_ME_FIXTURE);
    const first = renderAdminApp("/admin/employees");
    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    expect(new URL(requests[0]!).searchParams.get("state")).toBe("pending");

    await user.click(screen.getByRole("tab", { name: "Допущенные" }));
    await waitFor(() => {
      expect(new URL(requests.at(-1)!).searchParams.get("state")).toBe("active");
    });
    first.unmount();

    meReturns(ADMIN_ACTIVE_ME_FIXTURE);
    renderAdminApp("/admin/employees?state=disabled");
    await waitFor(() => expect(new URL(requests.at(-1)!).searchParams.get("state")).toBe("disabled"));
    expect(screen.getByRole("tab", { name: "Отключённые" })).toHaveAttribute("aria-selected", "true");
  });

  it("поиск q уходит в API-запрос списка", async () => {
    const user = userEvent.setup();
    const requests = captureGet(ADMIN_EMPLOYEES_URL, () => ({
      items: [PENDING_EMPLOYEE_FIXTURE],
      total: 1,
      page: 1,
      page_size: 20,
    }));
    meReturns(ADMIN_ACTIVE_ME_FIXTURE);
    renderAdminApp("/admin/employees");
    const search = await screen.findByLabelText("Поиск");

    await user.type(search, "орлов");
    await waitFor(() => {
      expect(new URL(requests.at(-1)!).searchParams.get("q")).toBe("орлов");
    });
  });

  it("approve: подтверждение, CSRF-header, список обновляется после ответа сервера", async () => {
    const user = userEvent.setup();
    let listCalls = 0;
    server.use(
      http.get(ADMIN_EMPLOYEES_URL, () => {
        listCalls += 1;
        return HttpResponse.json(
          listCalls === 1
            ? { items: [PENDING_EMPLOYEE_FIXTURE], total: 1, page: 1, page_size: 20 }
            : emptyPage,
        );
      }),
    );
    const approveRequests = captureMut(
      "post",
      `${ADMIN_EMPLOYEES_URL}/${PENDING_EMPLOYEE_FIXTURE.id}/approve`,
      () => ({ ...PENDING_EMPLOYEE_FIXTURE, state: "active" }),
    );

    meReturns(ADMIN_ACTIVE_ME_FIXTURE);
    renderAdminApp("/admin/employees");
    await screen.findAllByText("Орлов Никита");

    await user.click(screen.getAllByRole("button", { name: "Подтвердить" })[0]!);
    expect(screen.getByText(/Допустить Орлов Никита/)).toBeVisible();
    await user.click(screen.getAllByRole("button", { name: "Подтвердить" }).at(-1)!);

    await waitFor(() => expect(approveRequests).toHaveLength(1));
    expect(approveRequests[0]!.csrf).toBe("csrf-admin-1");
    expect(approveRequests[0]!.body).toEqual({});

    await waitFor(() => expect(listCalls).toBeGreaterThan(1));
    await waitFor(() => expect(screen.getByText("Заявок на допуск нет")).toBeVisible());
  });

  it("reject: подтверждение для pending-заявки", async () => {
    const user = userEvent.setup();
    meReturns(ADMIN_ACTIVE_ME_FIXTURE);
    renderAdminApp("/admin/employees");
    await screen.findAllByText("Орлов Никита");

    const rejectRequests = captureMut(
      "post",
      `${ADMIN_EMPLOYEES_URL}/${PENDING_EMPLOYEE_FIXTURE.id}/reject`,
      () => ({ ...PENDING_EMPLOYEE_FIXTURE, state: "rejected" }),
    );

    const pendingRow = await waitFor(() => {
      const row = screen
        .getAllByRole("row")
        .find((candidate) => candidate.textContent?.includes("nikita.pending"));
      if (row === undefined) {
        throw new Error("строка Орлова ещё не отрисована");
      }
      return row;
    });
    await user.click(within(pendingRow).getByRole("button", { name: "Отклонить" }));
    expect(screen.getByText(/Отклонить заявку Орлов Никита/)).toBeVisible();
    await user.click(screen.getAllByRole("button", { name: "Отклонить" }).at(-1)!);

    await waitFor(() => expect(rejectRequests).toHaveLength(1));
    expect(rejectRequests[0]!.csrf).toBe("csrf-admin-1");
  });

  it("disable: предупреждение о сеансах; LAST_ADMIN 409 показывает объяснение сервера", async () => {
    const user = userEvent.setup();
    meReturns(ADMIN_ACTIVE_ME_FIXTURE);
    const view = renderAdminApp("/admin/employees?state=active");
    const olgaRow = await waitFor(() => {
      const row = screen
        .getAllByRole("row")
        .find((candidate) => candidate.textContent?.includes("olga.admin"));
      if (row === undefined) {
        throw new Error("строка Ковалёвой ещё не отрисована");
      }
      return row;
    });

    const disableRequests = captureMut(
      "post",
      `${ADMIN_EMPLOYEES_URL}/${LAST_ADMIN_EMPLOYEE_FIXTURE.id}/disable`,
      () => ({
        code: "LAST_ADMIN",
        message: "Нельзя отключить последнего администратора",
        request_id: "msw-last-admin",
      }),
      409,
    );

    await user.click(within(olgaRow).getByRole("button", { name: "Отключить" }));
    expect(
      screen.getByText(/сеансы сотрудника будут немедленно завершены|ваши сеансы завершатся/i),
    ).toBeVisible();
    await user.click(screen.getAllByRole("button", { name: "Отключить" }).at(-1)!);

    await waitFor(() => expect(disableRequests).toHaveLength(1));
    await waitFor(() =>
      expect(screen.getByText("Нельзя отключить последнего администратора")).toBeVisible(),
    );
    expect(screen.getByText("Операция не выполнена")).toBeVisible();
    view.unmount();
  });

  it("reactivate для отключённого сотрудника", async () => {
    const user = userEvent.setup();
    meReturns(ADMIN_ACTIVE_ME_FIXTURE);
    renderAdminApp("/admin/employees?state=disabled");
    const veraRow = await waitFor(() => {
      const row = screen
        .getAllByRole("row")
        .find((candidate) => candidate.textContent?.includes("vera.disabled"));
      if (row === undefined) {
        throw new Error("строка Соколовой ещё не отрисована");
      }
      return row;
    });

    const reactivateRequests = captureMut(
      "post",
      `${ADMIN_EMPLOYEES_URL}/${DISABLED_EMPLOYEE_FIXTURE.id}/reactivate`,
      () => ({ ...DISABLED_EMPLOYEE_FIXTURE, state: "active" }),
    );

    await user.click(within(veraRow).getByRole("button", { name: "Вернуть" }));
    expect(screen.getByText(/Вернуть Соколова Вера/)).toBeVisible();
    await user.click(screen.getAllByRole("button", { name: "Вернуть" }).at(-1)!);

    await waitFor(() => expect(reactivateRequests).toHaveLength(1));
    expect(reactivateRequests[0]!.csrf).toBe("csrf-admin-1");
  });

  it("временный пароль: предзаполнен 16 символами, показывается один раз, поле чистится при закрытии", async () => {
    const user = userEvent.setup();
    meReturns(ADMIN_ACTIVE_ME_FIXTURE);
    renderAdminApp("/admin/employees?state=active");
    const irinaRow = await waitFor(() => {
      const row = screen
        .getAllByRole("row")
        .find((candidate) => candidate.textContent?.includes("irina.staff@example.test"));
      if (row === undefined) {
        throw new Error("строка Смирновой ещё не отрисована");
      }
      return row;
    });

    const resetRequests = captureMut(
      "post",
      `${ADMIN_EMPLOYEES_URL}/${ACTIVE_STAFF_EMPLOYEE_FIXTURE.id}/reset-password`,
      () => ({ message: "Пароль изменён. Сотруднику необходимо войти и сменить пароль" }),
    );

    await user.click(within(irinaRow).getByRole("button", { name: "Временный пароль" }));
    const input = (await screen.findByLabelText(/^Пароль/)) as HTMLInputElement;
    expect(input.value).toHaveLength(16);

    const typed = "Parol-Nadezhny-16";
    await user.clear(input);
    await user.type(input, typed);
    await user.click(screen.getByRole("button", { name: "Выдать пароль" }));

    await waitFor(() => expect(resetRequests).toHaveLength(1));
    expect(resetRequests[0]!.body).toEqual({ new_password: typed });
    expect(resetRequests[0]!.csrf).toBe("csrf-admin-1");
    expect(screen.getByText(typed)).toBeVisible();
    expect(screen.getByRole("button", { name: "Скопировать пароль" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Готово" }));
    expect(screen.queryByText(typed)).toBeNull();

    await user.click(within(irinaRow).getByRole("button", { name: "Временный пароль" }));
    const reopened = (await screen.findByLabelText(/^Пароль/)) as HTMLInputElement;
    expect(reopened.value).toHaveLength(16);
    expect(reopened.value).not.toBe(typed);
  });
});

describe("T10 журнал действий", () => {
  it("таблица с пагинацией и фильтром действия: параметры уходят в API", async () => {
    const user = userEvent.setup();
    const requests = captureGet(`${BASE}/api/v1/admin/audit`, () => ({
      items: AUDIT_EVENTS_ALL_FIXTURE.slice(0, 20),
      total: 45,
      page: 1,
      page_size: 20,
    }));
    meReturns(ADMIN_ACTIVE_ME_FIXTURE);
    renderAdminApp("/admin/audit");

    await screen.findByText("Всего: 45");
    expect(screen.getAllByRole("row")).toHaveLength(21);
    expect(new URL(requests[0]!).searchParams.get("page")).toBe("1");

    await user.selectOptions(screen.getByLabelText(/^Действие/), "approve");
    await waitFor(() => {
      expect(new URL(requests.at(-1)!).searchParams.get("action")).toBe("approve");
    });

    await user.click(screen.getByRole("button", { name: "Страница 2" }));
    await waitFor(() => {
      expect(new URL(requests.at(-1)!).searchParams.get("page")).toBe("2");
    });
  });
});

describe("Вакансии: доступ всем активным сотрудникам", () => {
  it("staff открывает /vacancies: список и переключение активности (PATCH с CSRF)", async () => {
    const user = userEvent.setup();
    meReturns(STAFF_ACTIVE_ME_FIXTURE);
    renderAdminApp("/vacancies");

    await screen.findByText("Лаборант / химик-лаборант");
    expect(screen.queryByRole("region", { name: "Приём анкет" })).toBeNull();
    const patchRequests = captureMut(
      "patch",
      `${BASE}/api/v1/vacancies/11111111-1111-4111-8111-111111111101`,
      () => ({ is_active: false }),
    );

    await user.click(screen.getAllByRole("button", { name: "Отключить" })[0]!);
    await waitFor(() => expect(patchRequests).toHaveLength(1));
    expect(patchRequests[0]!.body).toEqual({ is_active: false });
    expect(patchRequests[0]!.csrf).toBe("csrf-staff-1");
  });

  it("staff создаёт вакансию: слаг генерируется из названия, POST уходит с телом договора", async () => {
    const user = userEvent.setup();
    meReturns(STAFF_ACTIVE_ME_FIXTURE);
    renderAdminApp("/vacancies");
    await screen.findByText("Лаборант / химик-лаборант");

    const createRequests = captureMut(
      "post",
      `${BASE}/api/v1/vacancies`,
      () => ({
        id: "88888888-8888-4888-8888-888888888801",
        slug: "operator-line",
        title: "Оператор линии",
        dept: "Цех розлива",
        pay: "",
        schedule: "",
        icon: "can",
        is_active: true,
        sort: 0,
        created_at: "2026-10-24T12:00:00+03:00",
        updated_at: "2026-10-24T12:00:00+03:00",
      }),
      201,
    );

    await user.click(screen.getByRole("button", { name: "+ Добавить вакансию" }));
    await user.type(screen.getByLabelText(/^Название/), "Оператор линии");
    const slugValue = (screen.getByLabelText(/^Код \(слаг\)/) as HTMLInputElement).value;
    expect(slugValue).toMatch(/^[a-z0-9][a-z0-9-]*$/);

    await user.click(screen.getByRole("button", { name: "Добавить вакансию" }));
    await waitFor(() => expect(createRequests).toHaveLength(1));
    expect(createRequests[0]!.body).toMatchObject({
      title: "Оператор линии",
      slug: slugValue,
      icon: "can",
    });
    expect(createRequests[0]!.csrf).toBe("csrf-staff-1");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("kill switch виден только админу: состояние включено, подтверждение предупреждает про CLI", async () => {
    const user = userEvent.setup();
    meReturns(ADMIN_ACTIVE_ME_FIXTURE);
    renderAdminApp("/vacancies");
    await screen.findByText("Приём анкет");
    expect(await screen.findByText("Включён")).toBeVisible();

    const disableRequests = captureMut(
      "post",
      `${BASE}/api/v1/admin/intake/disable`,
      () => ({ message: "Приём анкет остановлен" }),
    );

    await user.click(screen.getByRole("button", { name: "Остановить приём" }));
    expect(screen.getByText(/только через CLI/i)).toBeVisible();
    await user.click(screen.getAllByRole("button", { name: "Остановить приём" }).at(-1)!);

    await waitFor(() => expect(disableRequests).toHaveLength(1));
    expect(disableRequests[0]!.csrf).toBe("csrf-admin-1");
  });

  it("kill switch уже выключен: кнопка заблокирована и объяснено почему", async () => {
    meReturns(ADMIN_ACTIVE_ME_FIXTURE);
    server.use(
      http.get(`${BASE}/api/v1/public/privacy`, () =>
        HttpResponse.json({ collection_enabled: false, revision: 3, notice: null, consent: null }),
      ),
    );
    renderAdminApp("/vacancies");

    await screen.findByText("Остановлен");
    expect(screen.getByText(/уже остановлен/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Остановить приём" })).toBeDisabled();
  });
});

describe("T10 права доступа", () => {
  it("staff видит «Вакансии» в навигации, но не видит раздел «Админ»; admin видит оба", async () => {
    meReturns(STAFF_ACTIVE_ME_FIXTURE);
    const staffView = render(
      <AppProviders queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <AuthProvider>
            <StaffShell>
              <p>Контент</p>
            </StaffShell>
          </AuthProvider>
        </MemoryRouter>
      </AppProviders>,
    );
    await screen.findByText("Кандидаты");
    expect(screen.getByRole("link", { name: "Вакансии" })).toHaveAttribute("href", "/vacancies");
    expect(screen.queryByRole("link", { name: "Админ" })).toBeNull();
    staffView.unmount();

    meReturns(ADMIN_ACTIVE_ME_FIXTURE);
    render(
      <AppProviders queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <AuthProvider>
            <StaffShell>
              <p>Контент</p>
            </StaffShell>
          </AuthProvider>
        </MemoryRouter>
      </AppProviders>,
    );
    await screen.findByRole("link", { name: "Админ" });
  });

  it("staff по прямой ссылке /admin/employees получает «Недостаточно прав»", async () => {
    meReturns(STAFF_ACTIVE_ME_FIXTURE);
    render(
      <AppProviders queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/admin/employees"]}>
          <AuthProvider>
            <Routes>
              <Route element={<StaffRoute />}>
                <Route path="/candidates" element={<p>Реестр</p>} />
              </Route>
              <Route element={<AdminRoute />}>
                <Route path="/admin/employees" element={<EmployeesPage />} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </AppProviders>,
    );
    await screen.findByText("Недостаточно прав");
  });
});
