import { http, HttpResponse } from "msw";

export const PUBLIC_VACANCIES_FIXTURE = [
  {
    id: "11111111-1111-4111-8111-111111111101",
    slug: "lab",
    title: "Лаборант / химик-лаборант",
    dept: "Лаборатория",
    pay: "от 60 000 ₽",
    schedule: "2/2, 8:00–20:00",
    icon: "funnel",
  },
  {
    id: "11111111-1111-4111-8111-111111111102",
    slug: "rozliv",
    title: "Оператор линии розлива",
    dept: "Цех розлива",
    pay: "от 70 000 ₽",
    schedule: "смены день / ночь",
    icon: "bottle",
  },
  {
    id: "11111111-1111-4111-8111-111111111103",
    slug: "tech",
    title: "Оператор технологического цеха",
    dept: "Технологический цех",
    pay: "от 70 000 ₽",
    schedule: "2/2",
    icon: "kettle",
  },
  {
    id: "11111111-1111-4111-8111-111111111104",
    slug: "sklad",
    title: "Оператор склада",
    dept: "Складской комплекс",
    pay: "от 60 000 ₽",
    schedule: "2/2",
    icon: "crate",
  },
  {
    id: "11111111-1111-4111-8111-111111111105",
    slug: "kladov",
    title: "Кладовщик",
    dept: "Складской комплекс",
    pay: "от 56 000 ₽",
    schedule: "2/2",
    icon: "crate",
  },
  {
    id: "11111111-1111-4111-8111-111111111106",
    slug: "mash",
    title: "Машинист оборудования",
    dept: "Пульт управления",
    pay: "по итогам собеседования",
    schedule: "сменный график",
    icon: "tank",
  },
  {
    id: "11111111-1111-4111-8111-111111111107",
    slug: "technolog",
    title: "Технолог",
    dept: "Отдел новых вкусов",
    pay: "по итогам собеседования",
    schedule: null,
    icon: "wheat",
  },
  {
    id: "11111111-1111-4111-8111-111111111108",
    slug: "free",
    title: "Учебная практика",
    dept: "Разные отделы",
    pay: "по договорённости",
    schedule: "гибкий график",
    icon: "hops",
  },
  {
    id: "11111111-1111-4111-8111-111111111109",
    slug: "open",
    title: "Пока не знаю — предложи сам",
    dept: "Разные отделы",
    pay: null,
    schedule: null,
    icon: "can",
  },
] as const;

export const PUBLIC_PRIVACY_ACTIVE_FIXTURE = {
  collection_enabled: true,
  revision: 1,
  notice: "Оператор обрабатывает данные кандидатов для связи по вакансиям и практике.",
  consent:
    "Согласен на обработку персональных данных «Очаково» для связи по вакансиям и практике.",
};

/* T8 auth fixtures: имена полей 1:1 backend/app/api/auth.py (EmployeeView/MeView). */

export const STAFF_ACTIVE_ME_FIXTURE = {
  id: "33333333-3333-4333-8333-333333333301",
  email: "irina.staff@example.test",
  first_name: "Ирина",
  last_name: "Смирнова",
  position: "HR-менеджер",
  role: "staff",
  state: "active",
  must_change_password: false,
  csrf_token: "csrf-staff-1",
};

export const ADMIN_ACTIVE_ME_FIXTURE = {
  ...STAFF_ACTIVE_ME_FIXTURE,
  id: "33333333-3333-4333-8333-333333333302",
  email: "olga.admin@example.test",
  first_name: "Ольга",
  last_name: "Ковалёва",
  position: "Руководитель HR",
  role: "admin",
  csrf_token: "csrf-admin-1",
};

export const STAFF_MUST_CHANGE_ME_FIXTURE = {
  ...STAFF_ACTIVE_ME_FIXTURE,
  must_change_password: true,
  csrf_token: "csrf-must-change-1",
};

