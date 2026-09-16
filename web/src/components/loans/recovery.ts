import type { BadgeTone } from "@/components/ui/Badge";

/** The four parts a write-off recovery is split into, in allocation order (C3 Option B). */
export const RECOVERY_COMPONENTS = ["principal", "penalty", "interest", "insurance"] as const;

export type RecoveryComponent = (typeof RECOVERY_COMPONENTS)[number];

/** One component of a write-off: written off, recovered by standing recoveries, still recoverable. */
export interface RecoveryComponentPosition {
  written_off: number;
  recovered: number;
  remaining: number;
}

/**
 * How the split at write-off is known: stored when the write-off was posted (snapshot), reproduced from the loan's own records
 * (derived), or unknown (ambiguous — no recovery can be recorded until the snapshot is set).
 */
export type ComponentsStatus = "snapshot" | "derived" | "ambiguous";

/** Recovery position of a written-off loan (LoanRecoveryService::position). */
export interface RecoveryPosition {
  write_off_id: number | null;
  written_off: number;
  recovered: number;
  unrecovered: number;
  status: "NOT_RECOVERED" | "PARTIALLY_RECOVERED" | "FULLY_RECOVERED";
  components_status?: ComponentsStatus | null;
  ambiguous_reason?: string | null;
  components?: Record<RecoveryComponent, RecoveryComponentPosition> | null;
  /** Branch money for the loan waiting for Finance (not yet a recovery). */
  pending?: number;
}

/** A recovery after write-off with its component split and the server-computed reversal eligibility. */
export interface LoanRecoveryRow {
  id: number;
  date: string | null;
  amount: number;
  /** Posted under the old rule: interest only. */
  legacy?: boolean;
  principal?: number;
  penalty?: number;
  interest?: number;
  reserve?: number;
  insurance?: number;
  method: string;
  reference: string | null;
  receipt_number: string | null;
  employee: string | null;
  journal_reference: string | null;
  reversed: boolean;
  reversed_at: string | null;
  reversed_by: string | null;
  reversal_reason: string | null;
  reversal_reference: string | null;
  can_reverse: boolean;
  reverse_blocked_reason: string | null;
}

/** Loan fee memo (rule 7): a fee that is not deducted is never part of the loan. */
export interface LoanFeeMemo {
  amount: number;
  deducted: boolean;
  note: string;
}

export function recoveryStatusTone(status: RecoveryPosition["status"]): BadgeTone {
  return status === "FULLY_RECOVERED" ? "success" : status === "PARTIALLY_RECOVERED" ? "warning" : "danger";
}

export function recoveryStatusLabel(status: RecoveryPosition["status"]): string {
  return status.replaceAll("_", " ");
}

export function isAmbiguous(position: RecoveryPosition | null | undefined): boolean {
  return position?.components_status === "ambiguous";
}

/** A recovery can be recorded on a written-off loan whose split is known and whose write-off is not fully recovered. */
export function canRecordRecovery(position: RecoveryPosition | null | undefined, loanStatus: string): boolean {
  return loanStatus === "written_off" && !isAmbiguous(position) && (position?.unrecovered ?? 0) > 0.004;
}

/** Client-side hint only (the server re-checks): the typed amount above the unrecovered balance, in TZS. */
export function recoveryExcess(position: RecoveryPosition, amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }
  return Math.max(0, Math.round(amount * 100) - Math.round(position.unrecovered * 100)) / 100;
}

/**
 * Preview (the server decides) of how an amount is split Principal → Penalty → Interest → Insurance over the remaining
 * components, with the interest reserve cut at `reservePercent`, all in exact cents.
 */
export function previewRecoverySplit(position: RecoveryPosition, amount: number, reservePercent = 20): Record<RecoveryComponent | "reserve" | "excess", number> {
  const split = { principal: 0, penalty: 0, interest: 0, insurance: 0, reserve: 0, excess: 0 };
  if (!position.components || !Number.isFinite(amount) || amount <= 0) {
    return split;
  }
  let left = Math.round(amount * 100);
  for (const component of RECOVERY_COMPONENTS) {
    const portion = Math.min(left, Math.round(position.components[component].remaining * 100));
    split[component] = portion / 100;
    left -= portion;
  }
  split.reserve = Math.round(split.interest * reservePercent) / 100;
  split.excess = left / 100;

  return split;
}
