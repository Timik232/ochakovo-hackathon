import { csrfHeaders } from "../auth/api";
import {
  AdminApiError,
  type AdminEmployee,
  type ApiErrorEnvelope,
  type AuditPage,
  type EmployeePage,
  type PublicPrivacy,
  type VacancyView,
} from "./types";
import { employeesApiQuery, auditApiQuery, type AuditFilters, type EmployeeListFilters } from "./urlState";

const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

const ADMIN_URL = `${baseUrl}/api/v1/admin`;
const VACANCIES_URL = `${baseUrl}/api/v1/vacancies`;

async function toApiError(response: Response): Promise<AdminApiError> {
  const envelope = (await response.json().catch(() => ({}))) as ApiErrorEnvelope;
  return new AdminApiError(response.status, envelope);
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw await toApiError(response);
  }
  return (await response.json()) as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...csrfHeaders() },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await toApiError(response);
  }
  return (await response.json().catch(() => null)) as T;
}

async function patchJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...csrfHeaders() },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await toApiError(response);
  }
  return (await response.json()) as T;
}

export function fetchEmployees(filters: EmployeeListFilters): Promise<EmployeePage> {
  return getJson(`${ADMIN_URL}/employees?${employeesApiQuery(filters)}`);
}

export function approveEmployee(id: string): Promise<AdminEmployee> {
  return postJson(`${ADMIN_URL}/employees/${id}/approve`, {});
}

export function rejectEmployee(id: string): Promise<AdminEmployee> {
  return postJson(`${ADMIN_URL}/employees/${id}/reject`, {});
}

export function disableEmployee(id: string): Promise<AdminEmployee> {
  return postJson(`${ADMIN_URL}/employees/${id}/disable`, {});
}

export function reactivateEmployee(id: string): Promise<AdminEmployee> {
  return postJson(`${ADMIN_URL}/employees/${id}/reactivate`, {});
}

export async function resetEmployeePassword(id: string, newPassword: string): Promise<null> {
  await postJson(`${ADMIN_URL}/employees/${id}/reset-password`, { new_password: newPassword });
  return null;
}

export function fetchAudit(filters: AuditFilters): Promise<AuditPage> {
  return getJson(`${ADMIN_URL}/audit?${auditApiQuery(filters)}`);
}

export function disableIntake(): Promise<{ message: string }> {
  return postJson(`${ADMIN_URL}/intake/disable`, {});
}

export function fetchIntakeState(): Promise<PublicPrivacy> {
  return getJson(`${baseUrl}/api/v1/public/privacy`);
}

export function fetchAdminVacancies(): Promise<VacancyView[]> {
  return getJson(VACANCIES_URL);
}

export function createAdminVacancy(payload: {
  slug: string;
  title: string;
  dept: string;
  pay: string;
  schedule: string;
  icon: string;
}): Promise<VacancyView> {
  return postJson(VACANCIES_URL, payload);
}

export function setVacancyActive(id: string, isActive: boolean): Promise<VacancyView> {
  return patchJson(`${VACANCIES_URL}/${id}`, { is_active: isActive });
}
