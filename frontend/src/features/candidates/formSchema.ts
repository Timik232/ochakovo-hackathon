import { z } from "zod";
import { isValidPhone, toE164 } from "../application/schema";

const requiredName = (message: string) =>
  z.string().trim().min(1, message).max(100, "Не больше 100 символов");

const optionalText = (max: number) => z.string().trim().max(max, `Не больше ${max} символов`);

const optionalEnum = (values: readonly string[], message = "Выбери значение из списка") =>
  z.string().refine((value) => value === "" || values.includes(value), message);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESUME_URL_RE = /^https?:\/\/[^\s.]+\.[^\s]{2,}/i;
const TELEGRAM_RE = /^@?[a-zA-Z][a-zA-Z0-9_]{0,63}$/;

const optionalUuid = z
  .string()
  .refine((value) => value === "" || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value), "Выбери значение из списка");

export const STAFF_SOURCES = [
  { value: "phone", label: "По телефону" },
  { value: "walk_in", label: "Пришёл лично" },
  { value: "referral", label: "По рекомендации" },
  { value: "job_site", label: "Сайт вакансий" },
  { value: "other", label: "Другое" },
] as const;

export const STAGES = [
  "application",
  "new",
  "review",
  "interview",
  "offer",
  "hired",
  "reject",
  "withdrawn",
] as const;

export const WHO_VALUES = ["school", "student", "graduate", "working", "other"] as const;
export const EDU_VALUES = ["school", "college", "bachelor", "master", "other"] as const;
export const EMPLOYMENT_VALUES = ["full", "part", "practice", "internship"] as const;

const optionalAge = z
  .string()
  .trim()
  .refine((value) => value === "" || (/^\d+$/.test(value) && Number(value) >= 14 && Number(value) <= 80), "Возраст от 14 до 80");

const optionalGradYear = z
  .string()
  .trim()
  .refine((value) => value === "" || (/^\d{4}$/.test(value) && Number(value) >= 1950 && Number(value) <= 2100), "Год выпуска 1950–2100");

const optionalSalary = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^\d{1,8}([.,]\d{1,2})?$/.test(value),
    "Сумма до 100 000 000, до двух копеек",
  );

const optionalPhone = z
  .string()
  .trim()
  .refine((value) => isValidPhone(value), "Введите телефон в формате +7…");

const optionalDateTimeLocal = z
  .string()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value), "Укажите дату и время");

const optionalDate = z
  .string()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Укажите дату");

export const candidateFormSchema = z
  .object({
    last_name: requiredName("Укажите фамилию"),
    first_name: requiredName("Укажите имя"),
    middle_name: optionalText(100),
    phone: optionalPhone,
    telegram: z
      .string()
      .trim()
      .refine((value) => value === "" || TELEGRAM_RE.test(value), "Telegram: латиница, цифры и _"),
    email: z.string().trim().refine((value) => value === "" || EMAIL_RE.test(value), "Похоже на опечатку в e-mail"),
    age: optionalAge,
    who: optionalEnum(WHO_VALUES),
    edu_level: optionalEnum(EDU_VALUES),
    school: optionalText(200),
    specialty: optionalText(200),
    grad_year: optionalGradYear,
    vacancy_id: optionalUuid,
    position: optionalText(150),
    city: optionalText(100),
    employment: optionalEnum(EMPLOYMENT_VALUES),
    start_date: optionalDate,
    shifts: optionalText(200),
    resume_url: z
      .string()
      .trim()
      .refine((value) => value === "" || RESUME_URL_RE.test(value), "Ссылка должна начинаться с http:// или https://"),
    experience: optionalText(2000),
    about: optionalText(2000),
    event: optionalText(100),
    status: optionalEnum(STAGES),
    source: optionalEnum(STAFF_SOURCES.map((option) => option.value)),
    processing_basis: z.enum(["candidate_consent", "other_documented_basis"]),
    processing_basis_note: optionalText(500),
    department: optionalText(150),
    responsible_id: optionalUuid,
    priority: optionalEnum(["normal", "high"]),
    expected_salary: optionalSalary,
    interview_at: optionalDateTimeLocal,
    next_contact_at: optionalDateTimeLocal,
    hot: z.boolean(),
    rating: z
      .string()
      .refine((value) => /^\d$/.test(value) && Number(value) >= 0 && Number(value) <= 5, "Оценка 0–5"),
    next_step: optionalText(500),
  })
  .superRefine((values, ctx) => {
    if (values.processing_basis === "other_documented_basis" && values.processing_basis_note === "") {
      ctx.addIssue({
        code: "custom",
        path: ["processing_basis_note"],
        message: "Опишите документальное основание обработки",
      });
    }
  });

