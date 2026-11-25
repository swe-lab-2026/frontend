import type { DisputeStatus, ReportStatus } from "@/lib/api/types";

// The same moves the server allows; it re-checks every one of them.

const DISPUTE_MOVES: Record<DisputeStatus, DisputeStatus[]> = {
  OPEN: ["UNDER_REVIEW", "RESOLVED", "REJECTED"],
  UNDER_REVIEW: ["RESOLVED", "REJECTED"],
  RESOLVED: [],
  REJECTED: [],
};

const REPORT_MOVES: Record<ReportStatus, ReportStatus[]> = {
  OPEN: ["UNDER_REVIEW", "RESOLVED", "DISMISSED"],
  UNDER_REVIEW: ["OPEN", "RESOLVED", "DISMISSED"],
  RESOLVED: [],
  DISMISSED: [],
};

export function disputeMoves(status: string): DisputeStatus[] {
  return DISPUTE_MOVES[status as DisputeStatus] ?? [];
}

export function reportMoves(status: string): ReportStatus[] {
  return REPORT_MOVES[status as ReportStatus] ?? [];
}

/** Only payments that took (demo) money can be disputed. */
export function canDispute(paymentStatus: string): boolean {
  return ["SUCCEEDED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(paymentStatus);
}

/** A decimal within [0, max] with at most two places, as the API expects; null otherwise. */
export function parseSetting(value: string, max: number): string | null {
  const text = value.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(text) || Number(text) > max) return null;
  return text;
}
