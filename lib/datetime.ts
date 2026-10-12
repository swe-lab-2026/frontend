// Event times are entered as wall-clock time in the event's IANA timezone
// (not the browser's), and the backend requires ISO strings with an offset.

export const DEFAULT_TIMEZONE = "Asia/Almaty";

export const TIMEZONES = [
  "Asia/Almaty",
  "Asia/Aqtobe",
  "Asia/Aqtau",
  "Asia/Atyrau",
  "Asia/Oral",
  "Asia/Qostanay",
  "Asia/Qyzylorda",
  "Europe/Moscow",
  "Asia/Tashkent",
  "Asia/Bishkek",
  "UTC",
];

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function partsInZone(date: Date, timeZone: string): Parts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, number> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") map[part.type] = Number(part.value);
  }
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour,
    minute: map.minute,
    second: map.second,
  };
}

/** Offset of `timeZone` from UTC at `date`, in minutes (e.g. +300 for UTC+5). */
export function zoneOffsetMinutes(date: Date, timeZone: string): number {
  const p = partsInZone(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

/**
 * "2026-11-01T19:30" (wall time in `timeZone`) -> "2026-11-01T19:30:00+05:00".
 * Returns null for empty input.
 */
export function localInputToIso(value: string, timeZone: string): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  const naiveUtc = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes handle the case where the offset differs across a DST change.
  let offset = zoneOffsetMinutes(new Date(naiveUtc), timeZone);
  offset = zoneOffsetMinutes(new Date(naiveUtc - offset * 60000), timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:00${formatOffset(offset)}`;
}

/** ISO timestamp -> "YYYY-MM-DDTHH:mm" wall time in `timeZone`, for <input type="datetime-local">. */
export function isoToLocalInput(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const p = partsInZone(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * Browsers often ship no Kazakh month names (Chrome prints "M11"), so Kazakh
 * falls back to numeric dates.
 */
export function hasMonthNames(locale: string): boolean {
  return !locale.startsWith("kk");
}

export function formatDateTime(iso: string | null | undefined, timeZone: string, locale: string): string {
  if (!iso) return "—";
  const options: Intl.DateTimeFormatOptions = hasMonthNames(locale)
    ? { dateStyle: "medium", timeStyle: "short" }
    : { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
  return new Intl.DateTimeFormat(locale, { timeZone, ...options }).format(new Date(iso));
}
