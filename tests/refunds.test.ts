import { describe, expect, it } from "vitest";
import type { Refund, RefundEligibility } from "@/lib/api/types";
import { canRefund, currentRefund, deadlineFor, isPaidOrder, parseDeadlineHours, refundWindow } from "@/lib/refunds";

const now = new Date("2026-11-25T12:00:00Z");
const eligibility = (refundable: boolean) => ({ refundable }) as RefundEligibility;
const refund = (id: string, status: string) => ({ id, status }) as Refund;

describe("refundWindow", () => {
  it("is disabled whatever the deadline", () =>
    expect(refundWindow({ refunds_enabled: false, refund_deadline: "2027-01-01T00:00:00Z" }, now)).toBe("disabled"));
  it("is open before the deadline and closed from it on", () => {
    expect(refundWindow({ refunds_enabled: true, refund_deadline: "2026-11-25T12:00:01Z" }, now)).toBe("open");
    expect(refundWindow({ refunds_enabled: true, refund_deadline: "2026-11-25T12:00:00Z" }, now)).toBe("closed");
  });
});

describe("refund deadline", () => {
  it("counts back from the start", () =>
    expect(deadlineFor({ starts_at: "2026-12-01T18:00:00+05:00" }, 24)).toBe("2026-11-30T13:00:00.000Z"));
  it("reads hours, empty meaning until the start", () => {
    expect(parseDeadlineHours(" ")).toBeNull();
    expect(parseDeadlineHours("0")).toBe(0);
    expect(parseDeadlineHours(" 48 ")).toBe(48);
    expect(parseDeadlineHours("8760")).toBe(8760);
  });
  it.each(["8761", "-1", "1.5", "abc", "1e2"])("refuses %s", (value) => expect(parseDeadlineHours(value)).toBeNaN());
});

describe("which orders can be refunded", () => {
  it("only paid ones with a price", () => {
    expect(isPaidOrder({ status: "PAID", total_amount: "5150.00" })).toBe(true);
    expect(isPaidOrder({ status: "PAID", total_amount: "0.00" })).toBe(false);
    expect(isPaidOrder({ status: "REFUNDED", total_amount: "5150.00" })).toBe(false);
  });
  it("only when the server says so", () => {
    const order = { status: "PAID", total_amount: "5150.00" };
    expect(canRefund(order, eligibility(true))).toBe(true);
    expect(canRefund(order, eligibility(false))).toBe(false);
    expect(canRefund(order, null)).toBe(false);
  });
});

describe("currentRefund", () => {
  it("prefers the finished refund over later failures", () =>
    expect(currentRefund([refund("a", "FAILED"), refund("b", "SUCCEEDED"), refund("c", "FAILED")])?.id).toBe("b"));
  it("falls back to the newest attempt", () => expect(currentRefund([refund("a", "FAILED"), refund("b", "PENDING")])?.id).toBe("b"));
  it("handles none", () => expect(currentRefund([])).toBeNull());
});
