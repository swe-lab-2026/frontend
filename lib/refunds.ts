import type { Event, Order, Refund, RefundEligibility, RefundPolicy } from "@/lib/api/types";

/** The API rejects more than a year. */
export const MAX_DEADLINE_HOURS = 8760;

export type RefundWindow = "disabled" | "open" | "closed";

/** Whether attendees can refund paid orders themselves at `now`. Organizers are not bound by it. */
export function refundWindow(policy: Pick<RefundPolicy, "refunds_enabled" | "refund_deadline">, now: Date): RefundWindow {
  if (!policy.refunds_enabled) return "disabled";
  return policy.refund_deadline && now >= new Date(policy.refund_deadline) ? "closed" : "open";
}

/** The moment attendee refunds close for the given settings (ISO). */
export function deadlineFor(event: Pick<Event, "starts_at">, hours: number): string {
  return new Date(new Date(event.starts_at).getTime() - hours * 3_600_000).toISOString();
}

/** Empty means "until the start"; NaN marks input the API would reject. */
export function parseDeadlineHours(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  if (!/^\d+$/.test(text)) return NaN;
  const hours = Number(text);
  return hours <= MAX_DEADLINE_HOURS ? hours : NaN;
}

export function isPaidOrder(order: Pick<Order, "status" | "total_amount">): boolean {
  return order.status === "PAID" && Number(order.total_amount) > 0;
}

/** Cancelling a paid order is a refund, so the two never appear together. */
export function canRefund(order: Pick<Order, "status" | "total_amount">, eligibility: RefundEligibility | null): boolean {
  return isPaidOrder(order) && eligibility?.refundable === true;
}

/** The refund to show on an order: a finished one first, else the newest attempt. */
export function currentRefund(refunds: Refund[]): Refund | null {
  return refunds.findLast((refund) => refund.status === "SUCCEEDED") ?? refunds.at(-1) ?? null;
}
