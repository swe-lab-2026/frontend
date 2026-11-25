import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { fetchPayoutAccount } from "@/lib/api/endpoints";
import type { PaidSalesActivation } from "@/lib/api/types";
import { canSimulateVerification, hasPaidTickets, payoutAction, remainingSteps, salesPhase } from "@/lib/paidSales";

const status = (over: Partial<PaidSalesActivation> = {}): PaidSalesActivation => ({
  event_id: "e1",
  verification_complete: true,
  payout_account_complete: true,
  activation_fee_amount: "1000.00",
  activation_fee_paid: true,
  terms_accepted: true,
  is_activated: false,
  activated_at: null,
  sales_suspended: false,
  sales_suspended_at: null,
  sales_suspension_reason: null,
  event_suspended: false,
  paid_sales_open: false,
  ...over,
});

describe("remainingSteps", () => {
  it("is empty once everything is complete", () => expect(remainingSteps(status())).toEqual([]));
  it("lists what is missing in display order", () => {
    expect(remainingSteps(status({ activation_fee_paid: false, verification_complete: false }))).toEqual(["verification", "fee"]);
    expect(remainingSteps(status({ terms_accepted: false, payout_account_complete: false }))).toEqual(["payout", "terms"]);
  });
});

describe("salesPhase", () => {
  it("is ready only when every step is complete", () => {
    expect(salesPhase(status(), "DRAFT", true)).toBe("ready");
    expect(salesPhase(status({ terms_accepted: false }), "DRAFT", true)).toBe("incomplete");
  });
  it("has nothing to activate without paid tickets", () => expect(salesPhase(status(), "PUBLISHED", false)).toBe("noPaidTickets"));
  it("stays open after activation even if the paid type is hidden later", () =>
    expect(salesPhase(status({ is_activated: true }), "PUBLISHED", false)).toBe("open"));
  it("puts a platform stop before everything the organizer can do", () => {
    expect(salesPhase(status({ is_activated: true, sales_suspended: true }), "PUBLISHED", true)).toBe("stopped");
    expect(salesPhase(status({ sales_suspended: true }), "PUBLISHED", true)).toBe("stopped");
    expect(salesPhase(status({ is_activated: true, event_suspended: true }), "PUBLISHED", true)).toBe("eventSuspended");
  });
  it.each(["CANCELLED", "COMPLETED"] as const)("is over for a %s event", (eventStatus) =>
    expect(salesPhase(status({ is_activated: true }), eventStatus, true)).toBe("over"));
});

describe("hasPaidTickets", () => {
  it.each([
    [[], false],
    [[{ is_free: true, is_hidden: false }], false],
    [[{ is_free: false, is_hidden: true }], false],
    [[{ is_free: true, is_hidden: false }, { is_free: false, is_hidden: false }], true],
  ])("%j -> %s", (types, expected) => expect(hasPaidTickets(types)).toBe(expected));
});

describe("demo approvals", () => {
  it("never offers to override a platform decision", () => {
    expect(canSimulateVerification("REJECTED")).toBe(false);
    expect(payoutAction({ status: "BLOCKED" })).toBe("blocked");
  });
  it("offers the next step otherwise", () => {
    expect(canSimulateVerification("NOT_SUBMITTED")).toBe(true);
    expect(canSimulateVerification("PENDING")).toBe(true);
    expect(payoutAction(null)).toBe("add");
    expect(payoutAction({ status: "PENDING" })).toBe("approve");
  });
});

describe("fetchPayoutAccount", () => {
  afterEach(() => vi.unstubAllGlobals());
  const respond = (httpStatus: number, code: string) =>
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code, message: "", details: {} } }), { status: httpStatus })));

  it("is null when there is no account yet", async () => {
    respond(404, "PAYOUT_ACCOUNT_NOT_FOUND");
    expect(await fetchPayoutAccount()).toBeNull();
  });
  it("does not hide other failures", async () => {
    respond(404, "ORGANIZER_PROFILE_NOT_FOUND");
    await expect(fetchPayoutAccount()).rejects.toBeInstanceOf(ApiError);
  });
});
