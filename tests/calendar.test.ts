import { describe, expect, it } from "vitest";
import { type CalendarEvent, calendarLocation, googleCalendarUrl, icsFilename, outlookCalendarUrl } from "@/lib/calendar";

const event: CalendarEvent = {
  id: "23b0ed7e-10dc-4a77-90ba-e02fdb4d5865",
  title: "Rock & Roll: «Вечер»",
  description: "Doors at 18:00",
  starts_at: "2026-12-01T13:30:00Z",
  ends_at: "2026-12-01T21:00:00Z",
  timezone: "Asia/Almaty",
  venue_name: "Barys Arena",
  venue_address: null,
  city: "Astana",
};
const URL_ = "https://biletflow.kz/catalog/23b0ed7e";

describe("calendar links", () => {
  it("gives Google wall-clock times with the event's timezone", () => {
    const params = new URL(googleCalendarUrl(event, URL_)).searchParams;
    // 13:30 UTC is 18:30 in Almaty; the end falls on the next local day.
    expect(params.get("dates")).toBe("20261201T183000/20261202T020000");
    expect(params.get("ctz")).toBe("Asia/Almaty");
    expect(params.get("text")).toBe(event.title);
    expect(params.get("location")).toBe("Barys Arena, Astana");
    expect(params.get("details")).toBe(`Doors at 18:00\n\n${URL_}`);
  });
  it("gives Outlook exact instants", () => {
    const params = new URL(outlookCalendarUrl(event, URL_)).searchParams;
    expect(params.get("startdt")).toBe("2026-12-01T13:30:00.000Z");
    expect(params.get("enddt")).toBe("2026-12-01T21:00:00.000Z");
    expect(params.get("subject")).toBe(event.title);
  });
  it("shortens a long description but keeps the event link", () => {
    const details = new URL(googleCalendarUrl({ ...event, description: "x".repeat(5000) }, URL_)).searchParams.get("details") ?? "";
    expect(details.length).toBeLessThan(900);
    expect(details.endsWith(URL_)).toBe(true);
  });
  it("copes with no description and no place", () => {
    const bare = { ...event, description: null, venue_name: null, city: null };
    expect(calendarLocation(bare)).toBe("");
    expect(new URL(googleCalendarUrl(bare, URL_)).searchParams.get("details")).toBe(URL_);
  });
});

describe("icsFilename", () => {
  it("uses the Latin part of the title", () => expect(icsFilename(event)).toBe("biletflow-rock-roll.ics"));
  it("falls back to the id", () => expect(icsFilename({ id: event.id, title: "Вечер" })).toBe("biletflow-23b0ed7e.ics"));
});
