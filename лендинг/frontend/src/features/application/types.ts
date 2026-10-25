/*
 * Локальные типы публичного контракта T7 (план, amendment v4).
 *
 * ВНИМАНИЕ (T9): schema.d.ts пока не содержит /api/v1/public/* — T5 добавляет
 * backend параллельно. Этот модуль — единственный «шов» к API: когда
 * openapi-typescript сгенерирует пути, заменить реализации в ./api на
 * типизированные вызовы apiClient и сверить имена полей с Pydantic-схемами.
 */

export interface PublicVacancy {
  id: string;
  slug: string;
  title: string;
  dept: string | null;
  pay: string | null;
  schedule?: string | null;
  icon?: string | null;
}

/** GET /api/v1/public/privacy — только опубликованные данные + состояние приёма. */
export interface PublicPrivacy {
  collection_enabled: boolean;
  revision: number; // backend PublicPrivacy.revision: int (0 = не опубликована)
  notice: string | null;
  consent: string | null;
}

export type WhoValue = "school" | "student" | "graduate" | "working" | "other";
export type EduLevel = "school" | "college" | "bachelor" | "master" | "other";
export type Employment = "full" | "part" | "practice" | "internship";

/** Тело POST /api/v1/public/applications — ТОЛЬКО публичные поля доменного контракта. */
export interface PublicApplicationPayload {
  last_name: string;
  first_name: string;
  middle_name?: string;
  phone: string; // E.164
  telegram?: string; // «@nickname»
  email?: string;
  age: number; // 18–80 в публичной анкете
  who: WhoValue;
  edu_level?: EduLevel;
  school?: string;
  specialty?: string;
  grad_year?: number;
  vacancy_id: string;
  employment?: Employment;
  start_date?: string; // YYYY-MM-DD
  shifts?: string;
  resume_url?: string;
  experience?: string;
  about?: string;
  event?: string; // из ?e=, пользователь не вводит руками
  consent: true;
  privacy_revision: number; // текущая редакция политики из GET /public/privacy
}

/** Общий JSON-конверт ошибок API (план: {code, message, field_errors?, request_id}). */
export interface ApiErrorEnvelope {
  code?: string;
  message?: string;
  field_errors?: Record<string, string>;
  request_id?: string;
}
