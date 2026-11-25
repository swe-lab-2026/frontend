import { describe, expect, it } from "vitest";
import {
  buildOrder,
  decodeSelection,
  encodeSelection,
  eventHref,
  isQuantityValid,
  maxQuantity,
  registrationWindow,
  safeNext,
  stepQuantity,
  ticketAvailability,
} from "@/lib/registration";

const NOW = new Date("2026-11-01T12:00:00+05:00");
const PAST = "2026-10-01T00:00:00+05:00";
const FUTURE = "2026-12-01T00:00:00+05:00";

describe("registrationWindow", () => {
  const event = (over: object) => ({ status: "PUBLISHED" as const, registration_starts_at: null, registration_ends_at: null, ...over });

  it("is open with no window set", () => expect(registrationWindow(event({}), NOW)).toBe("open"));
  it("is open inside the window", () =>
    expect(registrationWindow(event({ registration_starts_at: PAST, registration_ends_at: FUTURE }), NOW)).toBe("open"));
  it("has not opened before the start", () => expect(registrationWindow(event({ registration_starts_at: FUTURE }), NOW)).toBe("notOpen"));
  it("is closed after the end", () => expect(registrationWindow(event({ registration_ends_at: PAST }), NOW)).toBe("closed"));
  it("is closed exactly at the end (backend uses >=)", () =>
    expect(registrationWindow(event({ registration_ends_at: NOW.toISOString() }), NOW)).toBe("closed"));
  it.each(["CANCELLED", "COMPLETED", "DRAFT"] as const)("is unavailable when %s", (status) =>
    expect(registrationWindow(event({ status }), NOW)).toBe("unavailable"));
});

describe("ticketAvailability", () => {
  const tt = (over: object) => ({ is_free: true, sales_starts_at: null, sales_ends_at: null, min_per_order: 1, available: 50, ...over });

  it("offers free tickets", () => expect(ticketAvailability(tt({}), NOW, false)).toBe("available"));
  it("offers paid tickets", () => expect(ticketAvailability(tt({ is_free: false }), NOW, true)).toBe("available"));
  it("offers only free tickets while paid sales are inactive", () =>
    expect(ticketAvailability(tt({ is_free: false }), NOW, false)).toBe("paidInactive"));
  it("is sold out when nothing is left, or less than the minimum order", () => {
    expect(ticketAvailability(tt({ available: 0 }), NOW, true)).toBe("soldOut");
    expect(ticketAvailability(tt({ min_per_order: 3, available: 2 }), NOW, true)).toBe("soldOut");
    expect(ticketAvailability(tt({ min_per_order: 2, available: 2 }), NOW, true)).toBe("available");
  });
  it("leaves the stock to the server when it is not known", () => {
    expect(ticketAvailability(tt({ available: null }), NOW, true)).toBe("available");
  });
  it("respects the sales start", () => expect(ticketAvailability(tt({ sales_starts_at: FUTURE }), NOW, true)).toBe("notStarted"));
  it("respects the sales end", () => expect(ticketAvailability(tt({ sales_ends_at: PAST }), NOW, true)).toBe("ended"));
});

describe("stepQuantity", () => {
  it.each([
    [0, 1, 1, 5, 1],
    [0, 1, 2, 5, 2],
    [2, -1, 2, 5, 0],
    [3, -1, 2, 5, 2],
    [5, 1, 2, 5, 5],
    [0, -1, 1, 5, 0],
    [0, 1, 3, 2, 2],
  ] as const)("%i %+i (min %i, max %i) -> %i", (current, delta, min, max, expected) =>
    expect(stepQuantity(current, delta, min, max)).toBe(expected));
});

describe("buildOrder", () => {
  it("drops unselected ticket types", () =>
    expect(buildOrder("e1", { a: 2, b: 0, c: 1 })).toEqual({
      event_id: "e1",
      items: [
        { ticket_type_id: "a", quantity: 2 },
        { ticket_type_id: "c", quantity: 1 },
      ],
    }));
});

describe("buildOrder with a promotion", () => {
  it("sends a typed code or a campaign token, never both and never an amount", () => {
    expect(buildOrder("e1", { a: 1 }, { code: "SPRING10" })).toEqual({ event_id: "e1", items: [{ ticket_type_id: "a", quantity: 1 }], promo_code: "SPRING10" });
    expect(buildOrder("e1", { a: 1 }, { campaign_token: "tok" })).toEqual({ event_id: "e1", items: [{ ticket_type_id: "a", quantity: 1 }], campaign_token: "tok" });
  });
});

describe("quantity limits", () => {
  const tt = { min_per_order: 2, max_per_order: 5, capacity: 4, available: null };
  it("caps by per-order limit, capacity and known stock", () => {
    expect(maxQuantity(tt)).toBe(4);
    expect(maxQuantity({ ...tt, available: 3 })).toBe(3);
    expect(maxQuantity({ max_per_order: 5, capacity: 100, available: 80 })).toBe(5);
  });
  it.each([
    [0, null, true],
    [1, null, false],
    [2, null, true],
    [4, null, true],
    [5, null, false],
    [4, 3, false],
    [2.5, null, false],
  ])("quantity %s with stock %s -> %s", (quantity, available, ok) => expect(isQuantityValid({ ...tt, available }, quantity)).toBe(ok));
});

describe("selection in the URL", () => {
  const A = "11111111-1111-4111-8111-111111111111";
  const B = "22222222-2222-4222-8222-222222222222";
  it("round-trips", () => {
    const items = [{ ticket_type_id: A, quantity: 2 }, { ticket_type_id: B, quantity: 1 }];
    expect(decodeSelection(encodeSelection(items))).toEqual({ [A]: 2, [B]: 1 });
  });
  it.each([null, "", "x:1", `${A}:-1`, `${A}:1e3`, `${A}`, "__proto__:1"])("ignores %s", (value) => expect(decodeSelection(value)).toEqual({}));
  it("builds an event link with the promotion", () => {
    expect(eventHref("e1")).toBe("/catalog/e1");
    expect(eventHref("e1", [], { code: "A B" })).toBe("/catalog/e1?promo=A+B");
    expect(eventHref("e1", [{ ticket_type_id: A, quantity: 2 }], { campaign_token: "tok" })).toBe(`/catalog/e1?items=${A}%3A2&campaign=tok`);
    // Must survive the sign-in round trip.
    expect(safeNext(eventHref("e1", [], { campaign_token: "tok" }))).toBe("/catalog/e1?campaign=tok");
  });
});

describe("safeNext", () => {
  it.each([
    ["/catalog/abc", "/catalog/abc"],
    [null, "/events"],
    ["", "/events"],
    ["https://evil.example", "/events"],
    ["//evil.example", "/events"],
    ["/\\evil.example", "/events"],
    ["/\t/evil.example", "/events"],
    ["/\n/evil.example", "/events"],
    ["/\t\\evil.example", "/events"],
  ])("%s -> %s", (input, expected) => expect(safeNext(input)).toBe(expected));
});
