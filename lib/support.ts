import type { ReportStatus, SupportCase, SupportCategory, SupportMessage, SupportStatus } from "@/lib/api/types";
import type { BadgeTone } from "@/lib/tickets";

export const SUPPORT_CATEGORIES: SupportCategory[] = [
  "TICKET_DELIVERY", "PAYMENT", "REFUND", "SEATING", "EVENT_INFORMATION", "CHECK_IN", "ACCOUNT", "TECHNICAL",
];
export const SUPPORT_STATUSES: SupportStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED"];
export const MESSAGE_MAX = 5000;

// Mirrors _TRANSITIONS / _status_allowed in backend app/services/support.py, so
// only buttons the server would accept are offered. The server still decides.
const TRANSITIONS: Record<SupportStatus, SupportStatus[]> = {
  OPEN: ["IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED"],
  IN_PROGRESS: ["WAITING_FOR_CUSTOMER", "RESOLVED"],
  WAITING_FOR_CUSTOMER: ["IN_PROGRESS", "RESOLVED"],
  RESOLVED: ["OPEN", "IN_PROGRESS"],
};

export function allowedStatuses(status: SupportStatus, canManage: boolean): SupportStatus[] {
  const next = TRANSITIONS[status] ?? [];
  if (canManage) return next;
  return next.filter((target) => target === "RESOLVED" || (status === "RESOLVED" && target === "OPEN"));
}

const TONES: Record<SupportStatus, BadgeTone> = {
  OPEN: "info",
  IN_PROGRESS: "warning",
  WAITING_FOR_CUSTOMER: "neutral",
  RESOLVED: "success",
};

export function supportTone(status: SupportCase["status"]): BadgeTone {
  return TONES[status] ?? "neutral";
}

/** A sensible first guess; the requester can change it. */
export function defaultCategory(context: { ticket?: unknown; order?: unknown; event?: unknown }): SupportCategory {
  if (context.ticket) return "TICKET_DELIVERY";
  if (context.order) return "PAYMENT";
  if (context.event) return "EVENT_INFORMATION";
  return "ACCOUNT";
}

/** Merges polled messages by sequence, so overlapping responses never duplicate one. */
export function mergeMessages(current: SupportMessage[], incoming: SupportMessage[]): SupportMessage[] {
  if (incoming.length === 0) return current;
  const bySequence = new Map(current.map((message) => [message.sequence, message]));
  for (const message of incoming) bySequence.set(message.sequence, message);
  return [...bySequence.values()].sort((a, b) => a.sequence - b.sequence);
}

/** Cursor for the next poll: everything up to here has been received without gaps. */
export function pollCursor(messages: SupportMessage[]): number {
  let cursor = 0;
  for (const message of messages) {
    if (message.sequence !== cursor + 1) break;
    cursor = message.sequence;
  }
  return cursor;
}

const REPORT_TONES: Record<ReportStatus, BadgeTone> = {
  OPEN: "info",
  UNDER_REVIEW: "warning",
  RESOLVED: "success",
  DISMISSED: "neutral",
};

export function reportTone(status: string): BadgeTone {
  return REPORT_TONES[status as ReportStatus] ?? "neutral";
}
