import { afterEach, describe, expect, it, vi } from "vitest";
import { generateTempPassword, slugFromTitle } from "../src/features/admin/tempPassword";

const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LIMIT = 256 - (256 % ALPHABET.length);

describe("generateTempPassword: rejection sampling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("16 символов из алфавита без похожих глифов", () => {
    const password = generateTempPassword();
    expect(password).toHaveLength(16);
    for (const char of password) {
      expect(ALPHABET).toContain(char);
    }
  });

  it("байты за пределами unbiased-диапазона отбрасываются и добираются новой выдачей", () => {
    let call = 0;
    vi.spyOn(crypto, "getRandomValues").mockImplementation(
      (<T extends ArrayBufferView>(array: T): T => {
        call += 1;
        const bytes = array as unknown as Uint8Array;
        if (call === 1) {
          bytes.fill(LIMIT);
        } else {
          bytes.set([0, 5, 10]);
        }
        return array;
      }) as typeof crypto.getRandomValues,
    );
    expect(generateTempPassword(3)).toBe(ALPHABET[0]! + ALPHABET[5]! + ALPHABET[10]!);
    expect(call).toBeGreaterThan(1);
  });

  it("слаг из кириллического названия валиден", () => {
    const slug = slugFromTitle("Оператор линии розлива");
    expect(slug).toMatch(/^[a-z0-9][a-z0-9-]*$/);
  });
});
