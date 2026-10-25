import type { Stage } from "./types";

export const SOURCE_LABELS: Record<string, string> = {
  public_form: "Анкета на сайте",
  phone: "По телефону",
  walk_in: "Пришёл лично",
  referral: "По рекомендации",
  job_site: "Сайт вакансий",
  other: "Другое",
};

export const WHO_LABELS: Record<string, string> = {
  school: "Школьник",
  student: "Студент",
  graduate: "Выпускник",
  working: "Работаю",
  other: "Другое",
};

export const EDU_LABELS: Record<string, string> = {
  school: "Среднее общее (11 классов)",
  college: "Колледж / техникум",
  bachelor: "Бакалавриат / специалитет",
  master: "Магистратура",
  other: "Другое",
};

export const EMPLOYMENT_LABELS: Record<string, string> = {
  full: "Постоянная работа",
  part: "Частичная занятость",
  practice: "Практика",
  internship: "Стажировка",
};

export const PRIORITY_LABELS: Record<string, string> = {
  normal: "Обычный",
  high: "Высокий",
};

export const STAGE_VALUES: readonly Stage[] = [
  "application",
  "new",
  "review",
  "interview",
  "offer",
  "hired",
  "reject",
  "withdrawn",
] as const;

const MOSCOW_PARTS = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** «Дата добавления» из плана: ДД.ММ.ГГГГ ЧЧ:ММ МСК. */
export function formatMoscow(iso: string): string {
  const parts = MOSCOW_PARTS.formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}.${get("month")}.${get("year")} ${get("hour")}:${get("minute")} МСК`;
}

export function formatMoscowDateOnly(iso: string): string {
  const parts = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}.${get("month")}.${get("year")}`;
}

/** datetime-local «2026-10-24T14:00» → ISO с фиксированным московским смещением +03:00. */
export function localInputToMoscowIso(value: string): string | null {
  if (value.trim() === "") {
    return null;
  }
  const suffix = value.length === 16 ? ":00+03:00" : "+03:00";
  return `${value}${suffix}`;
}

export function isoToLocalInput(iso: string | null): string {
  if (!iso) {
    return "";
  }
  return iso.slice(0, 16);
}

export function fullName(candidate: { last_name: string; first_name: string; middle_name?: string | null }): string {
  return [candidate.last_name, candidate.first_name, candidate.middle_name].filter(Boolean).join(" ");
}

export function ratingStars(rating: number): string {
  return "★".repeat(rating) + "☆".repeat(Math.max(0, 5 - rating));
}
