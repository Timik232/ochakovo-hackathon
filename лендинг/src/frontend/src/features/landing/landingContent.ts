// Дословный контент лендинга из прототипа v4 (ochakovo-career/public/index.html).
// Только данные — компоненты в LandingPage.tsx / landingArt.tsx.

export const TICKER_SLOGANS = [
  "Время сменить карьерный вкус",
  "Не краш, но стабильный партнёр",
  "Твой потенциал — наш любимый ингредиент",
  "Расти, даже если ты не дрожжи",
  "Влейся в команду «Очаково»",
] as const;

export interface PillarItem {
  key: "eye" | "home" | "shelf" | "up" | "shield";
  title: string;
  text: string;
}

export const PILLARS: PillarItem[] = [
  {
    key: "eye",
    title: "Как есть",
    text: "График, деньги и ночные смены — до заявки, без сюрпризов на испытательном.",
  },
  {
    key: "home",
    title: "Старт с опорой",
    text: "Договор по ТК, половину общежития оплачиваем, столовая по льготной цене.",
  },
  {
    key: "shelf",
    title: "Работа на полке",
    text: "Результат твоей смены видно в магазине — квас и лимонады.",
  },
  {
    key: "up",
    title: "Рост по ступеням",
    text: "Практика → штат → наладчик → мастер. Берём, чтобы учить и оставлять.",
  },
  {
    key: "shield",
    title: "Стабильно",
    text: "100% российская компания, работаем с 1978 года.",
  },
];

export interface PerkItem {
  badge: string;
  title: string;
  text: string;
}

export const PERKS: PerkItem[] = [
  {
    badge: "ТК",
    title: "Официально",
    text: "Временный трудовой договор по ТК РФ, потом можно перейти на постоянный",
  },
  { badge: "½", title: "Общежитие", text: "Оплачиваем 50% проживания" },
  { badge: "₽", title: "Столовая", text: "Питание по льготной цене" },
  { badge: "+", title: "Медосмотр", text: "За счёт компании" },
  { badge: "✓", title: "Спецодежда", text: "Выдаём всё, что нужно для смены" },
  { badge: "%", title: "Скидка", text: "На продукцию «Очаково»" },
];

export interface LadderStep {
  n: string;
  title: string;
  text: string;
}

export const LADDER: LadderStep[] = [
  { n: "1", title: "Практика", text: "Знакомишься с цехом и командой" },
  { n: "2", title: "Штат", text: "Постоянный договор и своя смена" },
  { n: "3", title: "Наладчик", text: "Отвечаешь за оборудование линии" },
  { n: "4", title: "Мастер", text: "Ведёшь людей и процесс" },
];

export type FactItem =
  | { kind: "count"; to: number; from: number; suffix: string; label: string }
  | { kind: "static"; value: string; label: string };

export const FACTS: FactItem[] = [
  {
    kind: "count",
    to: 1978,
    from: 1900,
    suffix: "",
    label: "Комбинат открылся к Олимпиаде-80",
  },
  { kind: "count", to: 100, from: 0, suffix: "%", label: "российская компания" },
  { kind: "static", value: "№\u00A01", label: "на рынке натурального кваса" },
  { kind: "static", value: "2", label: "минуты на анкету" },
];

export interface VacancyMeta {
  description: string | null;
  ctaLabel: string;
}

export const VACANCY_META: Record<string, VacancyMeta> = {
  lab: {
    description:
      "Контроль качества: берёшь пробы, проводишь органолептические и физико-химические анализы, проверяешь, что напиток соответствует нормам. Последний рубеж перед полкой.",
    ctaLabel: "Хочу в лабораторию",
  },
  rozliv: {
    description:
      "Работаешь на линии и машинах: этикетировщик, упаковка, выдувная машина, паллетайзер. Меняешь комплектующие, следишь, чтобы бутылки шли без остановок.",
    ctaLabel: "Хочу на розлив",
  },
  tech: {
    description:
      "Работа в цехе варки и с сырьём: сахар, сироп и всё, из чего рождаются напитки. Здесь квас становится квасом.",
    ctaLabel: "Хочу в цех варки",
  },
  sklad: {
    description:
      "Работаешь в программе учёта, с документами и товарно-транспортными накладными. Знаешь, где каждая паллета и куда она поедет.",
    ctaLabel: "Хочу на склад",
  },
  kladov: {
    description:
      "Ведёшь накладные и руководишь комплектовщиками: собираешь заказы так, чтобы магазин получил ровно то, что ждёт.",
    ctaLabel: "Хочу кладовщиком",
  },
  mash: {
    description:
      "Следишь за работой оборудования, управляешь процессами с пульта и проверяешь узлы в цеху. Смотришь на приборы, как в телефон, только внимательнее.",
    ctaLabel: "Хочу за пульт",
  },
  technolog: {
    description:
      "Разрабатываешь рецептуры, варишь пилотные партии и доводишь новый вкус от идеи до полки вместе с лабораторией и дегустационной комиссией.",
    ctaLabel: "Хочу создавать вкусы",
  },
  free: {
    description:
      "Не нашёл свою профессию? Придумаем задачу под тебя: маскоты и ролики, электронный курс, оцифровка линии, план оптимизации производства, работа с инженером техподдержки.",
    ctaLabel: "Предложить себя",
  },
};

export const VACANCY_META_FALLBACK: VacancyMeta = {
  description: null,
  ctaLabel: "Заполнить анкету",
};

export const VACANCY_ART_ARIA: Record<string, string> = {
  lab: "Колба и пробирки",
  rozliv: "Бутылки на конвейере",
  tech: "Варочный котёл",
  sklad: "Монитор, сканер и коробки",
  kladov: "Паллета с коробками и накладная",
  mash: "Пульт с приборами",
  technolog: "Рецепт, лимон и хмель",
  free: "Знак вопроса и стрелка роста",
};

export const VACANCY_ART_ARIA_FALLBACK = "Знак вопроса и стрелка роста";

export function vacancyMeta(slug: string): VacancyMeta {
  return VACANCY_META[slug] ?? VACANCY_META_FALLBACK;
}

export function vacancyArtAria(slug: string): string {
  return VACANCY_ART_ARIA[slug] ?? VACANCY_ART_ARIA_FALLBACK;
}

/** Раскладывает строку графика на отдельные чипы: «2/2, дневные или с ночными» → 2 чипа. */
export function scheduleChips(schedule: string | null | undefined): string[] {
  if (!schedule) {
    return [];
  }
  return schedule
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export const HH_VACANCIES_HREF = "https://hh.ru/employer/871";
export const OCHAKOVO_RABOTA_HREF = "https://ochakovo.ru/rabota/";
