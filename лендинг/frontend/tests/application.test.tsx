import { QueryClient } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { AppProviders } from "../src/app/providers";
import { ApplyPage } from "../src/features/application/ApplyPage";
import { PrivacyPage } from "../src/features/application/PrivacyPage";
import { SuccessPage } from "../src/features/application/SuccessPage";
import { RootPage } from "../src/pages/RootPage";
import { server } from "./msw-server";
import {
  PUBLIC_PRIVACY_ACTIVE_FIXTURE,
  PUBLIC_VACANCIES_FIXTURE,
} from "./msw-handlers";

const APPLICATIONS_URL = "http://localhost/api/v1/public/applications";
const PRIVACY_URL = "http://localhost/api/v1/public/privacy";
const VACANCIES_URL = "http://localhost/api/v1/public/vacancies";
const EVIDENCE_DIR = "/DATA/AppData/.sisyphus/evidence/ochakovo";

const ROZLIV = PUBLIC_VACANCIES_FIXTURE[1];
type User = ReturnType<typeof userEvent.setup>;

interface CapturedRequest {
  key: string | null;
  body: Record<string, unknown>;
}

function installApplicationSpy(responses?: Array<() => Response>) {
  const captured: CapturedRequest[] = [];
  server.use(
    http.post(APPLICATIONS_URL, async ({ request }) => {
      captured.push({
        key: request.headers.get("Idempotency-Key"),
        body: (await request.json()) as Record<string, unknown>,
      });
      if (responses !== undefined && captured.length <= responses.length) {
        return responses[captured.length - 1]!();
      }
      return HttpResponse.json({ message: "Анкета принята" }, { status: 201 });
    }),
  );
  return { captured };
}

