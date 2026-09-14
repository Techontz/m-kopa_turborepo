/**
 * Early full settlement freeze (loan category "Freeze Time (Days)") as returned by the API: `freeze` on the eligibility
 * responses and `customer_freeze` on the loan detail. A loan fully settled BEFORE its scheduled completion date freezes
 * re-borrowing from its DISBURSEMENT date for the category's days. All times are server timestamps (ISO 8601 with offset).
 */
export type FreezeState = "frozen" | "expired" | "none";

/** One loan's disbursement → expected completion → settlement → freeze window. */
export interface LoanSettlement {
  id: number;
  loan_number: string;
  loan_category: string | null;
  disbursed_at: string | null;
  expected_completion_date: string | null;
  settled_at: string | null;
  early_settlement: boolean | null;
  freeze_days: number | null;
  freeze_started_at: string | null;
  frozen_until: string | null;
  frozen_until_label: string | null;
  freeze_status: FreezeState;
}

export interface CustomerFreeze {
  status: FreezeState;
  frozen: boolean;
  reborrowing_status: "Frozen" | "Available";
  reason: string | null;
  loan_id: number | null;
  loan_number: string | null;
  loan_category: string | null;
  freeze_days: number | null;
  freeze_started_at: string | null;
  frozen_until: string | null;
  frozen_until_label: string | null;
  remaining_seconds: number;
  checked_at: string;
  message: string | null;
  previous_loan: LoanSettlement | null;
}

export interface FreezeView {
  state: FreezeState;
  /** Re-borrowing Status */
  label: "Frozen" | "Available";
  tone: "danger" | "success";
  reason: string | null;
  remaining: string | null;
  until: string | null;
}

export const FREEZE_REASON = "Previous loan was fully settled early.";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const plural = (value: number, unit: string) => `${value} ${unit}${value === 1 ? "" : "s"}`;

/** "5 days 4 hours", "3 hours 12 minutes", "45 minutes", "less than a minute"; empty when nothing remains. */
export function formatRemaining(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "";
  }
  const days = Math.floor(seconds / DAY);
  const hours = Math.floor((seconds % DAY) / HOUR);
  const minutes = Math.floor((seconds % HOUR) / MINUTE);

  if (days > 0) {
    return hours > 0 ? `${plural(days, "day")} ${plural(hours, "hour")}` : plural(days, "day");
  }
  if (hours > 0) {
    return minutes > 0 ? `${plural(hours, "hour")} ${plural(minutes, "minute")}` : plural(hours, "hour");
  }
  return minutes > 0 ? plural(minutes, "minute") : "less than a minute";
}

/**
 * Server date/time as the server wrote it (no device time-zone shift, so it matches the API message):
 * "2026-10-01T10:00:00+00:00" → "01 Oct 2026, 10:00"; midnight or a date-only value → "01 Oct 2026".
 */
export function formatFreezeUntil(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(value);
  if (!match) {
    return value;
  }
  const [, year, month, day, hour, minute] = match;
  const date = `${day} ${MONTHS[Number(month) - 1]} ${year}`;
  return hour === undefined || (hour === "00" && minute === "00") ? date : `${date}, ${hour}:${minute}`;
}

/**
 * Seconds of freeze left, from server timestamps only (frozen_until − checked_at) minus the time elapsed on this
 * device since the response arrived — a wrong device clock never shows a customer as available.
 */
export function remainingSeconds(freeze: Pick<CustomerFreeze, "frozen_until" | "checked_at">, elapsedMs = 0): number {
  if (!freeze.frozen_until) {
    return 0;
  }
  const until = new Date(freeze.frozen_until).getTime();
  const checked = new Date(freeze.checked_at).getTime();
  if (Number.isNaN(until) || Number.isNaN(checked)) {
    return 0;
  }
  return Math.max(0, Math.floor((until - checked - elapsedMs) / 1000));
}

/** Re-borrowing Status: Frozen (reason, remaining, until) while the server says frozen and time is left, else Available. */
export function freezeView(freeze: CustomerFreeze | null | undefined, elapsedMs = 0): FreezeView {
  if (!freeze || freeze.status === "none" || !freeze.frozen_until) {
    return { state: "none", label: "Available", tone: "success", reason: null, remaining: null, until: null };
  }
  const left = freeze.frozen ? remainingSeconds(freeze, elapsedMs) : 0;
  const until = formatFreezeUntil(freeze.frozen_until);
  const reason = freeze.reason ?? FREEZE_REASON;
  if (left > 0) {
    return { state: "frozen", label: "Frozen", tone: "danger", reason, remaining: formatRemaining(left), until };
  }
  return { state: "expired", label: "Available", tone: "success", reason, remaining: null, until };
}

/** Customer may apply only when eligible AND not frozen. */
export function canApply(eligible: boolean, freeze: CustomerFreeze | null | undefined, elapsedMs = 0): boolean {
  return eligible && freezeView(freeze, elapsedMs).state !== "frozen";
}

/** "Yes" / "No" / "" (not settled yet). */
export function earlySettlementLabel(value: boolean | null | undefined): string {
  return value === true ? "Yes" : value === false ? "No" : "";
}

/** "30 days" / "No freeze" / "" when no decision exists. */
export function freezeTimeText(settlement: Pick<LoanSettlement, "early_settlement" | "freeze_days">): string {
  if (settlement.early_settlement !== true) {
    return "";
  }
  const days = settlement.freeze_days ?? 0;
  return days > 0 ? plural(days, "day") : "No freeze";
}

/** Current Freeze Status: "Frozen" / "Expired" / "Not frozen". */
export function freezeStatusLabel(status: FreezeState | null | undefined): string {
  return status === "frozen" ? "Frozen" : status === "expired" ? "Expired" : "Not frozen";
}

/** Rows shown for a previous loan / loan profile, in order. */
export function settlementRows(settlement: LoanSettlement, loanLabel = "Previous Loan"): Array<[string, string]> {
  return [
    [loanLabel, `${settlement.loan_number}${settlement.loan_category ? ` (${settlement.loan_category})` : ""}`],
    ["Disbursement Date", formatFreezeUntil(settlement.disbursed_at)],
    ["Expected Completion Date", formatFreezeUntil(settlement.expected_completion_date)],
    ["Settlement Date", formatFreezeUntil(settlement.settled_at)],
    ["Early Settlement", earlySettlementLabel(settlement.early_settlement)],
    ["Freeze Time", freezeTimeText(settlement)],
    ["Freeze Start", formatFreezeUntil(settlement.freeze_started_at)],
    ["Freeze End", formatFreezeUntil(settlement.frozen_until)],
    ["Current Freeze Status", freezeStatusLabel(settlement.freeze_status)],
  ];
}
