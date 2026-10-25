import type { ApiErrorEnvelope, PublicApplicationPayload, PublicPrivacy, PublicVacancy } from "./types";

/*
 * Единственный «шов» к публичному API. Пока schema.d.ts без /api/v1/public/*
 * (T5 в параллельной работе), ходим через fetch с тем же baseUrl, что и
 * api/client.ts. T9: заменить на типизированные вызовы apiClient.
 */

const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

export class PublicApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly envelope: ApiErrorEnvelope,
  ) {
    super(envelope.message ?? `Ошибка ${status}`);
  }
}

export async function fetchPublicVacancies(): Promise<PublicVacancy[]> {
  const response = await fetch(`${baseUrl}/api/v1/public/vacancies`);
  if (!response.ok) {
    throw new PublicApiError(response.status, await readEnvelope(response));
  }
  return (await response.json()) as PublicVacancy[];
}

/** null — политика ещё не опубликована (404). */
export async function fetchPublicPrivacy(): Promise<PublicPrivacy | null> {
  const response = await fetch(`${baseUrl}/api/v1/public/privacy`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new PublicApiError(response.status, await readEnvelope(response));
  }
  return (await response.json()) as PublicPrivacy;
}

export type SubmitResult =
  | { ok: true; message: string }
  | { ok: false; kind: "validation"; message: string; fieldErrors: Record<string, string> }
  | { ok: false; kind: "rate_limited"; message: string; retryAfterSeconds: number | null }
  | { ok: false; kind: "intake_closed"; message: string }
  | { ok: false; kind: "revision_changed"; message: string }
  | { ok: false; kind: "http_error"; message: string }
  | { ok: false; kind: "network"; message: string };

export async function submitApplication(
  payload: PublicApplicationPayload,
  idempotencyKey: string,
): Promise<SubmitResult> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/v1/public/applications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, kind: "network", message: "Нет связи с сервером" };
  }

  if (response.ok) {
    const envelope = (await response.json().catch(() => ({}))) as { message?: string };
    return { ok: true, message: envelope.message ?? "Анкета принята" };
  }

  const envelope = await readEnvelope(response);
  const message = envelope.message ?? `Ошибка ${response.status}`;

  switch (response.status) {
    case 422:
      return {
        ok: false,
        kind: "validation",
        message,
        fieldErrors: envelope.field_errors ?? {},
      };
    case 429: {
      const retryAfter = Number(response.headers.get("Retry-After"));
      return {
        ok: false,
        kind: "rate_limited",
        message,
        retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
      };
    }
    case 503:
      return { ok: false, kind: "intake_closed", message };
    case 409:
      return envelope.code === "PRIVACY_REVISION_CHANGED"
        ? { ok: false, kind: "revision_changed", message }
        : { ok: false, kind: "http_error", message };
    default:
      return { ok: false, kind: "http_error", message };
  }
}

async function readEnvelope(response: Response): Promise<ApiErrorEnvelope> {
  return (await response.json().catch(() => ({}))) as ApiErrorEnvelope;
}
