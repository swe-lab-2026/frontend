import { describe, expect, it } from "vitest";
import { EXPORT_MAX, loadAll } from "@/lib/admin";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("quotes separators, quotes and line breaks", () =>
    expect(toCsv(["a", "b"], [["x,y", 'say "hi"'], ["line\nbreak", "ok"]])).toBe('\uFEFFa,b\r\n"x,y","say ""hi"""\r\n"line\nbreak",ok\r\n'));
  it.each(["=1+1", "+1", "-1", "@SUM(A1)", "\tx"])("neutralises the formula %j", (value) => expect(toCsv(["h"], [[value]])).toContain(`'${value}`));
  it("keeps ordinary text", () => expect(toCsv(["h"], [["Алматы 100"]])).toContain("\r\nАлматы 100\r\n"));
});

describe("loadAll", () => {
  const pager = (total: number) => async (limit: number, offset: number) => ({
    items: Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) => offset + i),
    total,
    limit,
    offset,
  });
  it("collects every page", async () => {
    const { rows, truncated } = await loadAll(pager(250));
    expect(rows).toHaveLength(250);
    expect(rows[249]).toBe(249);
    expect(truncated).toBe(false);
  });
  it("is not truncated exactly at the cap", async () => expect((await loadAll(pager(EXPORT_MAX))).truncated).toBe(false));
  it("stops at the cap", async () => {
    const { rows, truncated } = await loadAll(pager(EXPORT_MAX + 1));
    expect(rows).toHaveLength(EXPORT_MAX);
    expect(truncated).toBe(true);
  });
  it("ends if rows disappear while paging", async () => expect((await loadAll(async () => ({ items: [], total: 5, limit: 100, offset: 0 }))).rows).toEqual([]));
});
