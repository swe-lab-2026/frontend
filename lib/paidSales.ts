import type { EventStatus, PaidSalesActivation, PayoutAccount, TicketType } from "@/lib/api/types";

// SRS 3.2 / 4.5. The server checks all of this again when sales are activated.

export type StepId = "verification" | "payout" | "terms" | "fee";
export const STEPS: StepId[] = ["verification", "payout", "terms", "fee"];

type Checklist = Pick<PaidSalesActivation, "verification_complete" | "payout_account_complete" | "terms_accepted" | "activation_fee_paid">;

export function isStepDone(step: StepId, status: Checklist): boolean {
  switch (step) {
    case "verification":
      return status.verification_complete;
    case "payout":
      return status.payout_account_complete;
    case "terms":
      return status.terms_accepted;
    case "fee":
      return status.activation_fee_paid;
  }
}

export function remainingSteps(status: Checklist): StepId[] {
  return STEPS.filter((step) => !isStepDone(step, status));
}

/** Hidden types are not offered to anyone, so they do not need paid sales. */
export function hasPaidTickets(ticketTypes: Pick<TicketType, "is_free" | "is_hidden">[]): boolean {
  return ticketTypes.some((tt) => !tt.is_free && !tt.is_hidden);
}

export function isEventOver(status: EventStatus): boolean {
  return status === "CANCELLED" || status === "COMPLETED";
}

export type SalesPhase = "over" | "stopped" | "eventSuspended" | "open" | "noPaidTickets" | "ready" | "incomplete";

export function salesPhase(status: PaidSalesActivation, eventStatus: EventStatus, paidTickets: boolean): SalesPhase {
  if (isEventOver(eventStatus)) return "over";
  if (status.sales_suspended) return "stopped";
  if (status.event_suspended) return "eventSuspended";
  if (status.is_activated) return "open";
  if (!paidTickets) return "noPaidTickets";
  return remainingSteps(status).length === 0 ? "ready" : "incomplete";
}

/** A decision the platform has made is not offered for a demo override. */
export function canSimulateVerification(verificationStatus: string): boolean {
  return verificationStatus === "NOT_SUBMITTED" || verificationStatus === "PENDING";
}

export type PayoutAction = "add" | "approve" | "blocked";

export function payoutAction(account: Pick<PayoutAccount, "status"> | null): PayoutAction {
  if (account === null) return "add";
  return account.status === "BLOCKED" ? "blocked" : "approve";
}
