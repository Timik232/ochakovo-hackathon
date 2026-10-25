import { QueryClient } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "../src/app/providers";
import { AuthProvider } from "../src/features/auth/AuthProvider";
import { StaffRoute } from "../src/features/auth/RequireAuth";
import { CandidatesPage } from "../src/features/candidates/CandidatesPage";
import { CandidateDetailPage } from "../src/features/candidates/CandidateDetailPage";
import { CandidateFormPage } from "../src/features/candidates/CandidateFormPage";
import { server } from "./msw-server";
import {
  ADMIN_ACTIVE_ME_FIXTURE,
  CANDIDATE_FIXTURE,
  CANDIDATES_ALL_FIXTURE,
  candidatesPage,
  COMMENTS_PAGE_FIXTURE,
  STAFF_ACTIVE_ME_FIXTURE,
} from "./msw-handlers";

const LIST_URL = "http://localhost/api/v1/candidates";
const DETAIL_URL = `http://localhost/api/v1/candidates/${CANDIDATE_FIXTURE.id}`;
const COMMENTS_URL = `http://localhost/api/v1/candidates/${CANDIDATE_FIXTURE.id}/comments`;
const CREATE_URL = "http://localhost/api/v1/candidates";
const PATCH_URL = DETAIL_URL;
const BULK_URL = "http://localhost/api/v1/candidates/bulk";
const EXPORT_URL = "http://localhost/api/v1/candidates/export.csv";

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

