import react from "@vitejs/plugin-react";
import { defaultExclude, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
  },
  preview: {
    proxy: { "/api": process.env.E2E_API_TARGET ?? "http://127.0.0.1:8000" },
  },
  test: {
    environment: "jsdom",
    env: { VITE_API_BASE_URL: "http://localhost" },
    setupFiles: ["./tests/setup.ts"],
    exclude: [...defaultExclude, "e2e/**"],
    reporters: ["default", "junit"],
    outputFile: { junit: "./junit/vitest-junit.xml" },
  },
});
