import { describe, expect, it } from "vitest";
import { canRetry, formatCountdown, retryHref, secondsLeft } from "@/lib/checkout";

const NOW = Date.parse("2026-11-01T12:00:00Z");

describe("secondsLeft", () => {
  it.each([
    ["2026-11-01T12:10:00Z", 600],
    ["2026-11-01T12:00:00.400Z", 1],
    ["2026-11-01T12:00:00Z", 0],
    ["2026-11-01T11:00:00Z", 0],
    [null, 0],
  ])("%s -> %i", (expires, seconds) => expect(secondsLeft(expires, NOW)).toBe(seconds));
});

describe("formatCountdown", () => {
  it.each([[600, "10:00"], [61, "1:01"], [9, "0:09"], [0, "0:00"]])("%i -> %s", (s, text) => expect(formatCountdown(s)).toBe(text));
});

describe("recovery", () => {
  it("is offered only for unpaid orders that ended", () => {
    expect(canRetry({ status: "EXPIRED", paid_at: null })).toBe(true);
    expect(canRetry({ status: "CANCELLED", paid_at: null })).toBe(true);
    expect(canRetry({ status: "CANCELLED", paid_at: "2026-11-01T12:00:00Z" })).toBe(false);
    expect(canRetry({ status: "PENDING", paid_at: null })).toBe(false);
    expect(canRetry({ status: "REFUNDED", paid_at: "2026-11-01T12:00:00Z" })).toBe(false);
  });
  it("returns to the same tickets and code", () => {
    const item = { ticket_type_id: "11111111-1111-4111-8111-111111111111", ticket_type_name: "VIP", quantity: 2, unit_price: "1", subtotal: "2", final_price: "1" };
    expect(retryHref({ event_id: "e1", items: [item], promo_code: "SPRING10" })).toBe(`/catalog/e1?items=${item.ticket_type_id}%3A2&promo=SPRING10`);
  });
});
