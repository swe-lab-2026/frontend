import type { Order, OrderStatus, Ticket, TicketStatus } from "./api/types";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

/** Both mean "committed": free registrations and paid checkouts respectively. */
export function isOrderConfirmed(status: OrderStatus): boolean {
  return status === "PAID" || status === "CONFIRMED";
}

/**
 * Only a VALID ticket is usable for entry, so only it gets a QR code and the
 * download/print actions. Checked-in, cancelled and refunded tickets are shown
 * with their status but nothing that could be presented at the door.
 */
export function isTicketUsable(ticket: Pick<Ticket, "status">): boolean {
  return ticket.status === "VALID";
}

const TICKET_TONES: Record<string, BadgeTone> = {
  VALID: "success",
  CHECKED_IN: "info",
  CANCELLED: "danger",
  REFUNDED: "warning",
};

export function ticketTone(status: TicketStatus): BadgeTone {
  return TICKET_TONES[status] ?? "neutral";
}

const ORDER_TONES: Record<string, BadgeTone> = {
  PAID: "success",
  CONFIRMED: "success",
  PENDING: "warning",
  PARTIALLY_REFUNDED: "warning",
  REFUNDED: "warning",
  CANCELLED: "danger",
  EXPIRED: "neutral",
};

export function orderTone(status: OrderStatus): BadgeTone {
  return ORDER_TONES[status] ?? "neutral";
}

/** Event title for an order list row; tickets carry it, pending orders do not. */
export function orderEventTitle(order: Pick<Order, "tickets">): string | null {
  return order.tickets[0]?.event_title ?? null;
}

export function ticketPdfFilename(publicId: string): string {
  return `biletflow-ticket-${publicId}.pdf`;
}

export function ticketCount(order: Pick<Order, "items">): number {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * Whether the buyer may cancel this order from the web app. Cancelling only
 * invalidates tickets; it does not refund money, so confirmed PAID orders are
 * left to a refund flow (SRS 4.9: organizers cancel free registrations).
 */
export function canCancelOrder(
  order: Pick<Order, "status" | "is_free" | "tickets">,
): boolean {
  if (order.tickets.some((ticket) => ticket.status === "CHECKED_IN")) return false;
  if (order.status === "PENDING") return true;
  return isOrderConfirmed(order.status) && order.is_free;
}