export type CandidateFormValues = z.infer<typeof candidateFormSchema>;

export const EMPTY_FORM_VALUES: CandidateFormValues = {
  last_name: "",
  first_name: "",
  middle_name: "",
  phone: "",
  telegram: "",
  email: "",
  age: "",
  who: "",
  edu_level: "",
  school: "",
  specialty: "",
  grad_year: "",
  vacancy_id: "",
  position: "",
  city: "",
  employment: "",
  start_date: "",
  shifts: "",
  resume_url: "",
  experience: "",
  about: "",
  event: "",
  status: "new",
  source: "phone",
  processing_basis: "candidate_consent",
  processing_basis_note: "",
  department: "",
  responsible_id: "",
  priority: "normal",
  expected_salary: "",
  interview_at: "",
  next_contact_at: "",
  hot: false,
  rating: "0",
  next_step: "",
};

function nullIfEmpty(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function formToCreatePayload(values: CandidateFormValues): Record<string, unknown> {
  return {
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    middle_name: nullIfEmpty(values.middle_name),
    phone: toE164(values.phone),
    telegram: nullIfEmpty(values.telegram)?.replace(/^@/, "") ?? null,
    email: nullIfEmpty(values.email),
    age: values.age === "" ? null : Number(values.age),
    who: nullIfEmpty(values.who),
    edu_level: nullIfEmpty(values.edu_level),
    school: nullIfEmpty(values.school),
    specialty: nullIfEmpty(values.specialty),
    grad_year: values.grad_year === "" ? null : Number(values.grad_year),
    vacancy_id: nullIfEmpty(values.vacancy_id),
    position: nullIfEmpty(values.position),
    city: nullIfEmpty(values.city),
    employment: nullIfEmpty(values.employment),
    start_date: nullIfEmpty(values.start_date),
    shifts: nullIfEmpty(values.shifts),
    resume_url: nullIfEmpty(values.resume_url),
    experience: nullIfEmpty(values.experience),
    about: nullIfEmpty(values.about),
    event: nullIfEmpty(values.event),
    status: values.status,
    source: values.source,
    processing_basis: values.processing_basis,
    processing_basis_note:
      values.processing_basis === "other_documented_basis" ? values.processing_basis_note.trim() : null,
    department: nullIfEmpty(values.department),
    responsible_id: nullIfEmpty(values.responsible_id),
    priority: values.priority === "" ? "normal" : values.priority,
    expected_salary: values.expected_salary === "" ? null : values.expected_salary.replace(",", "."),
    interview_at: values.interview_at === "" ? null : `${values.interview_at}:00+03:00`,
    next_contact_at: values.next_contact_at === "" ? null : `${values.next_contact_at}:00+03:00`,
    hot: values.hot,
    rating: Number(values.rating),
    next_step: nullIfEmpty(values.next_step),
  };
}

export function formToPatchPayload(
  values: CandidateFormValues,
  version: number,
): Record<string, unknown> & { version: number } {
  const payload = formToCreatePayload(values);
  delete payload.source;
  delete payload.processing_basis;
  delete payload.processing_basis_note;
  return { ...payload, version };
}
