import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach } from "vitest";
import "./msw-server";
import { server } from "./msw-server";

afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