export const LOGIN_STAFF_VIEW_FIXTURE = {
  id: STAFF_ACTIVE_ME_FIXTURE.id,
  email: STAFF_ACTIVE_ME_FIXTURE.email,
  first_name: STAFF_ACTIVE_ME_FIXTURE.first_name,
  last_name: STAFF_ACTIVE_ME_FIXTURE.last_name,
  position: STAFF_ACTIVE_ME_FIXTURE.position,
  role: "staff",
  state: "active",
  must_change_password: false,
};

export const handlers = [
  http.get("http://localhost/api/health/live", () =>
    HttpResponse.json({ status: "ok" }),
  ),

  http.get("http://localhost/api/v1/public/vacancies", () =>
    HttpResponse.json(PUBLIC_VACANCIES_FIXTURE),
  ),

  http.get("http://localhost/api/v1/public/privacy", () =>
    HttpResponse.json(PUBLIC_PRIVACY_ACTIVE_FIXTURE),
  ),

  http.post("http://localhost/api/v1/public/applications", () =>
    HttpResponse.json({ message: "Анкета принята" }, { status: 201 }),
  ),

  http.get("http://localhost/api/v1/auth/me", () =>
    HttpResponse.json(
      { code: "UNAUTHENTICATED", message: "Требуется вход в систему", request_id: "msw-me-anon" },
      { status: 401 },
    ),
  ),

  http.post("http://localhost/api/v1/auth/login", () =>
    HttpResponse.json(
      { code: "INVALID_CREDENTIALS", message: "Неверный email или пароль", request_id: "msw-login-401" },
      { status: 401 },
    ),
  ),

  http.post("http://localhost/api/v1/auth/register", () =>
    HttpResponse.json(
      { message: "Регистрация принята. Ожидайте допуска администратора" },
      { status: 201 },
    ),
  ),

  http.post("http://localhost/api/v1/auth/logout", () => new HttpResponse(null, { status: 204 })),

  http.post("http://localhost/api/v1/auth/password", () => new HttpResponse(null, { status: 204 })),
];

/* T9 candidates fixtures и хендлеры (append-only). Имена полей 1:1 backend/app/schemas/candidates.py. */

export const CANDIDATE_FIXTURE = {
  id: "44444444-4444-4444-8444-444444444401",
  first_name: "Пётр",
  last_name: "Семёнов",
  middle_name: "Ильич",
  phone: "+79990001122",
  telegram: "semenov_p",
  email: "petr@example.test",
  age: 23,
  who: "student",
  edu_level: "college",
  school: "Колледж №5",
  specialty: "Лаборант-аналитик",
  grad_year: 2024,
  vacancy_id: "11111111-1111-4111-8111-111111111101",
  position: "Лаборант",
  city: "Москва",
  employment: "part",
  start_date: "2026-11-01",
  shifts: "2/2",
  resume_url: "https://example.test/resume",
  experience: null,
  about: "Про процессы на линии розлива",
  event: "Ярмарка вакансий",
  status: "interview",
  source: "phone",
  department: "Лаборатория",
  responsible_id: "33333333-3333-4333-8333-333333333301",
  priority: "normal",
  expected_salary: "65000.00",
  interview_at: "2026-10-26T10:00:00+03:00",
  next_contact_at: null,
  hot: true,
  rating: 4,
  next_step: "Позвонить после практики",
  archived_at: null,
  created_at: "2026-10-20T11:30:00+03:00",
  updated_at: "2026-10-21T09:15:00+03:00",
  created_by: "33333333-3333-4333-8333-333333333302",
  updated_by: "33333333-3333-4333-8333-333333333302",
  version: 3,
  processing_basis: "candidate_consent",
  processing_basis_note: null,
  consent_at: "2026-10-20T11:30:00+03:00",
  privacy_revision: 1,
  retention_due_at: "2027-10-20T11:30:00+03:00",
  duplicate_contact_count: 0,
};

function syntheticCandidate(index: number): Record<string, unknown> {
  const padded = String(index).padStart(2, "0");
  return {
    ...CANDIDATE_FIXTURE,
    id: `55555555-5555-4555-8555-55555555${padded}`,
    first_name: "Тест",
    last_name: `Тестов-${padded}`,
    middle_name: null,
    telegram: `testov_${index}`,
    email: null,
    age: 20 + (index % 40),
    who: "working",
    hot: index % 4 === 0,
    rating: index % 6,
    status: index % 3 === 0 ? "application" : "new",
    archived_at: null,
    department: null,
    responsible_id: null,
    interview_at: null,
    duplicate_contact_count: 0,
  };
}

