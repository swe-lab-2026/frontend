import type { Event } from "@/lib/api/types";
import { isoToLocalInput } from "@/lib/datetime";

// "Add to calendar" links (SRS 4.11). They only open a pre-filled form on the
// calendar's own site; BiletFlow never gets access to anyone's calendar.

export type CalendarEvent = Pick<Event, "id" | "title" | "description" | "starts_at" | "ends_at" | "timezone" | "venue_name" | "venue_address" | "city">;

/** Very long URLs are rejected, and the event link has the full text anyway. */
const MAX_DETAILS = 800;

export function calendarLocation(event: CalendarEvent): string {
  return [event.venue_name, event.venue_address, event.city].filter(Boolean).join(", ");
}

function details(event: CalendarEvent, url: string): string {
  const text = event.description?.trim() ?? "";
  const short = text.length > MAX_DETAILS ? `${text.slice(0, MAX_DETAILS).trimEnd()}…` : text;
  return [short, url].filter(Boolean).join("\n\n");
}

/** Wall-clock time plus `ctz`, so the entry keeps the event's own timezone. */
export function googleCalendarUrl(event: CalendarEvent, url: string): string {
  const wall = (iso: string) => `${isoToLocalInput(iso, event.timezone).replace(/[-:]/g, "")}00`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${wall(event.starts_at)}/${wall(event.ends_at)}`,
    ctz: event.timezone,
    details: details(event, url),
    location: calendarLocation(event),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Outlook has no timezone parameter, so it gets exact UTC instants. */
export function outlookCalendarUrl(event: CalendarEvent, url: string): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: new Date(event.starts_at).toISOString(),
    enddt: new Date(event.ends_at).toISOString(),
    body: details(event, url),
    location: calendarLocation(event),
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params}`;
}

/** Plain ASCII where possible: some systems mangle other characters in file names. */
export function icsFilename(event: Pick<Event, "id" | "title">): string {
  const slug = event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return `biletflow-${slug || event.id.slice(0, 8)}.ics`;
}
