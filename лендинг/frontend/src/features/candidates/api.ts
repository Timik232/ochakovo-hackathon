import { csrfHeaders } from "../auth/api";
import {
  CandidatesApiError,
  type ApiErrorEnvelope,
  type CandidateListFiltersLike,
  type CandidatePage,
  type CandidateView,
  type CommentPage,
  type CommentView,
  type StaffOption,
  type VacancyView,
} from "./types";
import { listApiQuery } from "./urlState";

const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

const CANDIDATES_URL = `${baseUrl}/api/v1/candidates`;

async function toApiError(response: Response): Promise<CandidatesApiError> {
  const envelope = (await response.json().catch(() => ({}))) as ApiErrorEnvelope;
  return new CandidatesApiError(response.status, envelope);
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw await toApiError(response);
  }
  return (await response.json()) as T;
}

async function sendJson<T>(
  url: string,
  method: "POST" | "PATCH",
  body: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...csrfHeaders() },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await toApiError(response);
  }
  return (await response.json()) as T;
}

export function fetchCandidates(filters: CandidateListFiltersLike): Promise<CandidatePage> {
  return getJson(`${CANDIDATES_URL}?${listApiQuery(filters)}`);
}

/** Только total для счётчика таба: page_size из контракта (20/50/100), 1 запрещён бэкендом. */
export async function fetchCandidatesCount(archived: "0" | "1"): Promise<number> {
  const page = await getJson<CandidatePage>(
    `${CANDIDATES_URL}?archived=${archived}&sort=created_at&direction=desc&page=1&page_size=20`,
  );
  return page.total;
}

export function fetchCandidate(id: string): Promise<CandidateView> {
  return getJson(`${CANDIDATES_URL}/${id}`);
}

export function createCandidate(payload: Record<string, unknown>): Promise<CandidateView> {
  return sendJson(CANDIDATES_URL, "POST", payload);
}

export function updateCandidate(
  id: string,
  payload: Record<string, unknown> & { version: number },
): Promise<CandidateView> {
  return sendJson(`${CANDIDATES_URL}/${id}`, "PATCH", payload);
}

export async function deleteCandidate(id: string, version: number): Promise<void> {
  const response = await fetch(`${CANDIDATES_URL}/${id}`, {
    method: "DELETE",
    headers: { "If-Match": `"${version}"`, ...csrfHeaders() },
  });
  if (response.status !== 204 && !response.ok) {
    throw await toApiError(response);
  }
}

export function fetchComments(id: string): Promise<CommentPage> {
  return getJson(`${CANDIDATES_URL}/${id}/comments`);
}

export function addComment(id: string, body: string): Promise<CommentView> {
  return sendJson(`${CANDIDATES_URL}/${id}/comments`, "POST", { body });
}

export interface BulkActionInput {
  ids: string[];
  action: "archive" | "restore" | "stage";
  stage?: CandidateView["status"];
}

export function bulkCandidates(payload: BulkActionInput): Promise<{ updated: number }> {
  return sendJson(`${CANDIDATES_URL}/bulk`, "POST", payload);
}

export function fetchVacancies(): Promise<VacancyView[]> {
  return getJson(`${baseUrl}/api/v1/vacancies`);
}

export function fetchStaffOptions(): Promise<StaffOption[]> {
  return getJson(`${baseUrl}/api/v1/employees/options`);
}

function fileNameFromDisposition(header: string | null): string {
  const match = header?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? "candidates.csv";
}

export async function exportCandidatesCsv(
  filters: CandidateListFiltersLike,
): Promise<{ blob: Blob; fileName: string }> {
  const response = await fetch(`${CANDIDATES_URL}/export.csv?${listApiQuery(filters, false)}`);
  if (!response.ok) {
    throw await toApiError(response);
  }
  return {
    blob: await response.blob(),
    fileName: fileNameFromDisposition(response.headers.get("Content-Disposition")),
  };
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