function renderApp(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const view = render(
    <AppProviders queryClient={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AuthProvider>
          <Routes>
            <Route element={<StaffRoute />}>
              <Route path="/candidates" element={<CandidatesPage />} />
              <Route path="/candidates/new" element={<CandidateFormPage mode="create" />} />
              <Route path="/candidates/:id" element={<CandidateDetailPage />} />
              <Route path="/candidates/:id/edit" element={<CandidateFormPage mode="edit" />} />
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

function meReturns(fixture: Record<string, unknown> | null) {
  server.use(
    http.get(
      "http://localhost/api/v1/auth/me",
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

function captureGet(url: string, respond: () => unknown = () => null) {
  const captured: string[] = [];
  server.use(
    http.get(url, ({ request }) => {
      captured.push(request.url);
      const body = respond();
      if (body === null) {
        return undefined;
      }
      return body instanceof Response ? body : HttpResponse.json(body);
    }),
  );
  return captured;
}

interface CapturedRequest {
  url: string;
  headers: Record<string, string | null>;
  body: unknown;
}

function captureMut(
  method: "post" | "patch" | "delete",
  url: string,
  respond: () => Response | Promise<Response>,
) {
  const captured: CapturedRequest[] = [];
  server.use(
    http[method](url, async ({ request }) => {
      captured.push({
        url: request.url,
        headers: {
          csrf: request.headers.get("X-CSRF-Token"),
          ifMatch: request.headers.get("If-Match"),
        },
        body: request.method === "DELETE" ? null : await request.json(),
      });
      return respond();
    }),
  );
  return captured;
}

function isCountCall(url: URL): boolean {
  const params = url.searchParams;
  return (
    (params.get("archived") === "0" || params.get("archived") === "1") &&
    !params.has("q") &&
    !params.has("status[]") &&
    !params.has("vacancy_id[]") &&
    !params.has("hot") &&
    params.get("sort") === "created_at" &&
    params.get("direction") === "desc" &&
    params.get("page") === "1" &&
    params.get("page_size") === "20"
  );
}

function captureList() {
  const captured: string[] = [];
  let mountCountsSkipped = 0;
  server.use(
    http.get(LIST_URL, ({ request }) => {
      const url = new URL(request.url);
      if (isCountCall(url) && mountCountsSkipped < 2) {
        mountCountsSkipped += 1;
      } else {
        captured.push(request.url);
      }
      const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
      return HttpResponse.json(
        candidatesPage(
          CANDIDATES_ALL_FIXTURE.slice((page - 1) * 20, page * 20),
          CANDIDATES_ALL_FIXTURE.length,
          page,
        ),
      );
    }),
  );
  return captured;
}

async function rowFor(name: string) {
  const rows = await screen.findAllByRole("link", { name: new RegExp(name) }, { timeout: 4000 });
  return rows[0]!;
}

beforeAll(() => {
  (URL as unknown as { createObjectURL: () => string }).createObjectURL = vi.fn(() => "blob:mock");
  (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = vi.fn();
});

beforeEach(() => {
  meReturns(STAFF_ACTIVE_ME_FIXTURE);
});

describe("Реестр кандидатов: таблица и URL-state", () => {
  it("рендерит колонки, строки, тотал и дату добавления в формате МСК", async () => {
    renderApp("/candidates");
    expect(await screen.findByRole("columnheader", { name: "ФИО" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Вакансия" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Телефон" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Возраст" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Этап" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Ответственный" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Дата добавления" })).toBeInTheDocument();
    expect(await rowFor("Тестов-00")).toBeInTheDocument();
    expect(screen.getAllByText("+79990001122").length).toBeGreaterThan(0);
    expect(screen.getAllByText("20.10.2026 11:30 МСК").length).toBeGreaterThan(0);
    expect(await screen.findByText("Найдено: 45")).toBeInTheDocument();
  });

  it("hot-кандидат помечен звездой, этап — текстовый бейдж", async () => {
    renderApp("/candidates");
    expect((await screen.findAllByLabelText("Горячий кандидат")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Анкета").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Новый").length).toBeGreaterThan(0);
  });

  it("поиск debounce переносит q в URL и в API", async () => {
    const user = userEvent.setup();
    const captured = captureList();
    renderApp("/candidates");
    await rowFor("Тестов-00");
    await user.type(screen.getByLabelText("Поиск"), "семен");
    await waitFor(
      () => {
        expect(location()).toBe("/candidates?q=%D1%81%D0%B5%D0%BC%D0%B5%D0%BD");
      },
      { timeout: 3000 },
    );
    await waitFor(() => {
      const last = captured.at(-1);
      expect(last && new URL(last).searchParams.get("q")).toBe("семен");
    });
  });

  it("чип этапа пишет status в URL и status[] в API, сброс страницы", async () => {
    const user = userEvent.setup();
    const captured = captureList();
    renderApp("/candidates?q=%D1%81%D0%B5%D0%BC%D0%B5%D0%BD&page=2");
    await rowFor("Тестов-20");
    await user.click(screen.getByRole("button", { name: "Анкета" }));
    await waitFor(() => expect(location()).toBe("/candidates?q=%D1%81%D0%B5%D0%BC%D0%B5%D0%BD&status=application"));
    await waitFor(() => {
      const last = captured.at(-1);
      expect(last && new URL(last).searchParams.getAll("status[]")).toEqual(["application"]);
      expect(last && new URL(last).searchParams.get("page")).toBe("1");
    });
  });

  it("чип «Горячие» и выбор вакансии пишутся в URL", async () => {
    const user = userEvent.setup();
    const captured = captureList();
    renderApp("/candidates");
    await rowFor("Тестов-00");
    await user.click(screen.getByRole("button", { name: "Горячие" }));
    await waitFor(() => expect(location()).toBe("/candidates?hot=1"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Горячие" })).toHaveAttribute("aria-pressed", "true"),
    );
    await user.selectOptions(
      screen.getByLabelText("Вакансия"),
      "11111111-1111-4111-8111-111111111102",
    );
    await waitFor(() => {
      const url = new URL(`http://x${location()}`);
      expect(url.searchParams.get("hot")).toBe("1");
      expect(url.searchParams.getAll("vacancy_id")).toEqual([
        "11111111-1111-4111-8111-111111111102",
      ]);
    });
    await waitFor(() => {
      const last = captured.at(-1);
      expect(last && new URL(last).searchParams.get("hot")).toBe("true");
      expect(last && new URL(last).searchParams.getAll("vacancy_id[]")).toEqual([
        "11111111-1111-4111-8111-111111111102",
      ]);
    });
  });

  it("табы «Активные/Архив» показывают счётчики total: page_size=20, без 422", async () => {
    const candidateGets: string[] = [];
    const onRequest = ({ request }: { request: Request }) => {
      const url = new URL(request.url);
      if (url.pathname === "/api/v1/candidates") {
        candidateGets.push(request.url);
      }
    };
    server.events.on("request:start", onRequest);
    renderApp("/candidates");
    const active = await screen.findByRole("tab", { name: /Активные/ });
    await waitFor(() => expect(active).toHaveTextContent(/45/));
    expect(active).toHaveAttribute("aria-selected", "true");
    const archive = screen.getByRole("tab", { name: /Архив/ });
    await waitFor(() => expect(archive).toHaveTextContent(/3/));
    expect(archive).toHaveAttribute("aria-selected", "false");
    server.events.removeListener("request:start", onRequest);
    const countUrls = candidateGets.map((raw) => new URL(raw)).filter(isCountCall);
    expect(countUrls).toHaveLength(2);
    for (const url of countUrls) {
      expect(url.searchParams.get("page_size")).toBe("20");
    }
    for (const raw of candidateGets) {
      expect([20, 50, 100]).toContain(Number(new URL(raw).searchParams.get("page_size")));
    }
  });

  it("переключатель Архив/Активные пишет archived в URL и API", async () => {
    const user = userEvent.setup();
    const captured = captureList();
    renderApp("/candidates");
    await rowFor("Тестов-00");
    await user.click(screen.getByRole("tab", { name: /Архив/ }));
    await waitFor(() => expect(location()).toBe("/candidates?archived=1"));
    await waitFor(() => {
      const last = captured.at(-1);
      expect(last && new URL(last).searchParams.get("archived")).toBe("1");
    });
    expect(screen.getByRole("tab", { name: /Архив/ })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: /Активные/ }));
    await waitFor(() => expect(location()).toBe("/candidates"));
  });

  it("сортировка пишет sort=field.direction и sort/direction в API", async () => {
    const user = userEvent.setup();
    const captured = captureList();
    renderApp("/candidates");
    await rowFor("Тестов-00");
    await user.selectOptions(screen.getByLabelText("Сортировка"), "last_name.asc");
    await waitFor(() => expect(location()).toBe("/candidates?sort=last_name.asc"));
    await waitFor(() => {
      const last = captured.at(-1);
      expect(last && new URL(last).searchParams.get("sort")).toBe("last_name");
      expect(last && new URL(last).searchParams.get("direction")).toBe("asc");
    });
  });

  it("пагинация: page=2 в URL и API, без дублей строк", async () => {
    const user = userEvent.setup();
    const captured = captureList();
    renderApp("/candidates");
    await rowFor("Тестов-00");
    await user.click(screen.getByRole("button", { name: "Страница 2" }));
    await waitFor(() => expect(location()).toBe("/candidates?page=2"));
    await waitFor(() => {
      const last = captured.at(-1);
      expect(last && new URL(last).searchParams.get("page")).toBe("2");
    });
    expect(await rowFor("Тестов-20")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Тестов-00/ })).not.toBeInTheDocument();
  });

  it("deep link восстанавливает все контролы из URL", async () => {
    const captured = captureList();
    renderApp(
      "/candidates?q=%D1%81%D0%B5%D0%BC%D0%B5%D0%BD&status=review&hot=1&archived=1&sort=last_name.asc&page=2",
    );
    await waitFor(() => {
      const last = captured.at(-1);
      expect(last).toBeDefined();
    });
    expect((screen.getByLabelText("Поиск") as HTMLInputElement).value).toBe("семен");
    expect(screen.getByRole("button", { name: "Рассматриваем" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Горячие" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("tab", { name: /Архив/ })).toHaveAttribute("aria-selected", "true");
    expect((screen.getByLabelText("Сортировка") as HTMLSelectElement).value).toBe("last_name.asc");
    const last = captured.at(-1);
    const query = new URL(last!);
    expect(query.searchParams.get("q")).toBe("семен");
    expect(query.searchParams.getAll("status[]")).toEqual(["review"]);
    expect(query.searchParams.get("hot")).toBe("true");
    expect(query.searchParams.get("archived")).toBe("1");
    expect(query.searchParams.get("sort")).toBe("last_name");
    expect(query.searchParams.get("direction")).toBe("asc");
    expect(query.searchParams.get("page")).toBe("2");
  });

  it("«Сбросить фильтры» возвращает голый /candidates", async () => {
    const user = userEvent.setup();
    renderApp("/candidates?q=%D1%81%D0%B5%D0%BC%D0%B5%D0%BD&status=review&hot=1&page=2");
    await rowFor("Тестов-20");
    await user.click(screen.getAllByRole("button", { name: "Сбросить фильтры" })[0]!);
    await waitFor(() => expect(location()).toBe("/candidates"));
    expect((screen.getByLabelText("Поиск") as HTMLInputElement).value).toBe("");
  });

  it("back/forward восстанавливает предыдущее состояние фильтров", async () => {
    const user = userEvent.setup();
    renderApp("/candidates");
    await rowFor("Тестов-00");
    await user.click(screen.getByRole("button", { name: "Анкета" }));
    await waitFor(() => expect(location()).toBe("/candidates?status=application"));
    await user.click(screen.getByRole("tab", { name: /Архив/ }));
    await waitFor(() => expect(location()).toBe("/candidates?status=application&archived=1"));
    (window as { __testNavigate?: (to: string | number) => void }).__testNavigate?.(-1);
    await waitFor(() => expect(location()).toBe("/candidates?status=application"));
    expect(screen.getByRole("button", { name: "Анкета" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("tab", { name: /Архив/ })).toHaveAttribute("aria-selected", "false");
  });

  it("пустой результат — EmptyState со сбросом фильтров", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(LIST_URL, () =>
        HttpResponse.json(candidatesPage([], 0, 1)),
      ),
    );
    renderApp("/candidates?q=%D1%81%D0%B5%D0%BC%D0%B5%D0%BD");
    expect(await screen.findByText("Кандидатов пока нет")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Сбросить фильтры" })[0]!);
    await waitFor(() => expect(location()).toBe("/candidates"));
  });

  it("архивный кандидат показывает бейдж «В архиве»", async () => {
    server.use(
      http.get(LIST_URL, () =>
        HttpResponse.json(
          candidatesPage(
            [{ ...CANDIDATE_FIXTURE, archived_at: "2026-10-21T00:00:00+03:00" }],
            1,
            1,
          ),
        ),
      ),
    );
    renderApp("/candidates");
    expect((await screen.findAllByText("В архиве")).length).toBeGreaterThan(0);
  });

  it("мобильные карточки содержат дату и телефон", async () => {
    renderApp("/candidates");
    const cards = await screen.findByRole("list", { name: "Кандидаты" });
    expect(cards).toBeInTheDocument();
    expect(screen.getAllByText("20.10.2026 11:30 МСК").length).toBeGreaterThan(0);
  });
});

describe("Инструменты реестра", () => {
  it("CSV выгружается с текущими фильтрами, без пагинации", async () => {
    const user = userEvent.setup();
    const captured = captureGet(EXPORT_URL, () => new Response("x", { status: 200 }));
    renderApp("/candidates?q=%D1%81%D0%B5%D0%BC%D0%B5%D0%BD&status=review&page=2");
    await rowFor("Тестов-20");
    await user.click(screen.getByRole("button", { name: "Скачать CSV" }));
    await waitFor(() => expect(captured.length).toBe(1));
    const query = new URL(captured[0]!);
    expect(query.searchParams.get("q")).toBe("семен");
    expect(query.searchParams.getAll("status[]")).toEqual(["review"]);
    expect(query.searchParams.get("page")).toBeNull();
    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalled();
    });
  });

  it("QR-диалог показывает ссылку на /apply и подсказку", async () => {
    const user = userEvent.setup();
    renderApp("/candidates");
    await rowFor("Тестов-00");
    await user.click(screen.getByRole("button", { name: "QR-код анкеты" }));
    expect(
      await screen.findByText(
        "Покажи кандидату — пусть наведёт камеру телефона и заполнит анкету сам.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/\/apply$/)).toBeInTheDocument();
  });

  it("массовая архивация: выбор, подтверждение, POST /bulk с ids и action", async () => {
    const user = userEvent.setup();
    const captured = captureMut("post", BULK_URL, () =>
      HttpResponse.json({ updated: 2 }, { status: 200 }),
    );
    const capturedList = captureList();
    renderApp("/candidates");
    await rowFor("Тестов-00");
    await user.click(screen.getAllByLabelText(/Выбрать Тестов-00/)[0]!);
    await user.click(screen.getAllByLabelText(/Выбрать Тестов-01/)[0]!);
    expect(screen.getByText("Выбрано: 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "В архив" }));
    expect(screen.getByText("Перенести в архив 2 выбранных кандидатов?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));
    await waitFor(() => expect(captured.length).toBe(1));
    expect(captured[0]?.body).toEqual({
      ids: [
        "55555555-5555-4555-8555-5555555500",
        "55555555-5555-4555-8555-5555555501",
      ],
      action: "archive",
    });
    expect(captured[0]?.headers.csrf).toBe("csrf-staff-1");
    await waitFor(() => expect(screen.queryByText("Выбрано: 2")).not.toBeInTheDocument());
    expect(capturedList.length).toBeGreaterThan(1);
  });

  it("массовая смена этапа передаёт stage", async () => {
    const user = userEvent.setup();
    const captured = captureMut("post", BULK_URL, () =>
      HttpResponse.json({ updated: 1 }, { status: 200 }),
    );
    renderApp("/candidates");
    await rowFor("Тестов-00");
    await user.click(screen.getAllByLabelText(/Выбрать Тестов-00/)[0]!);
    await user.selectOptions(screen.getByLabelText("Изменить этап выбранным"), "interview");
    expect(
      screen.getByText("Изменить этап на «Собеседование» для 1 выбранных кандидатов?"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));
    await waitFor(() => expect(captured.length).toBe(1));
    expect(captured[0]?.body).toEqual({
      ids: ["55555555-5555-4555-8555-5555555500"],
      action: "stage",
      stage: "interview",
    });
  });

  it("инлайн-смена этапа в строке: оптимистично и POST /bulk без version", async () => {
    const user = userEvent.setup();
    const captured = captureMut("post", BULK_URL, async () => {
      await delay(300);
      return HttpResponse.json({ updated: 1 }, { status: 200 });
    });
    renderApp("/candidates");
    const select = (await screen.findAllByLabelText(/Этап — Тестов-00 Тест/))[0]! as HTMLSelectElement;
    expect(select.value).toBe("application");
    await user.selectOptions(select, "interview");
    await waitFor(() =>
      expect((screen.getAllByLabelText(/Этап — Тестов-00 Тест/)[0] as HTMLSelectElement).value).toBe(
        "interview",
      ),
    );
    await waitFor(() => expect(captured.length).toBe(1));
    expect(captured[0]?.body).toEqual({
      ids: ["55555555-5555-4555-8555-5555555500"],
      action: "stage",
      stage: "interview",
    });
    expect(captured[0]?.headers.ifMatch).toBeNull();
  });

  it("ошибка инлайн-смены этапа откатывает значение и показывает алерт", async () => {
    const user = userEvent.setup();
    captureMut("post", BULK_URL, () =>
      HttpResponse.json(
        { code: "SERVICE_UNAVAILABLE", message: "Сервер недоступен" },
        { status: 503 },
      ),
    );
    renderApp("/candidates");
    const select = (await screen.findAllByLabelText(/Этап — Тестов-00 Тест/))[0]! as HTMLSelectElement;
    await user.selectOptions(select, "hired");
    expect(await screen.findByText("Этап не изменился")).toBeInTheDocument();
    expect(screen.getByText("Сервер недоступен")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        (screen.getAllByLabelText(/Этап — Тестов-00 Тест/)[0] as HTMLSelectElement).value,
      ).toBe("application");
    });
  });

  it("в bulk-панели нет удаления", async () => {
    const user = userEvent.setup();
    renderApp("/candidates");
    await rowFor("Тестов-00");
    await user.click(screen.getAllByLabelText(/Выбрать Тестов-00/)[0]!);
    expect(screen.queryByRole("button", { name: /удалить/i })).not.toBeInTheDocument();
  });
});

describe("Карточка кандидата", () => {
  it("показывает все разделы, звезду, оценку, МСК-даты и ответственного", async () => {
    renderApp(`/candidates/${CANDIDATE_FIXTURE.id}`);
    expect(await screen.findByText("Семёнов Пётр Ильич")).toBeInTheDocument();
    expect(screen.getByLabelText("Горячий кандидат")).toBeInTheDocument();
    expect(screen.getByText("★★★★☆")).toBeInTheDocument();
    expect(screen.getAllByText("Собеседование").length).toBeGreaterThan(0);
    expect(screen.getByText("Дата добавления:")).toBeInTheDocument();
    expect(screen.getAllByText("20.10.2026 11:30 МСК").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Смирнова Ирина").length).toBeGreaterThan(0);
    expect(screen.getByText("По телефону")).toBeInTheDocument();
    expect(screen.getByText("Согласие кандидата")).toBeInTheDocument();
    expect(screen.getByText("Версия карточки")).toBeInTheDocument();
    expect(screen.getByText("Позвонить после практики")).toBeInTheDocument();
  });

  it("московская полночь на границе UTC-дня: 21:30Z → 00:30 следующего дня", async () => {
    server.use(
      http.get(DETAIL_URL, () =>
        HttpResponse.json({
          ...CANDIDATE_FIXTURE,
          created_at: "2026-10-20T21:30:00Z",
        }),
      ),
    );
    renderApp(`/candidates/${CANDIDATE_FIXTURE.id}`);
    expect((await screen.findAllByText("21.10.2026 00:30 МСК")).length).toBeGreaterThan(0);
  });

  it("duplicate_contact_count > 0 — неблокирующее предупреждение", async () => {
    server.use(
      http.get(DETAIL_URL, () =>
        HttpResponse.json({ ...CANDIDATE_FIXTURE, duplicate_contact_count: 2 }),
      ),
    );
    renderApp(`/candidates/${CANDIDATE_FIXTURE.id}`);
    expect(await screen.findByText("Похожий контакт уже есть в базе")).toBeInTheDocument();
    expect(screen.getByText(/2 кандидатов совпадает телефон или Telegram/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Редактировать" })).toBeInTheDocument();
  });

  it("комментарий: оптимистичный append + отдельный POST с CSRF", async () => {
    const user = userEvent.setup();
    let added = false;
    server.use(
      http.get(COMMENTS_URL, () =>
        HttpResponse.json(
          added
            ? {
                items: [
                  ...COMMENTS_PAGE_FIXTURE.items,
                  {
                    id: "66666666-6666-4666-8666-666666666602",
                    candidate_id: CANDIDATE_FIXTURE.id,
                    created_by: "33333333-3333-4333-8333-333333333301",
                    created_at: "2026-10-22T10:00:00+03:00",
                    body: "Проверил документы",
                    author_name: "Смирнова Ирина",
                  },
                ],
                total: 2,
                page: 1,
                page_size: 50,
              }
            : COMMENTS_PAGE_FIXTURE,
        ),
      ),
    );
    const captured = captureMut("post", COMMENTS_URL, () => {
      added = true;
      return HttpResponse.json(
        {
          id: "66666666-6666-4666-8666-666666666602",
          candidate_id: CANDIDATE_FIXTURE.id,
          created_by: "33333333-3333-4333-8333-333333333301",
          created_at: "2026-10-22T10:00:00+03:00",
          body: "Проверил документы",
          author_name: "Смирнова Ирина",
        },
        { status: 201 },
      );
    });
    renderApp(`/candidates/${CANDIDATE_FIXTURE.id}`);
    expect(await screen.findByText("Договорились созвониться после практики.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Новый комментарий"), "Проверил документы");
    await user.click(screen.getByRole("button", { name: "Добавить комментарий" }));
    await waitFor(() => expect(captured.length).toBe(1));
    expect(captured[0]?.body).toEqual({ body: "Проверил документы" });
    expect(captured[0]?.headers.csrf).toBe("csrf-staff-1");
    expect(await screen.findByText("Комментарии · 2")).toBeInTheDocument();
    expect(screen.getByText("Проверил документы")).toBeInTheDocument();
    expect(screen.getByDisplayValue("")).toBeInTheDocument();
  }, 20000);

  it("ошибка комментария откатывает оптимистичную запись", async () => {
    const user = userEvent.setup();
    captureMut("post", COMMENTS_URL, () =>
      HttpResponse.json({ code: "SERVICE_UNAVAILABLE", message: "Сервер недоступен" }, { status: 503 }),
    );
    renderApp(`/candidates/${CANDIDATE_FIXTURE.id}`);
    await screen.findByText("Договорились созвониться после практики.");
    await user.type(screen.getByLabelText("Новый комментарий"), "Проверил документы");
    await user.click(screen.getByRole("button", { name: "Добавить комментарий" }));
    expect(await screen.findByText("Комментарий не отправился")).toBeInTheDocument();
    expect(
      screen.queryByText("Проверил документы", { selector: "p" }),
    ).not.toBeInTheDocument();
    expect(await screen.findByText("Комментарии · 1")).toBeInTheDocument();
  });

  it("staff не видит кнопку удаления", async () => {
    renderApp(`/candidates/${CANDIDATE_FIXTURE.id}`);
    await screen.findByText("Семёнов Пётр Ильич");
    expect(screen.queryByRole("button", { name: "Удалить карточку" })).not.toBeInTheDocument();
  });

  it("admin удаляет с подтверждением по фамилии и If-Match", async () => {
    meReturns(ADMIN_ACTIVE_ME_FIXTURE);
    const user = userEvent.setup();
    const captured = captureMut("delete", DETAIL_URL, () => new HttpResponse(null, { status: 204 }));
    renderApp(`/candidates/${CANDIDATE_FIXTURE.id}`);
    await screen.findByText("Семёнов Пётр Ильич");
    await user.click(screen.getByRole("button", { name: "Удалить карточку" }));
    const confirm = screen.getByRole("button", { name: "Удалить навсегда" });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText(/Для подтверждения введите фамилию/), "Семёнов");
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    await waitFor(() => expect(captured.length).toBe(1));
    expect(captured[0]?.headers.ifMatch).toBe('"3"');
    expect(captured[0]?.headers.csrf).toBe("csrf-admin-1");
    await waitFor(() => expect(location()).toBe("/candidates"));
  }, 20000);

  it("409 при удалении не удаляет карточку и показывает ошибку", async () => {
    meReturns(ADMIN_ACTIVE_ME_FIXTURE);
    const user = userEvent.setup();
    captureMut("delete", DETAIL_URL, () =>
      HttpResponse.json(
        { code: "VERSION_CONFLICT", message: "Карточка уже изменена. Загрузи актуальную версию" },
        { status: 409 },
      ),
    );
    renderApp(`/candidates/${CANDIDATE_FIXTURE.id}`);
    await screen.findByText("Семёнов Пётр Ильич");
    await user.click(screen.getByRole("button", { name: "Удалить карточку" }));
    await user.type(screen.getByLabelText(/Для подтверждения введите фамилию/), "Семёнов");
    await user.click(screen.getByRole("button", { name: "Удалить навсегда" }));
    expect(await screen.findByText("Не удалось удалить")).toBeInTheDocument();
    expect(screen.getByText("Карточка уже изменена. Загрузи актуальную версию")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Удалить навсегда" })).toBeInTheDocument();
  });
});

describe("Форма нового кандидата", () => {
  async function fillMinimum(user: User) {
    await user.type(screen.getByLabelText(/^Фамилия/), "Арбузов");
    await user.type(screen.getByLabelText(/^Имя/), "Георгий");
    await user.type(screen.getByLabelText(/^Телефон/), "+7 999 555 66 77");
  }

  it("обязательные поля: пустой сабмит даёт ошибки валидации без запроса", async () => {
    const user = userEvent.setup();
    const captured = captureMut("post", CREATE_URL, () =>
      HttpResponse.json(CANDIDATE_FIXTURE, { status: 201 }),
    );
    renderApp("/candidates/new");
    await screen.findByText("Новый кандидат");
    await user.click(screen.getByRole("button", { name: "Добавить кандидата" }));
    expect(await screen.findByText("Укажите фамилию")).toBeInTheDocument();
    expect(screen.getByText("Укажите имя")).toBeInTheDocument();
    expect(screen.getByText("Введите телефон в формате +7…")).toBeInTheDocument();
    expect(captured.length).toBe(0);
  });

  it("успешное создание: E.164, source, basis; редирект на карточку", async () => {
    const user = userEvent.setup();
    const captured = captureMut("post", CREATE_URL, () =>
      HttpResponse.json({ ...CANDIDATE_FIXTURE, id: "77777777-7777-4777-8777-777777777701" }, { status: 201 }),
    );
    renderApp("/candidates/new");
    await screen.findByText("Новый кандидат");
    await fillMinimum(user);
    await user.selectOptions(screen.getByLabelText(/^Этап/), "review");
    await user.click(screen.getByRole("button", { name: "Добавить кандидата" }));
    await waitFor(() => expect(captured.length).toBe(1), { timeout: 5000 });
    const body = captured[0]?.body as Record<string, unknown>;
    expect(body.first_name).toBe("Георгий");
    expect(body.last_name).toBe("Арбузов");
    expect(body.phone).toBe("+79995556677");
    expect(body.status).toBe("review");
    expect(body.source).toBe("phone");
    expect(body.processing_basis).toBe("candidate_consent");
    expect(captured[0]?.headers.csrf).toBe("csrf-staff-1");
    await waitFor(() =>
      expect(location()).toBe("/candidates/77777777-7777-4777-8777-777777777701"),
    );
  }, 20000);

  it("оценка — интерактивные звёзды: клик ставит 4, повторный снимает", async () => {
    const user = userEvent.setup();
    const captured = captureMut("post", CREATE_URL, () =>
      HttpResponse.json({ ...CANDIDATE_FIXTURE, id: "77777777-7777-4777-8777-777777777702" }, { status: 201 }),
    );
    renderApp("/candidates/new");
    await screen.findByText("Новый кандидат");
    await fillMinimum(user);
    const fourth = screen.getByRole("radio", { name: "Оценка 4 из 5" });
    await user.click(fourth);
    expect(fourth).toBeChecked();
    await user.click(fourth);
    expect(screen.getByRole("radio", { name: "Оценка 4 из 5" })).not.toBeChecked();
    await user.click(fourth);
    expect(screen.getByRole("radio", { name: "Оценка 4 из 5" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Добавить кандидата" }));
    await waitFor(() => expect(captured.length).toBe(1), { timeout: 5000 });
    expect((captured[0]?.body as Record<string, unknown>).rating).toBe(4);
  }, 20000);

  it("дата начала в прошлом блокирует создание", async () => {
    const user = userEvent.setup();
    renderApp("/candidates/new");
    await screen.findByText("Новый кандидат");
    await fillMinimum(user);
    await user.type(screen.getByLabelText(/^Готов начать с/), "2020-01-01");
    await user.click(screen.getByRole("button", { name: "Добавить кандидата" }));
    expect(
      await screen.findByText("Дата начала работы не может быть в прошлом"),
    ).toBeInTheDocument();
  });

  it("иное основание обработки требует пояснения", async () => {
    const user = userEvent.setup();
    renderApp("/candidates/new");
    await screen.findByText("Новый кандидат");
    await fillMinimum(user);
    await user.selectOptions(
      screen.getByLabelText(/^Основание/),
      "other_documented_basis",
    );
    await user.click(screen.getByRole("button", { name: "Добавить кандидата" }));
    expect(await screen.findByText("Опишите документальное основание обработки")).toBeInTheDocument();
  });
});

describe("Форма правки и конфликт 409", () => {
  it("гидрирует поля карточки и отправляет PATCH с текущей версией", async () => {
    const user = userEvent.setup();
    const captured = captureMut("patch", PATCH_URL, () =>
      HttpResponse.json(CANDIDATE_FIXTURE, { status: 200 }),
    );
    renderApp(`/candidates/${CANDIDATE_FIXTURE.id}/edit`);
    const department = await screen.findByLabelText(/^Подразделение/);
    expect((department as HTMLInputElement).value).toBe("Лаборатория");
    expect((screen.getByLabelText(/^Телефон/) as HTMLInputElement).value).not.toBe("");
    await user.type(department, "-2");
    await user.click(screen.getByRole("button", { name: "Сохранить изменения" }));
    await waitFor(() => expect(captured.length).toBe(1), { timeout: 5000 });
    const body = captured[0]?.body as Record<string, unknown>;
    expect(body.version).toBe(3);
    expect(body.department).toBe("Лаборатория-2");
    expect(body.source).toBeUndefined();
    expect(captured[0]?.headers.csrf).toBe("csrf-staff-1");
    await waitFor(() => expect(location()).toBe(`/candidates/${CANDIDATE_FIXTURE.id}`));
  }, 20000);

  it("409 сохраняет черновик в памяти и предлагает загрузить версию", async () => {
    const user = userEvent.setup();
    captureMut("patch", PATCH_URL, () =>
      HttpResponse.json(
        { code: "VERSION_CONFLICT", message: "Карточка уже изменена. Загрузи актуальную версию" },
        { status: 409 },
      ),
    );
    renderApp(`/candidates/${CANDIDATE_FIXTURE.id}/edit`);
    const department = await screen.findByLabelText(/^Подразделение/);
    await user.clear(department);
    await user.type(department, "Цех розлива-2");
    await user.click(screen.getByRole("button", { name: "Сохранить изменения" }));
    expect(await screen.findByText("Карточка изменилась на сервере")).toBeInTheDocument();
    expect(
      screen.getByText(/Карточку изменил другой сотрудник после того, как вы её открыли/),
    ).toBeInTheDocument();
    expect((screen.getByLabelText(/^Подразделение/) as HTMLInputElement).value).toBe(
      "Цех розлива-2",
    );
    expect(
      screen.getByRole("button", { name: "Загрузить актуальную версию" }),
    ).toBeInTheDocument();
  }, 20000);

  it("после загрузки актуальной версии черновик не затирается", async () => {
    const user = userEvent.setup();
    captureMut("patch", PATCH_URL, () =>
      HttpResponse.json(
        { code: "VERSION_CONFLICT", message: "Карточка уже изменена" },
        { status: 409 },
      ),
    );
    renderApp(`/candidates/${CANDIDATE_FIXTURE.id}/edit`);
    const department = await screen.findByLabelText(/^Подразделение/);
    await user.clear(department);
    await user.type(department, "Цех розлива-2");
    await user.click(screen.getByRole("button", { name: "Сохранить изменения" }));
    await screen.findByText("Карточка изменилась на сервере");
    await user.click(screen.getByRole("button", { name: "Загрузить актуальную версию" }));
    expect(await screen.findByText(/Актуальная версия карточки загружена/)).toBeInTheDocument();
    expect((screen.getByLabelText(/^Подразделение/) as HTMLInputElement).value).toBe(
      "Цех розлива-2",
    );
  }, 20000);
});
