import type { Page } from "@/lib/api/types";

export const EXPORT_PAGE = 100;
export const EXPORT_MAX = 5000;

/** Every matching row, page by page; `truncated` when there are more than the cap. */
export async function loadAll<T>(load: (limit: number, offset: number) => Promise<Page<T>>): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  for (;;) {
    const page = await load(EXPORT_PAGE, rows.length);
    rows.push(...page.items);
    if (page.items.length === 0 || rows.length >= page.total) return { rows, truncated: false };
    if (rows.length >= EXPORT_MAX) return { rows, truncated: true };
  }
}
