import type { AuditAction, EmployeeState } from "./types";

export const EMPLOYEE_STATES: readonly EmployeeState[] = ["pending", "active", "rejected", "disabled"];

export interface EmployeeListFilters {
  state: EmployeeState;
  q: string;
  page: number;
}

export const DEFAULT_EMPLOYEE_FILTERS: EmployeeListFilters = {
  state: "pending",
  q: "",
  page: 1,
};

export function parseEmployeeFilters(params: URLSearchParams): EmployeeListFilters {
  const state = params.get("state");
  return {
    state: EMPLOYEE_STATES.includes(state as EmployeeState) ? (state as EmployeeState) : "pending",
    q: params.get("q") ?? "",
    page: Math.max(1, Number(params.get("page")) || 1),
  };
}

/** Как в T9: значения по умолчанию не пишутся в адрес — таб шарится голой ссылкой. */
export function serializeEmployeeFilters(filters: EmployeeListFilters): string {
  const params = new URLSearchParams();
  if (filters.state !== DEFAULT_EMPLOYEE_FILTERS.state) {
    params.set("state", filters.state);
  }
  if (filters.q.trim() !== "") {
    params.set("q", filters.q.trim());
  }
  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }
  return params.toString();
}

export function employeesApiQuery(filters: EmployeeListFilters): string {
  const params = new URLSearchParams();
  params.set("state", filters.state);
  const q = filters.q.trim();
  if (q !== "") {
    params.set("q", q);
  }
  params.set("page", String(filters.page));
  params.set("page_size", "20");
  return params.toString();
}

export interface AuditFilters {
  action: AuditAction | "";
  actorId: string;
  dateFrom: string;
  dateTo: string;
  page: number;
}

export const DEFAULT_AUDIT_FILTERS: AuditFilters = {
  action: "",
  actorId: "",
  dateFrom: "",
  dateTo: "",
  page: 1,
};

export function parseAuditFilters(params: URLSearchParams): AuditFilters {
  const action = params.get("action");
  const actorId = params.get("actor_id") ?? "";
  return {
    action: action !== null && action in AUDIT_ACTIONS_SET ? (action as AuditAction) : "",
    actorId: /^[0-9a-f-]{36}$/i.test(actorId) ? actorId : "",
    dateFrom: /^\d{4}-\d{2}-\d{2}$/.test(params.get("date_from") ?? "") ? params.get("date_from")! : "",
    dateTo: /^\d{4}-\d{2}-\d{2}$/.test(params.get("date_to") ?? "") ? params.get("date_to")! : "",
    page: Math.max(1, Number(params.get("page")) || 1),
  };
}

const AUDIT_ACTIONS_SET: Record<string, true> = {
  bootstrap_admin: true,
  promote_admin: true,
  reset_password: true,
  password_change: true,
  privacy_activate: true,
  intake_disable: true,
  retention_delete: true,
  create: true,
  update: true,
  delete: true,
  comment: true,
  approve: true,
  reject: true,
  disable: true,
  reactivate: true,
  register: true,
  login: true,
  logout: true,
};

export function serializeAuditFilters(filters: AuditFilters): string {
  const params = new URLSearchParams();
  if (filters.action !== "") {
    params.set("action", filters.action);
  }
  if (filters.actorId !== "") {
    params.set("actor_id", filters.actorId);
  }
  if (filters.dateFrom !== "") {
    params.set("date_from", filters.dateFrom);
  }
  if (filters.dateTo !== "") {
    params.set("date_to", filters.dateTo);
  }
  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }
  return params.toString();
}

export function auditApiQuery(filters: AuditFilters): string {
  const params = new URLSearchParams();
  if (filters.action !== "") {
    params.set("action", filters.action);
  }
  if (filters.actorId !== "") {
    params.set("actor_id", filters.actorId);
  }
  if (filters.dateFrom !== "") {
    params.set("date_from", filters.dateFrom);
  }
  if (filters.dateTo !== "") {
    params.set("date_to", filters.dateTo);
  }
  params.set("page", String(filters.page));
  params.set("page_size", "20");
  return params.toString();
}
