import { describe, expect, it } from "vitest";
import {
  canCancelOrder,
  isOrderConfirmed,
  isTicketUsable,
  orderEventTitle,
  orderTone,
  ticketCount,
  ticketPdfFilename,
  ticketTone,
} from "@/lib/tickets";

describe("isOrderConfirmed", () => {
  it("treats PAID and CONFIRMED as confirmed", () => {
    expect(isOrderConfirmed("PAID")).toBe(true);
    expect(isOrderConfirmed("CONFIRMED")).toBe(true);
  });
  it.each(["PENDING", "CANCELLED", "EXPIRED", "REFUNDED", "PARTIALLY_REFUNDED"])("%s is not confirmed", (s) => {
    expect(isOrderConfirmed(s)).toBe(false);
  });
});

describe("isTicketUsable", () => {
  it("only VALID tickets get a QR code and downloads", () => {
    expect(isTicketUsable({ status: "VALID" })).toBe(true);
    for (const status of ["CHECKED_IN", "CANCELLED", "REFUNDED", "SOMETHING_NEW"]) {
      expect(isTicketUsable({ status })).toBe(false);
    }
  });
});

describe("tones", () => {
  it("gives each ticket status a distinct tone", () => {
    const tones = ["VALID", "CHECKED_IN", "CANCELLED", "REFUNDED"].map(ticketTone);
    expect(new Set(tones).size).toBe(4);
  });
  it("falls back to neutral for unknown statuses", () => {
    expect(ticketTone("X")).toBe("neutral");
    expect(orderTone("X")).toBe("neutral");
  });
});

describe("order helpers", () => {
  it("reads the event title from the first ticket", () => {
    expect(orderEventTitle({ tickets: [{ event_title: "Concert" }] as never })).toBe("Concert");
    expect(orderEventTitle({ tickets: [] })).toBeNull();
  });
  it("counts tickets across items", () => {
    expect(ticketCount({ items: [{ quantity: 2 }, { quantity: 3 }] as never })).toBe(5);
  });
  it("names the PDF after the ticket ID", () => {
    expect(ticketPdfFilename("abc")).toBe("biletflow-ticket-abc.pdf");
  });
});

describe("canCancelOrder", () => {
  const ticket = (status: string) => ({ status }) as never;
  it("allows free confirmed registrations and unpaid pending orders", () => {
    expect(canCancelOrder({ status: "PAID", is_free: true, tickets: [ticket("VALID")] })).toBe(true);
    expect(canCancelOrder({ status: "CONFIRMED", is_free: true, tickets: [] })).toBe(true);
    expect(canCancelOrder({ status: "PENDING", is_free: false, tickets: [] })).toBe(true);
  });
  it("leaves paid orders to a refund flow", () => {
    expect(canCancelOrder({ status: "PAID", is_free: false, tickets: [ticket("VALID")] })).toBe(false);
  });
  it("blocks orders with a checked-in ticket or a final status", () => {
    expect(canCancelOrder({ status: "PAID", is_free: true, tickets: [ticket("CHECKED_IN")] })).toBe(false);
    for (const status of ["CANCELLED", "EXPIRED", "REFUNDED"]) {
      expect(canCancelOrder({ status, is_free: true, tickets: [] })).toBe(false);
    }
  });
});
