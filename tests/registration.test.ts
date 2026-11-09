import { describe, expect, it } from "vitest";
import { buildOrder, registrationWindow, safeNext, stepQuantity, ticketAvailability } from "@/lib/registration";

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
  const tt = (over: object) => ({ is_free: true, sales_starts_at: null, sales_ends_at: null, ...over });

  it("offers free tickets", () => expect(ticketAvailability(tt({}), NOW)).toBe("available"));
  it("does not offer paid tickets yet", () => expect(ticketAvailability(tt({ is_free: false }), NOW)).toBe("paid"));
  it("respects the sales start", () => expect(ticketAvailability(tt({ sales_starts_at: FUTURE }), NOW)).toBe("notStarted"));
  it("respects the sales end", () => expect(ticketAvailability(tt({ sales_ends_at: PAST }), NOW)).toBe("ended"));
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

describe("safeNext", () => {
  it.each([
    ["/catalog/abc", "/catalog/abc"],
    [null, "/events"],
    ["", "/events"],
    ["https://evil.example", "/events"],
    ["//evil.example", "/events"],
    ["/\\evil.example", "/events"],
  ])("%s -> %s", (input, expected) => expect(safeNext(input)).toBe(expected));
});
