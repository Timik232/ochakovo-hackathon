import type { Stage } from "./types";
import { STAGE_VALUES } from "./format";

export type SortField = "created_at" | "updated_at" | "last_name" | "status" | "next_contact_at";
export type SortDirection = "asc" | "desc";
export type ArchivedFilter = "0" | "1" | "all";

export interface CandidateListFilters {
  q: string;
  status: Stage[];
  vacancyId: string[];
  hot: boolean;
  archived: ArchivedFilter;
  sort: SortField;
  direction: SortDirection;
  page: number;
}

export const DEFAULT_LIST_FILTERS: CandidateListFilters = {
  q: "",
  status: [],
  vacancyId: [],
  hot: false,
  archived: "0",
  sort: "created_at",
  direction: "desc",
  page: 1,
};

const SORT_FIELDS: readonly SortField[] = [
  "created_at",
  "updated_at",
  "last_name",
  "status",
  "next_contact_at",
];
const SORT_DIRECTIONS: readonly SortDirection[] = ["asc", "desc"];

function parseSort(raw: string | null): { sort: SortField; direction: SortDirection } {
  if (raw === null) {
    return { sort: DEFAULT_LIST_FILTERS.sort, direction: DEFAULT_LIST_FILTERS.direction };
  }
  const dot = raw.lastIndexOf(".");
  const field = dot === -1 ? raw : raw.slice(0, dot);
  const dir = dot === -1 ? "" : raw.slice(dot + 1);
  if (SORT_FIELDS.includes(field as SortField) && SORT_DIRECTIONS.includes(dir as SortDirection)) {
    return { sort: field as SortField, direction: dir as SortDirection };
  }
  return { sort: DEFAULT_LIST_FILTERS.sort, direction: DEFAULT_LIST_FILTERS.direction };
}

export function parseListFilters(params: URLSearchParams): CandidateListFilters {
  const { sort, direction } = parseSort(params.get("sort"));
  const status = params
    .getAll("status")
    .filter((value): value is Stage => (STAGE_VALUES as readonly string[]).includes(value));
  const vacancyId = params.getAll("vacancy_id").filter((value) => value !== "");
  const archivedRaw = params.get("archived");
  return {
    q: params.get("q") ?? "",
    status: [...new Set(status)],
    vacancyId: [...new Set(vacancyId)],
    hot: params.get("hot") === "1",
    archived: archivedRaw === "1" || archivedRaw === "all" ? archivedRaw : "0",
    sort,
    direction,
    page: Math.max(1, Number(params.get("page")) || 1),
  };
}

/**
 * URL — единственный источник правды: значения по умолчанию не пишутся в адрес,
 * поэтому «Сбросить фильтры» = голый /candidates, а reload/deep-link/back-forward
 * восстанавливают состояние ровно один-к-одному.
 */
export function serializeListFilters(filters: CandidateListFilters): string {
  const params = new URLSearchParams();
  if (filters.q.trim() !== "") {
    params.set("q", filters.q.trim());
  }
  for (const status of filters.status) {
    params.append("status", status);
  }
  for (const vacancy of filters.vacancyId) {
    params.append("vacancy_id", vacancy);
  }
  if (filters.hot) {
    params.set("hot", "1");
  }
  if (filters.archived !== DEFAULT_LIST_FILTERS.archived) {
    params.set("archived", filters.archived);
  }
  if (filters.sort !== DEFAULT_LIST_FILTERS.sort || filters.direction !== DEFAULT_LIST_FILTERS.direction) {
    params.set("sort", `${filters.sort}.${filters.direction}`);
  }
  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }
  return params.toString();
}

export function isDefaultListFilters(filters: CandidateListFilters): boolean {
  return serializeListFilters(filters) === "";
}

/** Query-string для API: повторенные ключи status[]/vacancy_id[], фиксированный page_size=20. */
export function listApiQuery(
  filters: {
    q: string;
    status: Stage[];
    vacancyId: string[];
    hot: boolean;
    archived: "0" | "1" | "all";
    sort: string;
    direction: string;
    page: number;
  },
  withPagination = true,
): string {
  const params = new URLSearchParams();
  const q = filters.q.trim();
  if (q !== "") {
    params.set("q", q);
  }
  for (const status of filters.status) {
    params.append("status[]", status);
  }
  for (const vacancy of filters.vacancyId) {
    params.append("vacancy_id[]", vacancy);
  }
  if (filters.hot) {
    params.set("hot", "true");
  }
  if (filters.archived !== "0") {
    params.set("archived", filters.archived);
  }
  params.set("sort", filters.sort);
  params.set("direction", filters.direction);
  if (withPagination) {
    params.set("page", String(filters.page));
    params.set("page_size", "20");
  }
  return params.toString();
}
