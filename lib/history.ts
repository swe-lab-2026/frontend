import type { AuditEntry, EventSummary, SalesPoint, TimelineEntry } from "@/lib/api/types";
import { isoToLocalInput, localInputToIso } from "@/lib/datetime";

export type EventPhase = "DRAFT" | "UPCOMING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
export const EVENT_PHASES: EventPhase[] = ["DRAFT", "UPCOMING", "ACTIVE", "COMPLETED", "CANCELLED"];

/**
 * SRS 4.16 classification. The backend never moves an event to COMPLETED by
 * itself, so an ended event is recognised by its end time.
 */
export function eventPhase(event: Pick<EventSummary, "status" | "starts_at" | "ends_at">, now: Date): EventPhase {
  if (event.status === "CANCELLED" || event.status === "DRAFT") return event.status;
  if (event.status === "COMPLETED" || new Date(event.ends_at) <= now) return "COMPLETED";
  if (event.status === "UNPUBLISHED") return "DRAFT";
  return new Date(event.starts_at) <= now ? "ACTIVE" : "UPCOMING";
}

/** Timeline filters as the server understands them: exact actions or prefixes. */
export const TIMELINE_FILTERS = {
  event: ["event.", "admin.event_"],
  tickets: ["ticket_type."],
  orders: ["order.created", "order.paid", "order.cancelled", "payment."],
  refunds: ["refund.", "order.refunded"],
  campaigns: ["campaign."],
  checkin: ["ticket.checked_in", "ticket.check_in_reversed"],
  support: ["support_case."],
  admin: ["admin."],
} as const satisfies Record<string, readonly string[]>;
export type TimelineFilter = keyof typeof TIMELINE_FILTERS;

/**
 * Who reported an event must not reach its organizer (SRS 4.12), but the
 * timeline currently includes the reporter's name. Until the server leaves
 * these entries out, they are at least not shown.
 */
export function isConfidential(entry: Pick<TimelineEntry, "action">): boolean {
  return entry.action === "event.reported" || entry.action.startsWith("admin.event_report");
}

export type DayRange = { from: string; to: string };

const nextDay = (day: string, days = 1) => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** Inclusive calendar days in the event's timezone -> the API's [start, end). */
export function rangeQuery({ from, to }: DayRange, timeZone: string): { start?: string; end?: string } {
  const at = (day: string) => localInputToIso(`${day}T00:00`, timeZone) ?? undefined;
  return { start: from ? at(from) : undefined, end: to ? at(nextDay(to)) : undefined };
}

export function isBadRange({ from, to }: DayRange): boolean {
  return Boolean(from && to && to < from);
}

const MAX_BUCKETS = 31;
const DEFAULT_DAYS = 14;

/** Days (or equal groups of days for long ranges) to chart. */
export function salesBuckets({ from, to }: DayRange, timeZone: string, now: Date): DayRange[] {
  const today = isoToLocalInput(now.toISOString(), timeZone).slice(0, 10);
  const last = to || (from > today ? from : today);
  const first = from || nextDay(last, 1 - DEFAULT_DAYS);
  const days = Math.round((Date.parse(last) - Date.parse(first)) / 86_400_000) + 1;
  if (days < 1) return [];
  const size = Math.ceil(days / MAX_BUCKETS);
  const buckets: DayRange[] = [];
  for (let start = first; start <= last; start = nextDay(start, size)) {
    const end = nextDay(start, size - 1);
    buckets.push({ from: start, to: end < last ? end : last });
  }
  return buckets;
}

export type SalesBucket = DayRange & { revenue: number; tickets: number };

/** The server sends only days with sales; days without any stay at zero. */
export function sumByBucket(buckets: DayRange[], points: SalesPoint[]): SalesBucket[] {
  return buckets.map((bucket) => {
    // Calendar days of the form YYYY-MM-DD compare correctly as strings.
    const days = points.filter((point) => point.date >= bucket.from && point.date <= bucket.to);
    return {
      ...bucket,
      // Amounts are charted in KZT only: currencies are never added together.
      revenue: days.reduce((sum, point) => sum + (point.currency === "KZT" ? Number(point.gross) : 0), 0),
      tickets: days.reduce((sum, point) => sum + point.tickets, 0),
    };
  });
}

/** Runs `task` for each item, a few at a time, keeping the order of results. */
export async function mapLimited<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** "… changed from A to B" -> [A, B], from the server's description. */
export function statusChange(entry: Pick<TimelineEntry, "description">): [string, string] | null {
  const match = /changed from (\w+) to (\w+)$/.exec(entry.description);
  return match && [match[1], match[2]];
}

/** "Event details updated (starts at, title)" -> ["starts_at", "title"]. */
export function updatedFields(entry: Pick<TimelineEntry, "action" | "description">): string[] {
  const match = entry.action === "event.updated" ? /\(([^)]+)\)$/.exec(entry.description) : null;
  return match ? match[1].split(", ").map((field) => field.replaceAll(" ", "_")) : [];
}

/** Names of fields that differ between `before` and `after`. */
export function changedFields(entry: Pick<AuditEntry, "before" | "after">): string[] {
  const { before, after } = entry;
  if (!before || !after) return [];
  return Object.keys(after).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}

/** One scalar change as "old → new", for short readable descriptions. */
export function scalarChanges(entry: Pick<AuditEntry, "before" | "after">, fields: string[]): string[] {
  const scalar = (value: unknown) => typeof value === "string" || typeof value === "number" || typeof value === "boolean";
  return changedFields(entry)
    .filter((key) => fields.includes(key) && scalar(entry.before?.[key]) && scalar(entry.after?.[key]))
    .map((key) => `${entry.before?.[key]} → ${entry.after?.[key]}`);
}
