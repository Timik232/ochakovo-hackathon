import { useQuery } from "@tanstack/react-query";
import { fetchCandidatesCount, fetchStaffOptions, fetchVacancies } from "./api";

export const CANDIDATES_KEY = ["candidates"] as const;
export const VACANCIES_KEY = ["vacancies"] as const;
export const STAFF_OPTIONS_KEY = ["staff-options"] as const;

export function useVacancies() {
  return useQuery({ queryKey: VACANCIES_KEY, queryFn: fetchVacancies });
}

export function useStaffOptions() {
  return useQuery({ queryKey: STAFF_OPTIONS_KEY, queryFn: fetchStaffOptions });
}

/** Счётчик для таба «Активные/Архив»: отдельные параллельные запросы total. */
export function useCandidatesCount(archived: "0" | "1") {
  return useQuery({
    queryKey: [...CANDIDATES_KEY, "count", archived],
    queryFn: () => fetchCandidatesCount(archived),
  });
}

export function vacancyTitleMap(vacancies: { id: string; title: string }[] | undefined): Map<string, string> {
  return new Map((vacancies ?? []).map((vacancy) => [vacancy.id, vacancy.title]));
}

export function staffNameMap(options: { id: string; name: string }[] | undefined): Map<string, string> {
  return new Map((options ?? []).map((option) => [option.id, option.name]));
}
