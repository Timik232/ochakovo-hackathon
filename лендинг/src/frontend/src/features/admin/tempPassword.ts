const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * Временный пароль только в памяти диалога: 16 символов из алфавита без похожих глифов.
 * Байты >= 256 - (256 % len) отбрасываются (rejection sampling) — без modulo bias.
 */
export function generateTempPassword(length = 16): string {
  const limit = 256 - (256 % ALPHABET.length);
  let password = "";
  while (password.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    for (const byte of bytes) {
      if (byte >= limit) {
        continue;
      }
      password += ALPHABET[byte % ALPHABET.length]!;
      if (password.length === length) {
        break;
      }
    }
  }
  return password;
}

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
  й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
  э: "e", ю: "yu", я: "ya",
};

/** Слаг вакансии из заголовка: транслитерация + суффикс от времени, паттерн ^[a-z0-9][a-z0-9-]*$. */
export function slugFromTitle(title: string): string {
  const base = title
    .toLowerCase()
    .split("")
    .map((char) => TRANSLIT[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  const suffix = Date.now().toString(36).slice(-4);
  return base === "" ? `vakansiya-${suffix}` : `${base}-${suffix}`;
}
