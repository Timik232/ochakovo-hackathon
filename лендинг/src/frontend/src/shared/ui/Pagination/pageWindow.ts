export type PageItem = number | "gap";

export function pageWindow(page: number, pageCount: number): PageItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const current = Math.min(Math.max(page, 1), pageCount);
  const shown = new Set<number>([1, pageCount, current - 1, current, current + 1]);
  const pages: PageItem[] = [];
  let previous = 0;
  for (let candidate = 1; candidate <= pageCount; candidate += 1) {
    if (shown.has(candidate)) {
      if (previous !== 0 && candidate - previous > 1) {
        pages.push("gap");
      }
      pages.push(candidate);
      previous = candidate;
    }
  }
  return pages;
}
