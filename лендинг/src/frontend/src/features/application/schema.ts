import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { z } from "zod";
import type { PublicApplicationPayload } from "./types";

export const WHO_OPTIONS = [
  { value: "school", label: "Школьник" },
  { value: "student", label: "Студент" },
  { value: "graduate", label: "Выпускник" },
  { value: "working", label: "Работаю" },
  { value: "other", label: "Другое" },
] as const;

export const EDU_LEVEL_OPTIONS = [
  { value: "school", label: "Среднее общее (11 классов)" },
  { value: "college", label: "Колледж / техникум" },
  { value: "bachelor", label: "Бакалавриат / специалитет" },
  { value: "master", label: "Магистратура" },
  { value: "other", label: "Другое" },
] as const;

export const EMPLOYMENT_OPTIONS = [
  { value: "practice", label: "Практика" },
  { value: "internship", label: "Стажировка" },
  { value: "full", label: "Постоянная работа" },
  { value: "part", label: "Частичная занятость" },
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESUME_URL_RE = /^https?:\/\/[^\s.]+\.[^\s]{2,}/i;
const TELEGRAM_RE = /^@?[a-zA-Z][a-zA-Z0-9_]{0,63}$/;

export const AGE_MIN_PUBLIC = 18;
export const AGE_MAX = 80;

export function isValidPhone(raw: string): boolean {
  const parsed = parsePhoneNumberFromString(raw, "RU");
  return parsed !== undefined && parsed.isValid();
}

export function toE164(raw: string): string {
  return parsePhoneNumberFromString(raw, "RU")?.number ?? raw.trim();
}

/** Сегодняшняя дата по Москве в YYYY-MM-DD (граница start_date из доменного контракта). */
export function todayMoscow(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(new Date());
}

export function gradYearOptions(): ReadonlyArray<{ value: string; label: string }> {
  const current = Number(todayMoscow().slice(0, 4));
  const years: { value: string; label: string }[] = [];
  for (let year = current - 10; year <= current + 8; year += 1) {
    years.push({ value: String(year), label: String(year) });
  }
  return years.reverse();
}

const requiredName = (message: string) =>
  z
    .string()
    .trim()
    .min(1, message)
    .max(100, "Не больше 100 символов");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Не больше ${max} символов`);

const optionalEnum = (values: ReadonlyArray<string>) =>
  z.string().refine((value) => value === "" || values.includes(value), "Выбери значение из списка");

const ageField = z.string().superRefine((value, ctx) => {
  const trimmed = value.trim();
  if (trimmed === "") {
    ctx.addIssue({ code: "custom", message: "Укажи возраст" });
    return;
  }
  if (!/^\d+$/.test(trimmed)) {
    ctx.addIssue({ code: "custom", message: "Возраст — целое число" });
    return;
  }
  const age = Number(trimmed);
  if (age < AGE_MIN_PUBLIC) {
    ctx.addIssue({ code: "custom", message: "На стажировку и работу берём с 18 лет" });
    return;
  }
  if (age > AGE_MAX) {
    ctx.addIssue({ code: "custom", message: `Возраст до ${AGE_MAX}` });
  }
});

const phoneField = z
  .string()
  .trim()
  .min(1, "Проверь номер телефона")
  .refine(isValidPhone, "Проверь номер телефона");

const telegramField = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || TELEGRAM_RE.test(value),
    "Проверь ник в Telegram — например, @nickname",
  );

const emailField = z
  .string()
  .trim()
  .max(254, "Слишком длинный e-mail")
  .refine((value) => value === "" || EMAIL_RE.test(value), "Проверь e-mail");

const resumeUrlField = z
  .string()
  .trim()
  .max(500, "Не больше 500 символов")
  .refine((value) => value === "" || RESUME_URL_RE.test(value), "Нужна ссылка, начинающаяся с https://");

const startDateField = z.string().refine(
  (value) => value === "" || value >= todayMoscow(),
  "Выбери сегодняшнюю или будущую дату",
);

export const applicationSchema = z.object({
  last_name: requiredName("Напиши фамилию"),
  first_name: requiredName("Напиши имя"),
  middle_name: optionalText(100),
  age: ageField,
  who: z.string().refine(
    (value): boolean => WHO_OPTIONS.some((option) => option.value === value),
    "Выбери, кто ты сейчас",
  ),
  phone: phoneField,
  telegram: telegramField,
  email: emailField,
  edu_level: optionalEnum(EDU_LEVEL_OPTIONS.map((option) => option.value)),
  school: optionalText(200),
  specialty: optionalText(200),
  grad_year: optionalEnum(gradYearOptions().map((option) => option.value)),
  vacancy_id: z.string().min(1, "Выбери вакансию"),
  employment: optionalEnum(EMPLOYMENT_OPTIONS.map((option) => option.value)),
  start_date: startDateField,
  shifts: optionalText(200),
  resume_url: resumeUrlField,
  experience: optionalText(2000),
  about: optionalText(2000),
  consent: z.boolean().refine((value) => value, "Без согласия мы не сможем сохранить анкету"),
});

export type ApplicationFormValues = z.infer<typeof applicationSchema>;

export const HONEYPOT_FIELD = "website";

export function buildPayload(
  values: ApplicationFormValues,
  event: string,
  privacyRevision: number,
): PublicApplicationPayload {
  const telegram = values.telegram.replace(/^@+/, "");
  const payload: PublicApplicationPayload = {
    last_name: values.last_name,
    first_name: values.first_name,
    phone: toE164(values.phone),
    age: Number(values.age.trim()),
    who: values.who as PublicApplicationPayload["who"],
    vacancy_id: values.vacancy_id,
    consent: true,
    privacy_revision: privacyRevision,
  };
  const extras: Partial<PublicApplicationPayload> = {};
  if (values.middle_name !== "") extras.middle_name = values.middle_name;
  if (telegram !== "") extras.telegram = `@${telegram}`;
  if (values.email !== "") extras.email = values.email;
  if (values.edu_level !== "") extras.edu_level = values.edu_level as PublicApplicationPayload["edu_level"];
  if (values.school !== "") extras.school = values.school;
  if (values.specialty !== "") extras.specialty = values.specialty;
  if (values.grad_year !== "") extras.grad_year = Number(values.grad_year);
  if (values.employment !== "") {
    extras.employment = values.employment as PublicApplicationPayload["employment"];
  }
  if (values.start_date !== "") extras.start_date = values.start_date;
  if (values.shifts !== "") extras.shifts = values.shifts;
  if (values.resume_url !== "") extras.resume_url = values.resume_url;
  if (values.experience !== "") extras.experience = values.experience;
  if (values.about !== "") extras.about = values.about;
  if (event !== "") extras.event = event.slice(0, 100);
  return { ...payload, ...extras };
}
