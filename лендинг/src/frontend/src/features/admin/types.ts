import type { components } from "../../api/schema";

export type AdminEmployee = components["schemas"]["AdminEmployee"];
export type EmployeePage = components["schemas"]["EmployeePage"];
export type AuditView = components["schemas"]["AuditView"];
export type AuditPage = components["schemas"]["AuditPage"];
export type VacancyView = components["schemas"]["VacancyView"];
export type StaffOption = components["schemas"]["StaffOption"];
export type PublicPrivacy = components["schemas"]["PublicPrivacy"];

export type EmployeeState = "pending" | "active" | "rejected" | "disabled";

/** Допустимые переходы 1:1 backend/app/services/employees.py change_state. */
export type EmployeeAction = "approve" | "reject" | "disable" | "reactivate";

export type AuditAction =
  | "bootstrap_admin"
  | "promote_admin"
  | "reset_password"
  | "password_change"
  | "privacy_activate"
  | "intake_disable"
  | "retention_delete"
  | "create"
  | "update"
  | "delete"
  | "comment"
  | "approve"
  | "reject"
  | "disable"
  | "reactivate"
  | "register"
  | "login"
  | "logout";

/** Единая ошибка API-шва админки: конверт + коды вида LAST_ADMIN. */
export interface ApiErrorEnvelope {
  code?: string;
  message?: string;
  field_errors?: Record<string, string[]>;
  request_id?: string;
}

export class AdminApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly envelope: ApiErrorEnvelope,
  ) {
    super(envelope.message ?? `Ошибка ${status}`);
  }

  get code(): string | undefined {
    return this.envelope.code;
  }

  get isLastAdmin(): boolean {
    return this.status === 409 && this.envelope.code === "LAST_ADMIN";
  }

  get isStateConflict(): boolean {
    return this.status === 409 && this.envelope.code === "EMPLOYEE_STATE_CONFLICT";
  }
}
