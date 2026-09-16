import { describe, expect, it } from "vitest";

import { CLOSE_PERIOD_TOOLTIP, allocationStatusLabel, branchEligibilityBadge, bulkCounts, calculateButtonState, canCalculateCommission, canRequestPayment, paymentStatusTone, periodBadges } from "./commission";

describe("commission report helpers", () => {
  it("labels zero profit as no distributable profit, not a loss", () => {
    expect(branchEligibilityBadge({ eligible: false, profit_status: "no_distributable_profit", blocked_reason: "No distributable profit" }))
      .toEqual({ tone: "warning", label: "NO DISTRIBUTABLE PROFIT" });
    expect(branchEligibilityBadge({ eligible: false, profit_status: "loss", blocked_reason: "Loss must be recovered before commission" }))
      .toEqual({ tone: "danger", label: "LOSS MUST BE RECOVERED BEFORE COMMISSION" });
    expect(branchEligibilityBadge({ eligible: true, profit_status: "eligible", blocked_reason: null })).toEqual({ tone: "success", label: "ELIGIBLE" });
  });

  it("shows PERIOD NOT CLOSED for an open month and CALCULATED + LOCKED for an approved one", () => {
    expect(periodBadges({ period_closed: false, calculated: false, locked: false }).map((badge) => badge.label)).toEqual(["PERIOD NOT CLOSED"]);
    expect(periodBadges({ period_closed: true, calculated: true, locked: true }).map((badge) => badge.label)).toEqual(["CALCULATED", "LOCKED (IN APPROVED PAYROLL)"]);
    expect(periodBadges({ period_closed: true, calculated: false, locked: false }).map((badge) => badge.label)).toEqual(["PREVIEW — NOT CALCULATED"]);
  });

  it("shows the profit-allocation status and the dividend lock", () => {
    expect(periodBadges({ period_closed: true, calculated: true, locked: false, allocation_status: "ALLOCATED", rule: "profit_allocation" }).map((badge) => badge.label)).toEqual(["CALCULATED", "ALLOCATED FROM PROFIT"]);
    expect(periodBadges({ period_closed: true, calculated: true, locked: true, allocation_status: "LOCKED_BY_DIVIDEND_DECLARATION", rule: "profit_allocation" }).map((badge) => badge.label)).toEqual(["CALCULATED", "LOCKED BY DIVIDEND DECLARATION", "ALLOCATED FROM PROFIT"]);
    expect(periodBadges({ period_closed: true, calculated: true, locked: true, allocation_status: "LOCKED_IN_PAYROLL", rule: "legacy_expense" }).map((badge) => badge.label)).toEqual(["CALCULATED", "LOCKED (IN APPROVED PAYROLL)", "LEGACY (COMMISSION EXPENSE)"]);
    expect(periodBadges({ period_closed: true, calculated: false, locked: true, allocation_status: "LOCKED_BY_DIVIDEND_DECLARATION", rule: null }).map((badge) => badge.label)).toEqual(["NOT CALCULATED — DIVIDENDS DECLARED FIRST", "LOCKED BY DIVIDEND DECLARATION"]);
    expect(allocationStatusLabel("LOCKED_IN_PAYROLL")).toBe("LOCKED IN PAYROLL");
    expect(allocationStatusLabel(undefined)).toBe("NOT CALCULATED");
  });

  it("enables Calculate only when the API allows it", () => {
    expect(canCalculateCommission(undefined)).toBe(false);
    expect(canCalculateCommission({ period_closed: false, calculated: false, locked: false, can_calculate: false })).toBe(false);
    expect(canCalculateCommission({ period_closed: true, calculated: true, locked: true, can_calculate: false })).toBe(false);
    expect(canCalculateCommission({ period_closed: true, calculated: false, locked: false })).toBe(false);
    expect(canCalculateCommission({ period_closed: true, calculated: false, locked: false, can_calculate: true })).toBe(true);
  });
});

describe("Calculate Commission button state", () => {
  const open = { period_closed: false, calculated: false, locked: false, can_calculate: false, calculate_blocked_reason: "The period September 2026 is not closed. Close the month before calculating commission." };
  const lockedJune = { period_closed: true, calculated: true, locked: true, can_calculate: false, calculate_blocked_reason: "Commission is locked in an approved payroll." };
  const closedMay = { period_closed: true, calculated: false, locked: false, can_calculate: true, calculate_blocked_reason: null };

  it("is muted, disabled and explains why for an open period", () => {
    expect(calculateButtonState(open)).toEqual({ disabled: true, className: "btn btn-sm btn-secondary mf-btn-disabled", title: CLOSE_PERIOD_TOOLTIP });
  });

  it("is disabled with the API reason when a closed period is locked", () => {
    const state = calculateButtonState(lockedJune);
    expect(state.disabled).toBe(true);
    expect(state.className).toContain("mf-btn-disabled");
    expect(state.className).not.toContain("btn-success");
    expect(state.title).toBe("Commission is locked in an approved payroll.");
  });

  it("is the active green button only when the API allows calculating", () => {
    expect(calculateButtonState(closedMay)).toEqual({ disabled: false, className: "btn btn-sm btn-success", title: undefined });
  });

  it("is disabled while loading or while a calculation is running", () => {
    expect(calculateButtonState(undefined).disabled).toBe(true);
    expect(calculateButtonState(closedMay, true).disabled).toBe(true);
  });
});

describe("commission payment flow helpers", () => {
  it("shows the payment lock badge once HR finalised the month", () => {
    expect(periodBadges({ period_closed: true, calculated: true, locked: true, allocation_status: "LOCKED_IN_COMMISSION_PAYMENT", rule: "profit_allocation" }).map((badge) => badge.label)).toEqual(["CALCULATED", "LOCKED (FINALISED FOR PAYMENT)", "ALLOCATED FROM PROFIT"]);
  });

  it("lets HR request only unpaid commission with an amount, never legacy payroll commission", () => {
    expect(canRequestPayment({ status: "calculated", calculated_amount: 75000 })).toBe(true);
    expect(canRequestPayment({ status: "awaiting_request", calculated_amount: 75000 })).toBe(true);
    expect(canRequestPayment({ status: "awaiting_request", calculated_amount: 0 })).toBe(false);
    expect(canRequestPayment({ status: "requested", calculated_amount: 75000 })).toBe(false);
    expect(canRequestPayment({ status: "payroll", calculated_amount: 75000, payroll_run_id: 3 })).toBe(false);
  });

  it("counts the bulk actions of the month and colours each status", () => {
    const rows = [
      { status: "calculated" as const, calculated_amount: 10 },
      { status: "awaiting_request" as const, calculated_amount: 10 },
      { status: "requested" as const, calculated_amount: 10 },
      { status: "finance_approved" as const, calculated_amount: 10 },
      { status: "paid" as const, calculated_amount: 10 },
    ];
    expect(bulkCounts(rows)).toEqual({ finalize: 1, request: 2, approve: 1, pay: 1 });
    expect(bulkCounts(undefined)).toEqual({ finalize: 0, request: 0, approve: 0, pay: 0 });
    expect(paymentStatusTone("paid")).toBe("success");
    expect(paymentStatusTone("payroll")).toBe("default");
  });
});