export const CANDIDATES_ALL_FIXTURE = Array.from({ length: 45 }, (_value, index) =>
  syntheticCandidate(index),
);

export const ARCHIVED_CANDIDATES_ALL_FIXTURE = Array.from({ length: 3 }, (_value, index) => ({
  ...syntheticCandidate(index),
  id: `55555555-5555-4555-8555-66666666${String(index).padStart(2, "0")}`,
  last_name: `Архивов-${String(index).padStart(2, "0")}`,
  status: "reject",
  archived_at: "2026-10-21T00:00:00+03:00",
}));

export function candidatesPage(items: unknown[], total: number, page: number, pageSize = 20) {
  return { items, total, page, page_size: pageSize };
}

export const STAFF_VACANCIES_FIXTURE = PUBLIC_VACANCIES_FIXTURE.map((vacancy, index) => ({
  ...vacancy,
  is_active: true,
  sort: (index + 1) * 10,
  created_at: "2026-10-01T00:00:00+03:00",
  updated_at: "2026-10-01T00:00:00+03:00",
}));

export const STAFF_OPTIONS_FIXTURE = [
  { id: "33333333-3333-4333-8333-333333333301", name: "Смирнова Ирина" },
  { id: "33333333-3333-4333-8333-333333333302", name: "Ковалёва Ольга" },
];

export const COMMENTS_PAGE_FIXTURE = {
  items: [
    {
      id: "66666666-6666-4666-8666-666666666601",
      candidate_id: CANDIDATE_FIXTURE.id,
      created_by: "33333333-3333-4333-8333-333333333302",
      created_at: "2026-10-21T12:00:00+03:00",
      body: "Договорились созвониться после практики.",
      author_name: "Ковалёва Ольга",
    },
  ],
  total: 1,
  page: 1,
  page_size: 50,
};

handlers.push(
  http.get("http://localhost/api/v1/candidates", ({ request }) => {
    const query = new URL(request.url).searchParams;
    const pageSize = Number(query.get("page_size")) || 20;
    if (![20, 50, 100].includes(pageSize)) {
      return HttpResponse.json(
        { code: "VALIDATION_ERROR", message: "Проверьте поля формы", request_id: "msw" },
        { status: 422 },
      );
    }
    const archived = query.get("archived") === "1";
    const source = archived ? ARCHIVED_CANDIDATES_ALL_FIXTURE : CANDIDATES_ALL_FIXTURE;
    const page = Math.max(1, Number(query.get("page")) || 1);
    return HttpResponse.json(
      candidatesPage(
        source.slice((page - 1) * pageSize, page * pageSize),
        source.length,
        page,
        pageSize,
      ),
    );
  }),
  http.get("http://localhost/api/v1/candidates/:id", ({ params }) => {
    if (params.id === CANDIDATE_FIXTURE.id) {
      return HttpResponse.json(CANDIDATE_FIXTURE);
    }
    const found = CANDIDATES_ALL_FIXTURE.find((candidate) => candidate.id === params.id);
    return found === undefined
      ? HttpResponse.json({ code: "NOT_FOUND", message: "Кандидат не найден" }, { status: 404 })
      : HttpResponse.json(found);
  }),
  http.get("http://localhost/api/v1/candidates/:id/comments", () =>
    HttpResponse.json(COMMENTS_PAGE_FIXTURE),
  ),
  http.get("http://localhost/api/v1/candidates/export.csv", () =>
    new HttpResponse("\ufeffID;Дата;ФИО\r\n44444444;20.10.2026 11:30 (МСК);Семёнов Пётр", {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="candidates.csv"',
      },
    }),
  ),
  http.get("http://localhost/api/v1/vacancies", () => HttpResponse.json(STAFF_VACANCIES_FIXTURE)),
  http.get("http://localhost/api/v1/employees/options", () =>
    HttpResponse.json(STAFF_OPTIONS_FIXTURE),
  ),
);

