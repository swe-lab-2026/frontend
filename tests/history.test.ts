import { describe, expect, it } from "vitest";
import type { AuditEntry } from "@/lib/api/types";
import { changedFields, eventPhase, isBadRange, isConfidential, mapLimited, rangeQuery, salesBuckets, scalarChanges, statusChange, sumByBucket, updatedFields } from "@/lib/history";

const NOW = new Date("2026-11-10T12:00:00Z");
const entry = (over: Partial<AuditEntry>): AuditEntry => ({
  id: 1, timestamp: "2026-11-10T12:00:00Z", actor_id: null, actor_type: "SYSTEM", action: "event.updated",
  entity_type: "event", entity_id: null, event_id: null, metadata: null, before: null, after: null, ...over,
});

describe("eventPhase", () => {
  const past = { starts_at: "2026-11-01T10:00:00Z", ends_at: "2026-11-01T12:00:00Z" };
  const running = { starts_at: "2026-11-10T10:00:00Z", ends_at: "2026-11-10T14:00:00Z" };
  const future = { starts_at: "2026-12-01T10:00:00Z", ends_at: "2026-12-01T12:00:00Z" };
  it.each([
    ["PUBLISHED", future, "UPCOMING"],
    ["PUBLISHED", running, "ACTIVE"],
    ["PUBLISHED", past, "COMPLETED"],
    ["COMPLETED", future, "COMPLETED"],
    ["CANCELLED", past, "CANCELLED"],
    ["DRAFT", past, "DRAFT"],
    ["UNPUBLISHED", future, "DRAFT"],
    ["UNPUBLISHED", past, "COMPLETED"],
  ] as const)("%s %j -> %s", (status, dates, phase) => expect(eventPhase({ status, ...dates }, NOW)).toBe(phase));
});

describe("rangeQuery", () => {
  it("turns inclusive event-timezone days into [start, end)", () =>
    expect(rangeQuery({ from: "2026-11-10", to: "2026-11-10" }, "Asia/Almaty")).toEqual({ start: "2026-11-10T00:00:00+05:00", end: "2026-11-11T00:00:00+05:00" }));
  it("leaves open ends open", () => expect(rangeQuery({ from: "", to: "" }, "Asia/Almaty")).toEqual({ start: undefined, end: undefined }));
  it("crosses month ends", () => expect(rangeQuery({ from: "", to: "2026-11-30" }, "UTC").end).toBe("2026-12-01T00:00:00+00:00"));
  it("detects a reversed range", () => {
    expect(isBadRange({ from: "2026-11-10", to: "2026-11-09" })).toBe(true);
    expect(isBadRange({ from: "2026-11-10", to: "2026-11-10" })).toBe(false);
    expect(isBadRange({ from: "2026-11-10", to: "" })).toBe(false);
  });
});

describe("salesBuckets", () => {
  const now = new Date("2026-11-09T20:00:00Z"); // already the 10th in Almaty
  it("defaults to the last 14 days of the event timezone", () => {
    const days = salesBuckets({ from: "", to: "" }, "Asia/Almaty", now);
    expect(days).toHaveLength(14);
    expect(days[0]).toEqual({ from: "2026-10-28", to: "2026-10-28" });
    expect(days[13]).toEqual({ from: "2026-11-10", to: "2026-11-10" });
  });
  it("uses one bucket per day for short ranges", () => expect(salesBuckets({ from: "2026-11-01", to: "2026-11-03" }, "UTC", now)).toHaveLength(3));
  it("groups long ranges, covering every day exactly once", () => {
    const buckets = salesBuckets({ from: "2026-01-01", to: "2026-12-31" }, "UTC", now);
    expect(buckets.length).toBeLessThanOrEqual(31);
    expect(buckets[0].from).toBe("2026-01-01");
    expect(buckets[buckets.length - 1].to).toBe("2026-12-31");
    for (let i = 1; i < buckets.length; i++) expect(Date.parse(buckets[i].from) - Date.parse(buckets[i - 1].to)).toBe(86_400_000);
  });
  it("handles a start in the future", () => expect(salesBuckets({ from: "2026-12-01", to: "" }, "UTC", now)).toEqual([{ from: "2026-12-01", to: "2026-12-01" }]));
});

describe("mapLimited", () => {
  it("keeps order and never exceeds the limit", async () => {
    let running = 0;
    let peak = 0;
    const out = await mapLimited([5, 1, 3, 2], 2, async (n) => {
      peak = Math.max(peak, ++running);
      await new Promise((r) => setTimeout(r, n));
      running--;
      return n * 2;
    });
    expect(out).toEqual([10, 2, 6, 4]);
    expect(peak).toBe(2);
  });
  it("handles no items", async () => expect(await mapLimited([], 3, async () => 1)).toEqual([]));
});

describe("timeline descriptions", () => {
  it("reads status changes", () => {
    expect(statusChange({ description: "Payment changed from PENDING to SUCCEEDED" })).toEqual(["PENDING", "SUCCEEDED"]);
    expect(statusChange({ description: "Order placed" })).toBeNull();
  });
  it("reads updated event fields", () => {
    expect(updatedFields({ action: "event.updated", description: "Event details updated (starts at, title)" })).toEqual(["starts_at", "title"]);
    expect(updatedFields({ action: "event.updated", description: "Event details updated" })).toEqual([]);
    expect(updatedFields({ action: "order.created", description: "Order placed (x)" })).toEqual([]);
  });
});

describe("changes", () => {
  const changed = entry({ before: { price: "10.00", name: "A" }, after: { price: "12.00", name: "A" } });
  it("lists only changed fields", () => expect(changedFields(changed)).toEqual(["price"]));
  it("shows old and new values", () => expect(scalarChanges(changed, ["price"])).toEqual(["10.00 → 12.00"]));
  it("ignores entries without both sides", () => expect(changedFields(entry({ after: { status: "PUBLISHED" } }))).toEqual([]));
});

describe("sumByBucket", () => {
  const points = [
    { date: "2026-11-01", currency: "KZT", orders: 1, tickets: 2, gross: "1000.50" },
    { date: "2026-11-03", currency: "KZT", orders: 1, tickets: 1, gross: "500.00" },
    { date: "2026-11-03", currency: "USD", orders: 1, tickets: 4, gross: "90.00" },
    { date: "2026-11-09", currency: "KZT", orders: 1, tickets: 9, gross: "9.00" },
  ];
  it("adds the days of a bucket, ends included, and never mixes currencies", () =>
    expect(sumByBucket([{ from: "2026-11-01", to: "2026-11-03" }], points)).toEqual([{ from: "2026-11-01", to: "2026-11-03", revenue: 1500.5, tickets: 7 }]));
  it("keeps days without sales at zero", () =>
    expect(sumByBucket([{ from: "2026-11-02", to: "2026-11-02" }], points)[0]).toMatchObject({ revenue: 0, tickets: 0 }));
});

describe("isConfidential", () => {
  it("keeps reports on an event away from its organizer", () => {
    expect(isConfidential({ action: "event.reported" })).toBe(true);
    expect(isConfidential({ action: "admin.event_report_updated" })).toBe(true);
    expect(isConfidential({ action: "admin.event_suspended" })).toBe(false);
  });
});
