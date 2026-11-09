// Pure rules for the attendee registration flow. They mirror the checks in
// backend app/services/orders.py so the UI can explain why a ticket cannot be
// chosen; the backend still re-checks everything when the order is created.

import type { Event, OrderCreateRequest, TicketType } from "@/lib/api/types";

export type RegistrationWindow = "open" | "notOpen" | "closed" | "unavailable";

export function registrationWindow(event: Pick<Event, "status" | "registration_starts_at" | "registration_ends_at">, now: Date): RegistrationWindow {
  if (event.status !== "PUBLISHED") return "unavailable";
  if (event.registration_starts_at && now < new Date(event.registration_starts_at)) return "notOpen";
  if (event.registration_ends_at && now >= new Date(event.registration_ends_at)) return "closed";
  return "open";
}

/**
 * "paid" is not orderable yet: a paid order would only hold seats for 10
 * minutes, and the payment step does not exist in the MVP.
 */
export type TicketAvailability = "available" | "paid" | "notStarted" | "ended";

export function ticketAvailability(tt: Pick<TicketType, "is_free" | "sales_starts_at" | "sales_ends_at">, now: Date): TicketAvailability {
  if (!tt.is_free) return "paid";
  if (tt.sales_starts_at && now < new Date(tt.sales_starts_at)) return "notStarted";
  if (tt.sales_ends_at && now >= new Date(tt.sales_ends_at)) return "ended";
  return "available";
}

/**
 * Next quantity for a +/- stepper. Valid values are 0 (not selected) or
 * min..max, so stepping up from 0 jumps to `min` and stepping down from `min`
 * drops back to 0.
 */
export function stepQuantity(current: number, delta: 1 | -1, min: number, max: number): number {
  const low = Math.max(1, min);
  if (delta > 0) return current === 0 ? Math.min(low, max) : Math.min(current + 1, max);
  return current <= low ? 0 : current - 1;
}

export function buildOrder(eventId: string, quantities: Record<string, number>): OrderCreateRequest {
  return {
    event_id: eventId,
    items: Object.entries(quantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([ticket_type_id, quantity]) => ({ ticket_type_id, quantity })),
  };
}

export function formatMoney(amount: string | number, currency: string, intlLocale: string): string {
  return new Intl.NumberFormat(intlLocale, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(amount));
}

/** Only same-site paths are allowed as a post-login redirect (no open redirect). */
export function safeNext(value: string | null | undefined, fallback = "/events"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
