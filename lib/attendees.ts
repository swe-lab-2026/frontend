import type { AttendeeRequest, EventAttendee, OrderItemRequest } from "@/lib/api/types";
import type { ApiError } from "@/lib/api/client";
import { EMAIL_RE } from "@/lib/validation";

/** The API takes at most this many named attendees in one order. */
export const MAX_ATTENDEES = 100;
export const ATTENDEE_NAME_MAX = 200;

export type AttendeeDraft = { full_name: string; email: string };
export type AttendeeErrors = Partial<Record<keyof AttendeeDraft, "required" | "email">>;

/** One ticket of the selection. The key keeps typed details when quantities change. */
export type AttendeeSlot = { key: string; ticket_type_id: string; number: number; total: number };

export const EMPTY_ATTENDEE: AttendeeDraft = { full_name: "", email: "" };

export function attendeeSlots(items: OrderItemRequest[]): AttendeeSlot[] {
  return items.flatMap(({ ticket_type_id, quantity }) =>
    Array.from({ length: quantity }, (_, index) => ({
      key: `${ticket_type_id}:${index}`,
      ticket_type_id,
      number: index + 1,
      total: quantity,
    })),
  );
}

/** Problems by slot key; empty when every ticket has a name and an email. */
export function validateAttendees(slots: AttendeeSlot[], drafts: Record<string, AttendeeDraft>): Record<string, AttendeeErrors> {
  const result: Record<string, AttendeeErrors> = {};
  for (const { key } of slots) {
    const draft = drafts[key] ?? EMPTY_ATTENDEE;
    const errors: AttendeeErrors = {};
    if (!draft.full_name.trim()) errors.full_name = "required";
    if (!draft.email.trim()) errors.email = "required";
    else if (!EMAIL_RE.test(draft.email.trim())) errors.email = "email";
    if (errors.full_name || errors.email) result[key] = errors;
  }
  return result;
}

/** Exactly one entry per ticket, in slot order. */
export function toAttendees(slots: AttendeeSlot[], drafts: Record<string, AttendeeDraft>): AttendeeRequest[] {
  return slots.map(({ key, ticket_type_id }) => {
    const draft = drafts[key] ?? EMPTY_ATTENDEE;
    return { ticket_type_id, full_name: draft.full_name.trim(), email: draft.email.trim() };
  });
}

/** The server checks emails more strictly; puts its "attendees.2.email" errors on the right ticket. */
export function serverAttendeeErrors(error: ApiError, slots: AttendeeSlot[]): Record<string, AttendeeErrors> {
  const result: Record<string, AttendeeErrors> = {};
  for (const path of Object.keys(error.fieldErrors())) {
    const match = /^attendees\.(\d+)\.(full_name|email)$/.exec(path);
    const slot = match && slots[Number(match[1])];
    if (!slot) continue;
    const field = match[2] as keyof AttendeeDraft;
    (result[slot.key] ??= {})[field] = field === "email" ? "email" : "required";
  }
  return result;
}

export type AttendeeOrder = { order_id: string; attendees: EventAttendee[] };

/**
 * The API lists one row per person, and one order can name several people.
 * Cancelling works on the whole order, so its people are kept together.
 */
export function groupByOrder(attendees: EventAttendee[]): AttendeeOrder[] {
  const groups = new Map<string, EventAttendee[]>();
  for (const attendee of attendees) {
    const group = groups.get(attendee.order_id);
    if (group) group.push(attendee);
    else groups.set(attendee.order_id, [attendee]);
  }
  return [...groups].map(([order_id, people]) => ({ order_id, attendees: people }));
}
