import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "../src/shared/lib/uuid";

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("shared/lib/uuid: guarded randomUUID", () => {
  const originalCrypto = globalThis.crypto;

  afterEach(() => {
    Object.defineProperty(globalThis, "crypto", {
      value: originalCrypto,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it("в secure context возвращает валидный UUID v4", () => {
    expect(randomUUID()).toMatch(UUID_V4_RE);
  });

  it("без crypto.randomUUID (plain-http) — fallback на getRandomValues", () => {
    const realGetRandomValues = originalCrypto.getRandomValues.bind(originalCrypto);
    let draws = 0;
    Object.defineProperty(globalThis, "crypto", {
      value: {
        getRandomValues: (array: Uint8Array) => {
          draws += 1;
          return realGetRandomValues(array);
        },
      },
      writable: true,
      configurable: true,
    });
    expect(typeof globalThis.crypto.randomUUID).toBe("undefined");

    const seen = new Set<string>();
    for (let index = 0; index < 64; index += 1) {
      const id = randomUUID();
      expect(id).toMatch(UUID_V4_RE);
      seen.add(id);
    }
    expect(seen.size).toBe(64);
    expect(draws).toBeGreaterThan(0);
  });
});
