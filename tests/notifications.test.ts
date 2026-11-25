import { describe, expect, it } from "vitest";
import en from "@/lib/i18n/en";
import { notificationHref, notificationText } from "@/lib/notifications";

const ID = "23b0ed7e-10dc-4a77-90ba-e02fdb4d5865";

describe("notificationHref", () => {
  it("opens what the notification is about", () => {
    expect(notificationHref({ type: "SUPPORT_MESSAGE_RECEIVED", payload: { case_id: ID, event_id: ID } })).toBe(`/support/${ID}`);
    expect(notificationHref({ type: "EVENT_SUSPENDED", payload: { event_id: ID } })).toBe(`/events/${ID}`);
    expect(notificationHref({ type: "PAID_SALES_STOPPED", payload: { event_id: ID } })).toBe(`/events/${ID}/paid-sales`);
    expect(notificationHref({ type: "EVENT_REPORT_REVIEWED", payload: { event_id: ID } })).toBe("/support/reports");
    expect(notificationHref({ type: "PAYOUT_STATUS_CHANGED", payload: { payout_account_id: ID } })).toBe("/profile#payout");
  });
  it("builds no link from a missing or malformed id", () => {
    expect(notificationHref({ type: "SUPPORT_CASE_CREATED", payload: {} })).toBeNull();
    expect(notificationHref({ type: "SUPPORT_CASE_CREATED", payload: { case_id: "../admin" } })).toBeNull();
    expect(notificationHref({ type: "EVENT_SUSPENDED", payload: { event_id: 5 } })).toBeNull();
  });
  it("leaves unknown types without a link", () => expect(notificationHref({ type: "SOMETHING_NEW", payload: { event_id: ID } })).toBeNull());
});

describe("notificationText", () => {
  it("names the subject and the new status", () =>
    expect(notificationText({ type: "SUPPORT_CASE_STATUS_CHANGED", payload: { subject: "No ticket", to_status: "IN_PROGRESS" } }, en)).toEqual({
      title: "Support request status changed",
      details: "No ticket · In progress",
    }));
  it("says how a report ended", () =>
    expect(notificationText({ type: "EVENT_REPORT_REVIEWED", payload: { title: "Gig", status: "DISMISSED" } }, en).details).toBe("Gig · Dismissed"));
  it("gives the new payout status and the reason", () =>
    expect(notificationText({ type: "PAYOUT_STATUS_CHANGED", payload: { previous_status: "PENDING", status: "BLOCKED", reason: "Name mismatch" } }, en)).toEqual({
      title: "Payout account status changed",
      details: "Blocked · Name mismatch",
    }));
  it("copes with a payout change that carries no reason", () =>
    expect(notificationText({ type: "PAYOUT_STATUS_CHANGED", payload: { status: "ACTIVE", reason: null } }, en).details).toBe("Active"));
  it("does not mix a case's current status into a new message", () =>
    expect(notificationText({ type: "SUPPORT_MESSAGE_RECEIVED", payload: { subject: "Help", status: "OPEN" } }, en).details).toBe("Help"));
  it("falls back for types added later", () =>
    expect(notificationText({ type: "SOMETHING_NEW", payload: {} }, en)).toEqual({ title: "Notification", details: null }));
});
