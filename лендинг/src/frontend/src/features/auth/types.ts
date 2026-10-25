/*
 * Локальные типы auth-шва. Источник — backend/app/api/auth.py (T3):
 * EmployeeView (login) и MeView (= EmployeeView + csrf_token, GET /auth/me).
 * Поле должности в API называется `position` (НЕ job_title);
 * смена пароля — `current_password` (НЕ old_password).
 * schema.d.ts пока без /api/v1/auth/* — T9/T11 переведут на типизированный client.
 */

export type EmployeeRole = "staff" | "admin";
export type EmployeeState = "pending" | "active" | "rejected" | "disabled";

export interface EmployeeView {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  position: string;
  role: EmployeeRole;
  state: EmployeeState;
  must_change_password: boolean;
}

export interface MeView extends EmployeeView {
  csrf_token: string;
}

export interface ApiErrorEnvelope {
  code?: string;
  message?: string;
  field_errors?: Record<string, string>;
  request_id?: string;
}

export type AccountStateCode = "ACCOUNT_PENDING" | "ACCOUNT_REJECTED" | "ACCOUNT_DISABLED";
