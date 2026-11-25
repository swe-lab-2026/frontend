import type { AppNotification } from "@/lib/api/types";
import type { Dictionary } from "@/lib/i18n/en";

const UUID_RE = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** Payload values become part of a link, so anything but a UUID is ignored. */
function id(value: unknown): string | null {
  return typeof value === "string" && UUID_RE.test(value) ? value : null;
}

/** The page a notification is about; null when there is nothing to open. */
export function notificationHref({ type, payload }: Pick<AppNotification, "type" | "payload">): string | null {
  if (type === "EVENT_REPORT_REVIEWED") return "/support/reports";
  if (type.startsWith("SUPPORT_")) {
    const caseId = id(payload.case_id);
    return caseId && `/support/${caseId}`;
  }
  const eventId = id(payload.event_id);
  if (!eventId) return null;
  if (type.startsWith("PAID_SALES_")) return `/events/${eventId}/paid-sales`;
  return type.startsWith("EVENT_") ? `/events/${eventId}` : null;
}

/** A title, and what it is about when the payload says so. */
export function notificationText({ type, payload }: Pick<AppNotification, "type" | "payload">, t: Dictionary): { title: string; details: string | null } {
  const title = (t.notifications.types as Record<string, string>)[type] ?? t.notifications.other;
  const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
  const status = text(payload.status);
  const statusLabel =
    type === "EVENT_REPORT_REVIEWED"
      ? (t.reports.status as Record<string, string>)[status ?? ""]
      : type === "SUPPORT_CASE_STATUS_CHANGED"
        ? (t.support.status as Record<string, string>)[text(payload.to_status) ?? ""]
        : undefined;
  const details = [text(payload.subject) ?? text(payload.title), statusLabel, text(payload.reason)].filter(Boolean).join(" · ");
  return { title, details: details || null };
}
