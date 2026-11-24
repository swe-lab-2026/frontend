import type { Order } from "@/lib/api/types";
import { eventHref } from "@/lib/registration";

/** Whole seconds until the reservation is released; 0 once it has lapsed. */
export function secondsLeft(expiresAt: string | null, now: number): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
}

export function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Back to the event with the same tickets (and promo code) selected. */
export function retryHref(order: Pick<Order, "event_id" | "items" | "promo_code">): string {
  return eventHref(order.event_id, order.items, order.promo_code ? { code: order.promo_code } : null);
}

/** An unpaid order that ended without tickets, so the buyer can start over. */
export function canRetry(order: Pick<Order, "status" | "paid_at">): boolean {
  return (order.status === "EXPIRED" || order.status === "CANCELLED") && !order.paid_at;
}
