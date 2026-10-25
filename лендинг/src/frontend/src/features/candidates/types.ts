import type { components } from "../../api/schema";

export type CandidateView = components["schemas"]["CandidateView"];
export type CandidateCreate = components["schemas"]["CandidateCreate"];
export type CandidatePatch = components["schemas"]["CandidatePatch"];
export type CandidatePage = components["schemas"]["CandidatePage"];
export type CommentView = components["schemas"]["CommentView"];
export type CommentPage = components["schemas"]["CommentPage"];
export type VacancyView = components["schemas"]["VacancyView"];
export type StaffOption = components["schemas"]["StaffOption"];

export type Stage = components["schemas"]["CandidateView"]["status"];
export type StaffSource = Exclude<CandidateView["source"], "public_form">;
export type Who = NonNullable<CandidateView["who"]>;
export type Education = NonNullable<CandidateView["edu_level"]>;
export type Employment = NonNullable<CandidateView["employment"]>;

export interface CandidateListFiltersLike {
  q: string;
  status: Stage[];
  vacancyId: string[];
  hot: boolean;
  archived: "0" | "1" | "all";
  sort: string;
  direction: string;
  page: number;
}

/** Единая ошибка API-шва кандидатов: конверт + коды вида VERSION_CONFLICT. */
export interface ApiErrorEnvelope {
  code?: string;
  message?: string;
  field_errors?: Record<string, string[]>;
  request_id?: string;
}

export class CandidatesApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly envelope: ApiErrorEnvelope,
  ) {
    super(envelope.message ?? `Ошибка ${status}`);
  }

  get code(): string | undefined {
    return this.envelope.code;
  }

  get isVersionConflict(): boolean {
    return this.status === 409 && this.envelope.code === "VERSION_CONFLICT";
  }
}