/* T10 admin fixtures и хендлеры (append-only). Поля 1:1 backend/app/api/admin.py. */

export const PENDING_EMPLOYEE_FIXTURE = {
  id: "77777777-7777-4777-8777-777777777701",
  email: "nikita.pending@example.test",
  first_name: "Никита",
  last_name: "Орлов",
  position: "Оператор линии розлива",
  role: "staff",
  state: "pending",
  must_change_password: false,
  approved_by: null,
  approved_at: null,
  created_at: "2026-10-23T10:00:00+03:00",
};

export const ACTIVE_STAFF_EMPLOYEE_FIXTURE = {
  ...PENDING_EMPLOYEE_FIXTURE,
  id: "77777777-7777-4777-8777-777777777702",
  email: "irina.staff@example.test",
  first_name: "Ирина",
  last_name: "Смирнова",
  position: "HR-менеджер",
  state: "active",
  approved_by: "33333333-3333-4333-8333-333333333302",
  approved_at: "2026-10-22T09:00:00+03:00",
};

export const LAST_ADMIN_EMPLOYEE_FIXTURE = {
  ...PENDING_EMPLOYEE_FIXTURE,
  id: "33333333-3333-4333-8333-333333333302",
  email: "olga.admin@example.test",
  first_name: "Ольга",
  last_name: "Ковалёва",
  position: "Руководитель HR",
  role: "admin",
  state: "active",
};

export const REJECTED_EMPLOYEE_FIXTURE = {
  ...PENDING_EMPLOYEE_FIXTURE,
  id: "77777777-7777-4777-8777-777777777703",
  email: "roman.rejected@example.test",
  first_name: "Роман",
  last_name: "Гусев",
  state: "rejected",
};

export const DISABLED_EMPLOYEE_FIXTURE = {
  ...PENDING_EMPLOYEE_FIXTURE,
  id: "77777777-7777-4777-8777-777777777704",
  email: "vera.disabled@example.test",
  first_name: "Вера",
  last_name: "Соколова",
  state: "disabled",
};

export const EMPLOYEES_ALL_FIXTURE = [
  PENDING_EMPLOYEE_FIXTURE,
  ACTIVE_STAFF_EMPLOYEE_FIXTURE,
  LAST_ADMIN_EMPLOYEE_FIXTURE,
  REJECTED_EMPLOYEE_FIXTURE,
  DISABLED_EMPLOYEE_FIXTURE,
];

const ACTION_STATES: Record<string, string> = {
  approve: "active",
  reject: "rejected",
  disable: "disabled",
  reactivate: "active",
};

export function syntheticAuditEvent(index: number): Record<string, unknown> {
  const actions = ["login", "logout", "create", "update", "approve", "comment"] as const;
  const action = actions[index % actions.length]!;
  return {
    id: `99999999-9999-4999-8999-99999999${String(index).padStart(4, "0")}`,
    actor_id: index % 2 === 0 ? "33333333-3333-4333-8333-333333333302" : "33333333-3333-4333-8333-333333333301",
    entity_id: `44444444-4444-4444-8444-44444444${String(index).padStart(4, "0")}`,
    action,
    changed_fields: action === "approve" ? ["state"] : [],
    created_at: `2026-10-${String(1 + (index % 20)).padStart(2, "0")}T12:00:00+03:00`,
  };
}

export const AUDIT_EVENTS_ALL_FIXTURE = Array.from({ length: 45 }, (_value, index) =>
  syntheticAuditEvent(index),
);