function renderRoute(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <AppProviders queryClient={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route element={<RootPage />} path="/" />
          <Route element={<ApplyPage />} path="/apply" />
          <Route element={<SuccessPage />} path="/apply/success" />
          <Route element={<PrivacyPage />} path="/privacy" />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

function waitForForm() {
  return screen.findByRole("button", { name: "Отправить анкету" });
}

async function fillValidForm(user: User) {
  await screen.findByRole("radio", { name: /Оператор линии розлива/ }, { timeout: 10_000 });
  await user.type(screen.getByLabelText(/^Фамилия/), "Смирнова");
  await user.type(screen.getByLabelText(/^Имя/), "Анна");
  await user.type(screen.getByLabelText(/^Возраст/), "19");
  await user.type(screen.getByLabelText(/^Телефон/), "+7 900 000-00-00");
  await user.click(screen.getByRole("radio", { name: "Студент" }));
  await user.click(screen.getByRole("radio", { name: /Оператор линии розлива/ }));
  await user.click(screen.getByRole("checkbox"));
}

async function submitValidForm(user: User) {
  await fillValidForm(user);
  await user.click(screen.getByRole("button", { name: "Отправить анкету" }));
}

describe("Анкета: валидация на «ты» из v4", () => {
  it.each([
    ["Напиши фамилию"],
    ["Напиши имя"],
    ["Укажи возраст"],
    ["Проверь номер телефона"],
    ["Выбери, кто ты сейчас"],
    ["Выбери вакансию"],
    ["Без согласия мы не сможем сохранить анкету"],
  ])("пустая форма показывает сообщение «%s»", async (message) => {
    const user = userEvent.setup();
    renderRoute("/apply");
    await waitForForm();
    await user.click(screen.getByRole("button", { name: "Отправить анкету" }));
    expect(screen.getAllByText(message).length).toBeGreaterThan(0);
  });

  it("без согласия валидная анкета не уходит на сервер", async () => {
    const user = userEvent.setup();
    renderRoute("/apply");
    await waitForForm();
    await screen.findByRole("radio", { name: /Оператор линии розлива/ });
    await user.type(screen.getByLabelText(/^Фамилия/), "Смирнова");
    await user.type(screen.getByLabelText(/^Имя/), "Анна");
    await user.type(screen.getByLabelText(/^Возраст/), "19");
    await user.type(screen.getByLabelText(/^Телефон/), "+7 900 000-00-00");
    await user.click(screen.getByRole("radio", { name: "Студент" }));
    await user.click(screen.getByRole("radio", { name: /Оператор линии розлива/ }));

    const { captured } = installApplicationSpy();
    await user.click(screen.getByRole("button", { name: "Отправить анкету" }));

    expect(screen.getByText("Без согласия мы не сможем сохранить анкету")).toBeInTheDocument();
    expect(screen.queryByText(/Анкета у нас/)).not.toBeInTheDocument();
    expect(captured).toHaveLength(0);
  });

  it("возраст 16 — живая подсказка и ошибка при отправке", async () => {
    const user = userEvent.setup();
    renderRoute("/apply");
    await waitForForm();
    await user.type(screen.getByLabelText(/^Возраст/), "16");
    expect(screen.getByRole("status")).toHaveTextContent("На стажировку и работу берём с 18 лет");
    await user.click(screen.getByRole("button", { name: "Отправить анкету" }));
    expect(screen.getAllByText(/с 18 лет/).length).toBeGreaterThan(0);
  });

  it("короткий телефон — «Проверь номер телефона»", async () => {
    const user = userEvent.setup();
    renderRoute("/apply");
    await waitForForm();
    await user.type(screen.getByLabelText(/^Телефон/), "8900");
    await user.click(screen.getByRole("button", { name: "Отправить анкету" }));
    expect(screen.getByText("Проверь номер телефона")).toBeInTheDocument();
  });

  it("кривой e-mail — «Проверь e-mail»", async () => {
    const user = userEvent.setup();
    renderRoute("/apply");
    await waitForForm();
    await user.type(screen.getByLabelText("E-mail"), "anna@");
    await user.click(screen.getByRole("button", { name: "Отправить анкету" }));
    expect(screen.getByText("Проверь e-mail")).toBeInTheDocument();
  });

  it("резюме без https — сообщение из v4", async () => {
    const user = userEvent.setup();
    renderRoute("/apply");
    await waitForForm();
    await user.type(screen.getByLabelText("Ссылка на резюме"), "hh.ru/resume/1");
    await user.click(screen.getByRole("button", { name: "Отправить анкету" }));
    expect(screen.getByText("Нужна ссылка, начинающаяся с https://")).toBeInTheDocument();
  });
});

describe("Анкета: отправка, идемпотентность и honeypot", () => {
  it("валидная анкета уходит одним POST с Idempotency-Key и без внутренних полей", async () => {
    const user = userEvent.setup();
    renderRoute("/apply");
    const { captured } = installApplicationSpy();

    await submitValidForm(user);
    await screen.findByText(/Анкета у нас/);

    expect(captured).toHaveLength(1);
    const request = captured[0]!;
    expect(request.key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(request.body).toEqual({
      last_name: "Смирнова",
      first_name: "Анна",
      phone: "+79000000000",
      age: 19,
      who: "student",
      vacancy_id: ROZLIV.id,
      consent: true,
      privacy_revision: 1,
    });
    for (const internal of [
      "status",
      "source",
      "rating",
      "hot",
      "next_step",
      "department",
      "assignee",
      "responsible_id",
      "created_by",
      "comments",
      "website",
    ]) {
      expect(request.body).not.toHaveProperty(internal);
    }

    mkdirSync(EVIDENCE_DIR, { recursive: true });
    writeFileSync(
      `${EVIDENCE_DIR}/task-7-request.json`,
      JSON.stringify(
        {
          url: "/api/v1/public/applications",
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": request.key },
          body: request.body,
          note: "Захвачено MSW-хендлером в tests/application.test.tsx; внутренних полей нет",
        },
        null,
        2,
      ),
    );
  });

  it(
    "ключ идемпотентности стабилен между ретраями и обновляется после успеха",
    { timeout: 20_000 },
    async () => {
    const user = userEvent.setup();
    renderRoute("/apply");
    const { captured } = installApplicationSpy([
      () =>
        HttpResponse.json(
          { code: "INTERNAL", message: "Сервер не отвечает" },
          { status: 500 },
        ),
      () => HttpResponse.json({ message: "Анкета принята" }, { status: 201 }),
      () => HttpResponse.json({ message: "Анкета принята" }, { status: 201 }),
    ]);

    await submitValidForm(user);
    expect(await screen.findByText("Сервер не отвечает")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Фамилия/)).toHaveValue("Смирнова");

    await user.click(screen.getByRole("button", { name: "Отправить ещё раз" }));
    await screen.findByText(/Анкета у нас/);

    expect(captured).toHaveLength(2);
    expect(captured[0]!.key).toBe(captured[1]!.key);

    await user.click(screen.getByRole("link", { name: "На главную" }));
    await user.click(screen.getAllByRole("link", { name: "Заполнить анкету" })[0]!);
    await waitForForm();
    await submitValidForm(user);
    await screen.findByText(/Анкета у нас/);

    expect(captured).toHaveLength(3);
    expect(captured[2]!.key).not.toBe(captured[1]!.key);
  });

  it("заполненный honeypot молча «принимает» анкету без запроса", async () => {
    const user = userEvent.setup();
    renderRoute("/apply");
    const { captured } = installApplicationSpy();

    await fillValidForm(user);
    const honeypot = document.querySelector('input[name="website"]') as HTMLInputElement;
    expect(honeypot).not.toBeNull();
    expect(honeypot.tabIndex).toBe(-1);
    await user.type(honeypot, "http://spam.example");

    await user.click(screen.getByRole("button", { name: "Отправить анкету" }));
    await screen.findByText(/Анкета у нас/);
    expect(captured).toHaveLength(0);
  });

  it("?v=rozliv предвыбирает вакансию, ?e= уходит в payload", async () => {
    const user = userEvent.setup();
    renderRoute("/apply?v=rozliv&e=" + encodeURIComponent("Ярмарка вакансий"));
    await waitForForm();
    expect(await screen.findByText(/Мероприятие: Ярмарка вакансий/)).toBeInTheDocument();
    expect(await screen.findByRole("radio", { name: /Оператор линии розлива/ })).toBeChecked();

    const { captured } = installApplicationSpy();
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Отправить анкету" }));
    await screen.findByText(/Анкета у нас/);

    expect(captured).toHaveLength(1);
    expect(captured[0]!.body.event).toBe("Ярмарка вакансий");
  });
});

describe("Анкета: карточки вакансий и чипы как в прототипе v4", () => {
  it("вакансии — радиокарточки с названием, подразделением и вилкой", async () => {
    renderRoute("/apply");
    await waitForForm();
    const group = screen.getByRole("group", { name: /^Вакансия/ });
    const cards = within(group).getAllByRole("radio");
    expect(cards).toHaveLength(PUBLIC_VACANCIES_FIXTURE.length);
    const rozliv = within(group).getByRole("radio", { name: /Оператор линии розлива/ });
    expect(rozliv).toHaveAccessibleName(/Цех розлива · от 70 000 ₽/);
  });

  it("занятость и смены — чипы-переключатели, смена уходит в payload", async () => {
    const user = userEvent.setup();
    renderRoute("/apply");
    await waitForForm();
    const { captured } = installApplicationSpy();
    await fillValidForm(user);
    await user.click(screen.getByRole("radio", { name: "Только дневные" }));
    await user.click(screen.getByRole("button", { name: "Отправить анкету" }));
    await screen.findByText(/Анкета у нас/);
    expect(captured[0]!.body.shifts).toBe("Только дневные");
  });
});

describe("Анкета: ответы сервера", () => {
  it("422 field_errors подсвечивает поля и сохраняет ввод", async () => {
    const user = userEvent.setup();
    renderRoute("/apply");
    installApplicationSpy([
      () =>
        HttpResponse.json(
          {
            code: "VALIDATION_ERROR",
            message: "Проверь выделенные поля",
            field_errors: { phone: "Проверь номер телефона" },
          },
          { status: 422 },
        ),
    ]);

    await submitValidForm(user);
    expect(await screen.findByText("Проверь номер телефона")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Фамилия/)).toHaveValue("Смирнова");
  });

  it("429 — живое сообщение и подсказка Retry-After", async () => {
    const user = userEvent.setup();
    renderRoute("/apply");
    installApplicationSpy([
      () =>
        HttpResponse.json(
          {
            code: "RATE_LIMITED",
            message: "Слишком много анкет с этого устройства. Попробуй позже.",
          },
          { status: 429, headers: { "Retry-After": "60" } },
        ),
    ]);

    await submitValidForm(user);
    expect(
      await screen.findByText("Слишком много анкет с этого устройства. Попробуй позже."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Подожди примерно 60 с/)).toBeInTheDocument();
  });

  it("503 — приём закрыт, форма исчезает", async () => {
    const user = userEvent.setup();
    renderRoute("/apply");
    installApplicationSpy([
      () =>
        HttpResponse.json(
          { code: "INTAKE_DISABLED", message: "Приём анкет закрыт" },
          { status: 503 },
        ),
    ]);

    await submitValidForm(user);
    expect(await screen.findByText("Приём анкет закрыт")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Отправить анкету" })).not.toBeInTheDocument();
  });

  it(
    "409 PRIVACY_REVISION_CHANGED — refetch, новый ключ и privacy_revision, повторная отправка",
    { timeout: 20_000 },
    async () => {
    const user = userEvent.setup();
    renderRoute("/apply");
    const { captured } = installApplicationSpy([
      () =>
        HttpResponse.json(
          { code: "PRIVACY_REVISION_CHANGED", message: "Политика обновилась" },
          { status: 409 },
        ),
      () => HttpResponse.json({ message: "Анкета принята" }, { status: 201 }),
    ]);
    // Refetch after 409 must see the bumped revision; mount-time fetch already cached rev 1.
    server.use(
      http.get(PRIVACY_URL, () =>
        HttpResponse.json({ ...PUBLIC_PRIVACY_ACTIVE_FIXTURE, revision: 2 }),
      ),
    );

    await submitValidForm(user);
    expect(await screen.findByText("Политика обработки данных обновилась")).toBeInTheDocument();

    const consent = screen.getByRole("checkbox") as HTMLInputElement;
    expect(consent.checked).toBe(false);
    expect(screen.getByLabelText(/^Фамилия/)).toHaveValue("Смирнова");
    expect(screen.getByLabelText(/^Телефон/)).toHaveValue("+7 900 000-00-00");
    expect(captured).toHaveLength(1);
    expect(captured[0]!.body.privacy_revision).toBe(1);
    expect(screen.getByText("Редакция политики: 2")).toBeInTheDocument();

    await user.click(consent);
    await user.click(screen.getByRole("button", { name: "Отправить анкету" }));
    await screen.findByText(/Анкета у нас/);

    expect(captured).toHaveLength(2);
    expect(captured[1]!.body.privacy_revision).toBe(2);
    expect(captured[1]!.key).not.toBe(captured[0]!.key);
    expect(captured[1]!.key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("сетевая ошибка — повтор с тем же ключом и сохранёнными полями", async () => {
    const user = userEvent.setup();
    renderRoute("/apply");
    const { captured } = installApplicationSpy([
      () => HttpResponse.error(),
      () => HttpResponse.json({ message: "Анкета принята" }, { status: 201 }),
    ]);

    await submitValidForm(user);
    expect(await screen.findByText("Не получилось отправить")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Фамилия/)).toHaveValue("Смирнова");

    await user.click(screen.getByRole("button", { name: "Отправить ещё раз" }));
    await screen.findByText(/Анкета у нас/);
    expect(captured).toHaveLength(2);
    expect(captured[0]!.key).toBe(captured[1]!.key);
  });
});

describe("Публичные состояния", () => {
  it("collection_enabled=false — вместо формы закрытый приём", async () => {
    server.use(
      http.get(PRIVACY_URL, () =>
        HttpResponse.json({ ...PUBLIC_PRIVACY_ACTIVE_FIXTURE, collection_enabled: false }),
      ),
    );
    renderRoute("/apply");
    expect(await screen.findByText("Приём анкет закрыт")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Отправить анкету" })).not.toBeInTheDocument();
  });

  it("страница успеха нейтральна при прямом заходе", async () => {
    renderRoute("/apply/success");
    expect(await screen.findByRole("heading", { name: "Анкета принята!" })).toBeInTheDocument();
    expect(screen.getByText(/Страница подтверждения одноразовая/)).toBeInTheDocument();
  });

  it("страница политики показывает ревизию и состояние приёма", async () => {
    renderRoute("/privacy");
    expect(await screen.findByText("Приём анкет открыт")).toBeInTheDocument();
    expect(screen.getByText("Редакция: 1")).toBeInTheDocument();
  });

  it("нет опубликованной политики — нейтральное сообщение", async () => {
    server.use(http.get(PRIVACY_URL, () => HttpResponse.json({}, { status: 404 })));
    renderRoute("/privacy");
    expect(await screen.findByText("Политика публикуется при открытии приёма")).toBeInTheDocument();
  });
});

describe("Лендинг: вакансии", () => {
  it("рисует сетку вакансий с SVG-артом и персональным CTA на анкету", async () => {
    renderRoute("/");
    const cards = await screen.findAllByRole("article");
    expect(cards).toHaveLength(PUBLIC_VACANCIES_FIXTURE.length);
    expect(
      screen.getByRole("heading", { name: /Влейся в команду «Очаково»/ }),
    ).toBeInTheDocument();

    const rozlivCard = cards.find((card) =>
      within(card).queryByText("Оператор линии розлива"),
    );
    expect(rozlivCard).toBeDefined();
    const cta = within(rozlivCard!).getByRole("link", {
      name: "Хочу на розлив",
    });
    expect(cta).toHaveAttribute("href", "/apply?v=rozliv");
    const art = within(rozlivCard!).getByRole("img", {
      name: "Бутылки на конвейере",
    });
    expect(art.tagName.toLowerCase()).toBe("svg");
    expect(within(rozlivCard!).getByText("от 70 000 ₽")).toBeInTheDocument();
  });

  it("неизвестный slug — арт-фолбэк «знак вопроса», не падение", async () => {
    server.use(
      http.get(VACANCIES_URL, () =>
        HttpResponse.json([
          {
            id: "22222222-2222-4222-8222-222222222201",
            slug: "alien",
            title: "Инспектор планет",
            dept: "Отдел космоса",
            pay: "по договорённости",
            schedule: null,
            icon: "rocket",
          },
        ]),
      ),
    );
    renderRoute("/");
    expect(await screen.findByText("Инспектор планет")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Знак вопроса и стрелка роста" }),
    ).toBeInTheDocument();
  });

  it("пустой список вакансий — EmptyState с CTA", async () => {
    server.use(http.get(VACANCIES_URL, () => HttpResponse.json([])));
    renderRoute("/");
    expect(await screen.findByText("Открытых вакансий пока нет")).toBeInTheDocument();
    const ctas = screen
      .getAllByRole("link", { name: "Заполнить анкету" })
      .map((link) => link.getAttribute("href"));
    expect(ctas).toContain("/apply");
  });

  it("ошибка загрузки — Alert и повторная попытка", async () => {
    server.use(http.get(VACANCIES_URL, () => HttpResponse.json({}, { status: 500 })));
    renderRoute("/");
    expect(await screen.findByText("Не удалось загрузить вакансии")).toBeInTheDocument();

    server.resetHandlers();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Попробовать ещё раз" }));
    expect(await screen.findByText("Лаборант / химик-лаборант")).toBeInTheDocument();
  });
});
