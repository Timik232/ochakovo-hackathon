import { setupServer } from "msw/node";
import { handlers } from "./msw-handlers";

/*
 * server.listen вызывается синхронно на верхнем уровне модуля: openapi-fetch
 * и клиентские модули захватывают globalThis.fetch при импорте, поэтому
 * перехват MSW должен стоять раньше (см. learnings T1).
 */
export const server = setupServer(...handlers);

server.listen({ onUnhandledRequest: "error" });
