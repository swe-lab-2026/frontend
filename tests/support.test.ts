import { describe, expect, it } from "vitest";
import type { SupportMessage } from "@/lib/api/types";
import { allowedStatuses, defaultCategory, mergeMessages, pollCursor } from "@/lib/support";

const msg = (sequence: number, body = "x"): SupportMessage => ({ id: String(sequence), sequence, sender: { user_id: null, display_name: null, role: null }, body, created_at: "" });

describe("allowedStatuses", () => {
  it("lets handlers make every server transition", () => {
    expect(allowedStatuses("OPEN", true)).toEqual(["IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED"]);
    expect(allowedStatuses("RESOLVED", true)).toEqual(["OPEN", "IN_PROGRESS"]);
  });
  it("lets requesters only resolve or reopen", () => {
    expect(allowedStatuses("OPEN", false)).toEqual(["RESOLVED"]);
    expect(allowedStatuses("WAITING_FOR_CUSTOMER", false)).toEqual(["RESOLVED"]);
    expect(allowedStatuses("RESOLVED", false)).toEqual(["OPEN"]);
  });
});

describe("messages", () => {
  it("merges overlapping polls without duplicates, in order", () =>
    expect(mergeMessages([msg(1), msg(2)], [msg(3), msg(2)]).map((m) => m.sequence)).toEqual([1, 2, 3]));
  it("keeps the same array when nothing arrived", () => {
    const current = [msg(1)];
    expect(mergeMessages(current, [])).toBe(current);
  });
  it("polls from before a gap, so a message that overtook another is not lost", () => {
    expect(pollCursor([])).toBe(0);
    expect(pollCursor([msg(1), msg(2)])).toBe(2);
    expect(pollCursor([msg(1), msg(3)])).toBe(1);
  });
});

describe("defaultCategory", () => {
  it("follows the most specific context", () => {
    expect(defaultCategory({ ticket: {}, order: {}, event: {} })).toBe("TICKET_DELIVERY");
    expect(defaultCategory({ ticket: null, order: {}, event: {} })).toBe("PAYMENT");
    expect(defaultCategory({ event: {} })).toBe("EVENT_INFORMATION");
    expect(defaultCategory({})).toBe("ACCOUNT");
  });
});
