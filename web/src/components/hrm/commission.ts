import type { BadgeTone } from "@/components/ui/Badge";

/**
 * HRM → Commission report helpers. The API decides everything (period status, calculate permission, branch
 * profit status); these only map the API flags to the badges and button state shown on the page.
 */

export type ProfitStatus = "eligible" | "no_distributable_profit" | "loss";

export interface CommissionBranchStatus {
  eligible: boolean;
  profit_status?: ProfitStatus;
  blocked_reason: string | null;
}

/** Accounting status of a month's commission (API `allocation_status`). */
export type AllocationStatus = "NOT_CALCULATED" | "ALLOCATED" | "LOCKED_IN_PAYROLL" | "LOCKED_BY_DIVIDEND_DECLARATION" | "LOCKED_IN_COMMISSION_PAYMENT";

/** "profit_allocation" = posted Dr PROFIT ACCOUNT / Cr COMMISSION PAYABLE; "legacy_expense" = stored before that rule (June 2026). */
export type CommissionRule = "profit_allocation" | "legacy_expense" | null;

export interface CommissionReportFlags {
  period_closed: boolean;
  calculated: boolean;
  locked: boolean;
  allocation_status?: AllocationStatus;
  rule?: CommissionRule;
  can_calculate?: boolean;
  calculate_blocked_reason?: string | null;
}

export interface Badgeable {
  tone: BadgeTone;
  label: string;
}

/** Eligibility badge of a branch: ELIGIBLE, LOSS MUST BE RECOVERED BEFORE COMMISSION or NO DISTRIBUTABLE PROFIT. */
export function branchEligibilityBadge(branch: CommissionBranchStatus): Badgeable {
  if (branch.eligible) {
    return { tone: "success", label: "ELIGIBLE" };
  }
  if (branch.profit_status === "no_distributable_profit") {
    return { tone: "warning", label: (branch.blocked_reason ?? "No distributable profit").toUpperCase() };
  }

  return { tone: "danger", label: (branch.blocked_reason ?? "Blocked").toUpperCase() };
}

/** Status badges of the month: PERIOD NOT CLOSED, or CALCULATED / PREVIEW — NOT CALCULATED plus LOCKED. */
export function periodBadges(report: CommissionReportFlags): Badgeable[] {
  if (!report.period_closed) {
    return [{ tone: "danger", label: "PERIOD NOT CLOSED" }];
  }
  const declaredFirst = !report.calculated && report.allocation_status === "LOCKED_BY_DIVIDEND_DECLARATION";
  const badges: Badgeable[] = [
    report.calculated ? { tone: "success", label: "CALCULATED" } : declaredFirst ? { tone: "danger", label: "NOT CALCULATED — DIVIDENDS DECLARED FIRST" } : { tone: "warning", label: "PREVIEW — NOT CALCULATED" },
  ];
  if (report.allocation_status === "LOCKED_BY_DIVIDEND_DECLARATION") {
    badges.push({ tone: "info", label: "LOCKED BY DIVIDEND DECLARATION" });
  } else if (report.allocation_status === "LOCKED_IN_COMMISSION_PAYMENT") {
    badges.push({ tone: "info", label: "LOCKED (FINALISED FOR PAYMENT)" });
  } else if (report.locked) {
    badges.push({ tone: "info", label: "LOCKED (IN APPROVED PAYROLL)" });
  }
  if (report.calculated && report.rule === "profit_allocation") {
    badges.push({ tone: "primary", label: "ALLOCATED FROM PROFIT" });
  }
  if (report.calculated && report.rule === "legacy_expense") {
    badges.push({ tone: "default", label: "LEGACY (COMMISSION EXPENSE)" });
  }

  return badges;
}

/** Status column text of the allocation: ALLOCATED / LOCKED IN PAYROLL / LOCKED BY DIVIDEND DECLARATION / NOT CALCULATED. */
export function allocationStatusLabel(status: AllocationStatus | undefined): string {
  return (status ?? "NOT_CALCULATED").replaceAll("_", " ");
}

/** The Calculate Commission button follows the API flag only (open period or approved payroll → disabled). */
export function canCalculateCommission(report: CommissionReportFlags | undefined): boolean {
  return report?.can_calculate === true;
}

export const CLOSE_PERIOD_TOOLTIP = "Close the accounting period before calculating commission.";

export interface CalculateButtonState {
  disabled: boolean;
  className: string;
  title: string | undefined;
}

/**
 * Look and state of the Calculate Commission button: active green only when the API allows calculating; otherwise a muted,
 * non-interactive button whose tooltip explains why (open period, or the API's own reason such as an approved payroll).
 */
export function calculateButtonState(report: CommissionReportFlags | undefined, pending = false): CalculateButtonState {
  if (canCalculateCommission(report) && !pending) {
    return { disabled: false, className: "btn btn-sm btn-success", title: undefined };
  }
  const title = pending ? undefined : report && !report.period_closed ? CLOSE_PERIOD_TOOLTIP : (report?.calculate_blocked_reason ?? undefined);

  return { disabled: true, className: "btn btn-sm btn-secondary mf-btn-disabled", title };
}

/**
 * Commission payment flow per employee (spec §21 / §22 / §49): Calculated → Awaiting Payment Request → Payment Requested →
 * Finance Approved → Paid. "payroll" = legacy commission carried by a payroll run before the flow existed.
 */
export type CommissionPaymentStatus = "calculated" | "awaiting_request" | "requested" | "finance_approved" | "paid" | "payroll";

export interface CommissionPaymentFlags {
  status: CommissionPaymentStatus;
  calculated_amount: number;
  payroll_run_id?: number | null;
}

export function paymentStatusTone(status: CommissionPaymentStatus): BadgeTone {
  switch (status) {
    case "calculated":
      return "warning";
    case "awaiting_request":
      return "info";
    case "requested":
      return "danger";
    case "finance_approved":
      return "primary";
    case "paid":
      return "success";
    default:
      return "default";
  }
}

/** HR (payroll.approve) may request payment of a calculated or finalised commission with an amount to pay. */
export function canRequestPayment(row: CommissionPaymentFlags): boolean {
  return (row.status === "calculated" || row.status === "awaiting_request") && row.calculated_amount > 0 && !row.payroll_run_id;
}

/** Counts of rows per bulk action of the month: what HR can finalise / request and Finance can approve / pay. */
export function bulkCounts(rows: CommissionPaymentFlags[] | undefined): { finalize: number; request: number; approve: number; pay: number } {
  const list = rows ?? [];

  return {
    finalize: list.filter((row) => row.status === "calculated" && !row.payroll_run_id).length,
    request: list.filter(canRequestPayment).length,
    approve: list.filter((row) => row.status === "requested").length,
    pay: list.filter((row) => row.status === "finance_approved").length,
  };
}
