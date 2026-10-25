/**
 * UUID v4 без зависимости от secure context: crypto.randomUUID доступен только
 * на https/localhost, а демо-стенд работает по plain-http (F3 QA BUG #2).
 * Fallback повторяет паттерн из публичной анкеты (ApplicationForm) —
 * getRandomValues есть и в insecure-контекстах.
 */
export function randomUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (char) => {
    const random = crypto.getRandomValues(new Uint8Array(1))[0] ?? 0;
    return (Number(char) ^ (random & (15 >> (Number(char) / 4)))).toString(16);
  });
}
