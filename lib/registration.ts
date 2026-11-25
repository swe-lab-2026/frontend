// Pure rules for the attendee registration flow. They mirror the checks in
// backend app/services/orders.py so the UI can explain why a ticket cannot be
// chosen; the backend still re-checks everything when the order is created.

import type { AttendeeRequest, Event, OrderCreateRequest, TicketType } from "@/lib/api/types";

export type RegistrationWindow = "open" | "notOpen" | "closed" | "unavailable";

export function registrationWindow(event: Pick<Event, "status" | "registration_starts_at" | "registration_ends_at">, now: Date): RegistrationWindow {
  if (event.status !== "PUBLISHED") return "unavailable";
  if (event.registration_starts_at && now < new Date(event.registration_starts_at)) return "notOpen";
  if (event.registration_ends_at && now >= new Date(event.registration_ends_at)) return "closed";
  return "open";
}

export type TicketAvailability = "available" | "notStarted" | "ended" | "soldOut" | "paidInactive";

type Stock = Pick<TicketType, "max_per_order" | "capacity" | "available">;

/**
 * What the buyer can be told before ordering. The stock is a snapshot from when
 * the page loaded; the server re-checks everything under a lock.
 */
export function ticketAvailability(
  tt: Pick<TicketType, "is_free" | "sales_starts_at" | "sales_ends_at" | "min_per_order" | "available">,
  now: Date,
  paidSalesActive: boolean,
): TicketAvailability {
  if (tt.sales_starts_at && now < new Date(tt.sales_starts_at)) return "notStarted";
  if (tt.sales_ends_at && now >= new Date(tt.sales_ends_at)) return "ended";
  if (!tt.is_free && !paidSalesActive) return "paidInactive";
  if (tt.available !== null && tt.available < Math.max(1, tt.min_per_order)) return "soldOut";
  return "available";
}

/** Largest quantity that can be requested for one ticket type. */
export function maxQuantity(tt: Stock): number {
  return Math.min(tt.max_per_order, tt.capacity, tt.available ?? Infinity);
}

/** Zero, or within the per-order limits. Checked again right before submitting. */
export function isQuantityValid(tt: Stock & Pick<TicketType, "min_per_order">, quantity: number): boolean {
  if (quantity === 0) return true;
  return Number.isInteger(quantity) && quantity >= Math.max(1, tt.min_per_order) && quantity <= maxQuantity(tt);
}

// A selection travels in the URL (sign-in round trip, retry after a failed
// checkout) as "id:2,id:1". It is untrusted input: callers clamp it.
export function encodeSelection(items: { ticket_type_id: string; quantity: number }[]): string {
  return items.map((item) => `${item.ticket_type_id}:${item.quantity}`).join(",");
}

export function decodeSelection(value: string | null): Record<string, number> {
  const result: Record<string, number> = {};
  for (const part of (value ?? "").split(",")) {
    const match = /^([0-9a-f-]{36}):(\d{1,3})$/i.exec(part);
    if (match) result[match[1]] = Number(match[2]);
  }
  return result;
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

export type Promo = { code: string } | { campaign_token: string };

export function buildOrder(
  eventId: string,
  quantities: Record<string, number>,
  promo: Promo | null = null,
  attendees: AttendeeRequest[] | null = null,
): OrderCreateRequest {
  return {
    event_id: eventId,
    items: Object.entries(quantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([ticket_type_id, quantity]) => ({ ticket_type_id, quantity })),
    ...(promo && ("code" in promo ? { promo_code: promo.code } : { campaign_token: promo.campaign_token })),
    ...(attendees && { attendees }),
  };
}

/** Event page link that restores a ticket selection and promotion. */
export function eventHref(eventId: string, items: { ticket_type_id: string; quantity: number }[] = [], promo: Promo | null = null): string {
  const params = new URLSearchParams();
  if (items.length > 0) params.set("items", encodeSelection(items));
  if (promo) params.set("code" in promo ? "promo" : "campaign", "code" in promo ? promo.code : promo.campaign_token);
  const query = params.toString();
  return `/catalog/${eventId}${query ? `?${query}` : ""}`;
}

export function formatMoney(amount: string | number, currency: string, intlLocale: string): string {
  return new Intl.NumberFormat(intlLocale, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(amount));
}

/** Only same-site paths are allowed as a post-login redirect (no open redirect). */
export function safeNext(value: string | null | undefined, fallback = "/events"): string {
  // Browsers drop tabs and line breaks and read a backslash as "/", so "/\t/host" would leave the site.
  if (!value || !/^\/(?![/\\])/.test(value) || /[\t\r\n]/.test(value)) return fallback;
  return value;
}
