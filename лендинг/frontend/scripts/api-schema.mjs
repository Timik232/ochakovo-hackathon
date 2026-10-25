import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = dirname(dirname(fileURLToPath(import.meta.url)));
const openapiPath = join(frontendDir, "..", "backend", "openapi.json");
const schemaPath = join(frontendDir, "src", "api", "schema.d.ts");
const cliBin = join(frontendDir, "node_modules", ".bin", "openapi-typescript");

function runGenerator(outputPath) {
  execFileSync(cliBin, [openapiPath, "-o", outputPath], {
    cwd: frontendDir,
    stdio: "pipe",
  });
}

function failNoOpenapi() {
  console.error(`Не найден ${openapiPath}.`);
  console.error(
    "Сначала экспортируйте схему: cd backend && uv run python -m scripts.export_openapi",
  );
  process.exit(1);
}

const mode = process.argv[2];

if (mode === "generate") {
  if (!existsSync(openapiPath)) failNoOpenapi();
  runGenerator(schemaPath);
  console.log("OK: src/api/schema.d.ts обновлён из backend/openapi.json");
} else if (mode === "check") {
  if (!existsSync(openapiPath)) failNoOpenapi();
  const tmpDir = mkdtempSync(join(tmpdir(), "ochakovo-api-check-"));
  let ok = true;
  try {
    runGenerator(join(tmpDir, "schema.d.ts"));
    let current = null;
    try {
      current = readFileSync(schemaPath, "utf8");
    } catch {
      ok = false;
    }
    const fresh = readFileSync(join(tmpDir, "schema.d.ts"), "utf8");
    if (ok && current === fresh) {
      console.log("OK: дрейфа между backend/openapi.json и src/api/schema.d.ts нет");
    } else {
      console.error("DRIFT: src/api/schema.d.ts не совпадает с backend/openapi.json.");
      console.error(
        "Восстановите синхронность: cd backend && uv run python -m scripts.export_openapi && cd ../frontend && npm run api:generate",
      );
      ok = false;
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
  process.exit(ok ? 0 : 1);
} else {
  console.error("Использование: node scripts/api-schema.mjs generate|check");
  process.exit(2);
}
