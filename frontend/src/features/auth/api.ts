import type { AccountStateCode, ApiErrorEnvelope, EmployeeView } from "./types";

const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

/*
 * CSRF-токен живёт ТОЛЬКО в памяти модуля: сервер выдаёт его в теле GET /auth/me
 * (поле csrf_token), header X-CSRF-Token нужен всем authenticated-мутациям.
 * Никакого localStorage, cookie из JS не читаем (HttpOnly).
 */
let csrfToken: string | null = null;

export function setCsrfToken(token: string): void {
  csrfToken = token;
}

export function clearCsrfToken(): void {
  csrfToken = null;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}

/** Заголовки для authenticated-мутаций (T9/T10: использовать в своём fetch-шве). */
export function csrfHeaders(): Record<string, string> {
  return csrfToken === null ? {} : { "X-CSRF-Token": csrfToken };
}

export class AuthApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly envelope: ApiErrorEnvelope,
  ) {
    super(envelope.message ?? `Ошибка ${status}`);
  }
}

async function readEnvelope(response: Response): Promise<ApiErrorEnvelope> {
  return (await response.json().catch(() => ({}))) as ApiErrorEnvelope;
}

async function postJson(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function retryAfter(response: Response): number | null {
  const seconds = Number(response.headers.get("Retry-After"));
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

export type LoginOutcome =
  | { ok: true; employee: EmployeeView }
  | { ok: false; kind: "invalid_credentials" }
  | { ok: false; kind: "account_state"; state: AccountStateCode }
  | { ok: false; kind: "rate_limited"; retryAfterSeconds: number | null }
  | { ok: false; kind: "network" }
  | { ok: false; kind: "http_error"; message: string };

const ACCOUNT_STATES: Record<string, AccountStateCode> = {
  ACCOUNT_PENDING: "ACCOUNT_PENDING",
  ACCOUNT_REJECTED: "ACCOUNT_REJECTED",
  ACCOUNT_DISABLED: "ACCOUNT_DISABLED",
};

export async function loginRequest(email: string, password: string): Promise<LoginOutcome> {
  let response: Response;
  try {
    response = await postJson("/api/v1/auth/login", { email, password });
  } catch {
    return { ok: false, kind: "network" };
  }
  if (response.ok) {
    return { ok: true, employee: (await response.json()) as EmployeeView };
  }
  if (response.status === 401) {
    return { ok: false, kind: "invalid_credentials" };
  }
  const envelope = await readEnvelope(response);
  if (response.status === 403) {
    const code = ACCOUNT_STATES[envelope.code ?? ""];
    if (code !== undefined) {
      return { ok: false, kind: "account_state", state: code };
    }
  }
  if (response.status === 429) {
    return { ok: false, kind: "rate_limited", retryAfterSeconds: retryAfter(response) };
  }
  return { ok: false, kind: "http_error", message: envelope.message ?? `Ошибка ${response.status}` };
}

/**
 * GET /auth/me: 200 → EmployeeView + csrf_token (запоминаем); 401 → AuthApiError.
 * Прочие сбои (сеть/5xx) — тоже AuthApiError, но status !== 401: AuthProvider
 * отличает «аноним» от «нет связи».
 */
export async function fetchMe(): Promise<import("./types").MeView> {
  const response = await fetch(`${baseUrl}/api/v1/auth/me`);
  if (!response.ok) {
    clearCsrfToken();
    throw new AuthApiError(response.status, await readEnvelope(response));
  }
  const me = (await response.json()) as import("./types").MeView;
  setCsrfToken(me.csrf_token);
  return me;
}

/** POST /auth/logout — best-effort: даже при ошибке клиент обязан очистить состояние. */
export async function logoutRequest(): Promise<void> {
  try {
    await postJson("/api/v1/auth/logout", {}, csrfHeaders());
  } catch {
    /* сеть недоступна — локальную сессию всё равно сбрасываем */
  }
}

export type ChangePasswordOutcome =
  | { ok: true }
  | { ok: false; kind: "invalid_credentials" }
  | { ok: false; kind: "rate_limited"; retryAfterSeconds: number | null }
  | { ok: false; kind: "network" }
  | { ok: false; kind: "http_error"; message: string };

export async function changePasswordRequest(
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordOutcome> {
  let response: Response;
  try {
    response = await postJson(
      "/api/v1/auth/password",
      { current_password: currentPassword, new_password: newPassword },
      csrfHeaders(),
    );
  } catch {
    return { ok: false, kind: "network" };
  }
  if (response.ok || response.status === 204) {
    return { ok: true };
  }
  if (response.status === 401) {
    return { ok: false, kind: "invalid_credentials" };
  }
  const envelope = await readEnvelope(response);
  if (response.status === 429) {
    return { ok: false, kind: "rate_limited", retryAfterSeconds: retryAfter(response) };
  }
  return { ok: false, kind: "http_error", message: envelope.message ?? `Ошибка ${response.status}` };
}

export type RegisterOutcome =
  | { ok: true; message: string }
  | { ok: false; kind: "email_exists"; message: string }
  | { ok: false; kind: "intake_disabled"; message: string }
  | { ok: false; kind: "validation"; message: string; fieldErrors: Record<string, string> }
  | { ok: false; kind: "rate_limited"; message: string; retryAfterSeconds: number | null }
  | { ok: false; kind: "network"; message: string }
  | { ok: false; kind: "http_error"; message: string };

export interface RegisterPayload {
  email: string;
  first_name: string;
  last_name: string;
  position: string;
  password: string;
}

export async function registerRequest(payload: RegisterPayload): Promise<RegisterOutcome> {
  let response: Response;
  try {
    response = await postJson("/api/v1/auth/register", payload);
  } catch {
    return { ok: false, kind: "network", message: "Нет связи с сервером" };
  }
  if (response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    return { ok: true, message: body.message ?? "Регистрация принята" };
  }
  const envelope = await readEnvelope(response);
  const message = envelope.message ?? `Ошибка ${response.status}`;
  switch (response.status) {
    case 409:
      return { ok: false, kind: "email_exists", message };
    case 503:
      return { ok: false, kind: "intake_disabled", message };
    case 422:
      return {
        ok: false,
        kind: "validation",
        message,
        fieldErrors: envelope.field_errors ?? {},
      };
    case 429:
      return {
        ok: false,
        kind: "rate_limited",
        message,
        retryAfterSeconds: retryAfter(response),
      };
    default:
      return { ok: false, kind: "http_error", message };
  }
}
