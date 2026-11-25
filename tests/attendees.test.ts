import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import type { EventAttendee } from "@/lib/api/types";
import { attendeeSlots, groupByOrder, serverAttendeeErrors, toAttendees, validateAttendees } from "@/lib/attendees";
import { buildOrder } from "@/lib/registration";

const ITEMS = [
  { ticket_type_id: "ga", quantity: 2 },
  { ticket_type_id: "vip", quantity: 1 },
];
const SLOTS = attendeeSlots(ITEMS);
const DRAFTS = {
  "ga:0": { full_name: " Aigerim N. ", email: " aigerim@example.com " },
  "ga:1": { full_name: "Daniyar K.", email: "daniyar@example.com" },
  "vip:0": { full_name: "Me Myself", email: "me@example.com" },
};

describe("attendeeSlots", () => {
  it("has one slot per ticket, numbered within its type", () =>
    expect(SLOTS).toEqual([
      { key: "ga:0", ticket_type_id: "ga", number: 1, total: 2 },
      { key: "ga:1", ticket_type_id: "ga", number: 2, total: 2 },
      { key: "vip:0", ticket_type_id: "vip", number: 1, total: 1 },
    ]));
  it("keeps the keys of the remaining tickets when one is removed", () =>
    expect(attendeeSlots([{ ticket_type_id: "ga", quantity: 1 }, ITEMS[1]]).map((s) => s.key)).toEqual(["ga:0", "vip:0"]));
});

describe("validateAttendees", () => {
  it("accepts complete details and has nothing to check without slots", () => {
    expect(validateAttendees(SLOTS, DRAFTS)).toEqual({});
    expect(validateAttendees([], {})).toEqual({});
  });
  it("reports missing and malformed fields on their own ticket", () =>
    expect(validateAttendees(SLOTS, { ...DRAFTS, "ga:1": { full_name: "  ", email: "nope" }, "vip:0": { full_name: "X", email: "" } })).toEqual({
      "ga:1": { full_name: "required", email: "email" },
      "vip:0": { email: "required" },
    }));
  it("treats an untouched ticket as empty", () =>
    expect(validateAttendees([SLOTS[0]], {})).toEqual({ "ga:0": { full_name: "required", email: "required" } }));
});

describe("order attendees", () => {
  it("sends exactly one trimmed entry per ticket", () =>
    expect(toAttendees(SLOTS, DRAFTS)).toEqual([
      { ticket_type_id: "ga", full_name: "Aigerim N.", email: "aigerim@example.com" },
      { ticket_type_id: "ga", full_name: "Daniyar K.", email: "daniyar@example.com" },
      { ticket_type_id: "vip", full_name: "Me Myself", email: "me@example.com" },
    ]));
  it("is left out of the order when the tickets are for the buyer", () => {
    expect(buildOrder("e1", { ga: 1 })).not.toHaveProperty("attendees");
    expect(buildOrder("e1", { ga: 1 }, null, toAttendees([SLOTS[0]], DRAFTS)).attendees).toHaveLength(1);
  });
  it("ignores details typed for tickets that were removed again", () => {
    const slots = attendeeSlots([{ ticket_type_id: "ga", quantity: 1 }]);
    expect(toAttendees(slots, DRAFTS).map((a) => a.full_name)).toEqual(["Aigerim N."]);
  });
});

describe("serverAttendeeErrors", () => {
  const error = (...locs: (string | number)[][]) =>
    new ApiError(422, "VALIDATION_ERROR", "", { errors: locs.map((loc) => ({ loc: ["body", ...loc], msg: "bad", type: "value_error" })) });

  it("maps list positions back to tickets", () =>
    expect(serverAttendeeErrors(error(["attendees", 1, "email"], ["attendees", 2, "full_name"]), SLOTS)).toEqual({
      "ga:1": { email: "email" },
      "vip:0": { full_name: "required" },
    }));
  it("ignores other fields and unknown positions", () =>
    expect(serverAttendeeErrors(error(["items"], ["attendees", 9, "email"], ["attendees"]), SLOTS)).toEqual({}));
});

describe("groupByOrder", () => {
  const row = (attendee_id: string, order_id: string) => ({ attendee_id, order_id }) as EventAttendee;
  it("keeps the people of one order together, in the order received", () => {
    const groups = groupByOrder([row("a", "o2"), row("b", "o1"), row("c", "o2")]);
    expect(groups.map((g) => [g.order_id, g.attendees.map((a) => a.attendee_id)])).toEqual([
      ["o2", ["a", "c"]],
      ["o1", ["b"]],
    ]);
  });
});
