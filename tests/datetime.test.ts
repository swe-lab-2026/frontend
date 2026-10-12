import { describe, expect, it } from "vitest";
import { isoToLocalInput, localInputToIso, zoneOffsetMinutes } from "@/lib/datetime";

describe("event timezone conversion", () => {
  it("attaches the venue offset, not the browser's", () => {
    // Kazakhstan has been on a single UTC+5 zone since 2024.
    expect(localInputToIso("2026-11-14T10:00", "Asia/Almaty")).toBe("2026-11-14T10:00:00+05:00");
    expect(localInputToIso("2026-11-14T10:00", "UTC")).toBe("2026-11-14T10:00:00+00:00");
  });

  it("handles daylight-saving zones on both sides of the switch", () => {
    expect(localInputToIso("2026-01-15T12:00", "Europe/Berlin")).toBe("2026-01-15T12:00:00+01:00");
    expect(localInputToIso("2026-07-15T12:00", "Europe/Berlin")).toBe("2026-07-15T12:00:00+02:00");
  });

  it("round-trips through the backend's UTC representation", () => {
    const iso = localInputToIso("2026-11-14T10:00", "Asia/Almaty")!;
    const fromBackend = new Date(iso).toISOString(); // e.g. "2026-11-14T05:00:00.000Z"
    expect(isoToLocalInput(fromBackend, "Asia/Almaty")).toBe("2026-11-14T10:00");
  });

  it("returns empty values for empty input", () => {
    expect(localInputToIso("", "Asia/Almaty")).toBeNull();
    expect(isoToLocalInput(null, "Asia/Almaty")).toBe("");
  });

  it("computes zone offsets in minutes", () => {
    expect(zoneOffsetMinutes(new Date("2026-06-01T00:00:00Z"), "Asia/Almaty")).toBe(300);
    expect(zoneOffsetMinutes(new Date("2026-06-01T00:00:00Z"), "America/New_York")).toBe(-240);
  });
});