handlers.push(
  http.get("http://localhost/api/v1/admin/employees", ({ request }) => {
    const query = new URL(request.url).searchParams;
    const state = query.get("state") ?? "pending";
    const q = (query.get("q") ?? "").trim().toLowerCase();
    const page = Math.max(1, Number(query.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.get("page_size")) || 20));
    const filtered = EMPLOYEES_ALL_FIXTURE.filter(
      (employee) =>
        employee.state === state &&
        (q === "" ||
          `${employee.last_name} ${employee.first_name} ${employee.email}`
            .toLowerCase()
            .includes(q)),
    );
    return HttpResponse.json({
      items: filtered.slice((page - 1) * pageSize, page * pageSize),
      total: filtered.length,
      page,
      page_size: pageSize,
    });
  }),
  http.post("http://localhost/api/v1/admin/employees/:id/approve", ({ params }) => {
    const found = EMPLOYEES_ALL_FIXTURE.find((employee) => employee.id === params.id);
    return found === undefined
      ? HttpResponse.json({ code: "EMPLOYEE_NOT_FOUND", message: "Сотрудник не найден" }, { status: 404 })
      : HttpResponse.json({ ...found, state: ACTION_STATES.approve });
  }),
  http.post("http://localhost/api/v1/admin/employees/:id/reject", ({ params }) => {
    const found = EMPLOYEES_ALL_FIXTURE.find((employee) => employee.id === params.id);
    return found === undefined
      ? HttpResponse.json({ code: "EMPLOYEE_NOT_FOUND", message: "Сотрудник не найден" }, { status: 404 })
      : HttpResponse.json({ ...found, state: ACTION_STATES.reject });
  }),
  http.post("http://localhost/api/v1/admin/employees/:id/disable", ({ params }) => {
    const found = EMPLOYEES_ALL_FIXTURE.find((employee) => employee.id === params.id);
    return found === undefined
      ? HttpResponse.json({ code: "EMPLOYEE_NOT_FOUND", message: "Сотрудник не найден" }, { status: 404 })
      : HttpResponse.json({ ...found, state: ACTION_STATES.disable });
  }),
  http.post("http://localhost/api/v1/admin/employees/:id/reactivate", ({ params }) => {
    const found = EMPLOYEES_ALL_FIXTURE.find((employee) => employee.id === params.id);
    return found === undefined
      ? HttpResponse.json({ code: "EMPLOYEE_NOT_FOUND", message: "Сотрудник не найден" }, { status: 404 })
      : HttpResponse.json({ ...found, state: ACTION_STATES.reactivate });
  }),
  http.post("http://localhost/api/v1/admin/employees/:id/reset-password", () =>
    HttpResponse.json({
      message: "Пароль изменён. Сотруднику необходимо войти и сменить пароль",
    }),
  ),
  http.post("http://localhost/api/v1/admin/intake/disable", () =>
    HttpResponse.json({ message: "Приём анкет остановлен" }),
  ),
  http.get("http://localhost/api/v1/admin/audit", ({ request }) => {
    const query = new URL(request.url).searchParams;
    const action = query.get("action");
    const actorId = query.get("actor_id");
    const page = Math.max(1, Number(query.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.get("page_size")) || 20));
    const filtered = AUDIT_EVENTS_ALL_FIXTURE.filter(
      (event) =>
        (action === null || event.action === action) &&
        (actorId === null || event.actor_id === actorId),
    );
    return HttpResponse.json({
      items: filtered.slice((page - 1) * pageSize, page * pageSize),
      total: filtered.length,
      page,
      page_size: pageSize,
    });
  }),
  http.post("http://localhost/api/v1/vacancies", () =>
    HttpResponse.json(
      {
        id: "88888888-8888-4888-8888-888888888801",
        slug: "new-vacancy",
        title: "Новая вакансия",
        dept: "",
        pay: "",
        schedule: "",
        icon: "can",
        is_active: true,
        sort: 0,
        created_at: "2026-10-24T12:00:00+03:00",
        updated_at: "2026-10-24T12:00:00+03:00",
      },
      { status: 201 },
    ),
  ),
  http.patch("http://localhost/api/v1/vacancies/:id", async ({ params, request }) => {
    const found = STAFF_VACANCIES_FIXTURE.find((vacancy) => vacancy.id === params.id);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return found === undefined
      ? HttpResponse.json({ code: "NOT_FOUND", message: "Вакансия не найдена" }, { status: 404 })
      : HttpResponse.json({ ...found, ...body, updated_at: "2026-10-24T13:00:00+03:00" });
  }),
);
