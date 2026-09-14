import { describe, expect, it } from "vitest";

import {
  canApply,
  earlySettlementLabel,
  formatFreezeUntil,
  formatRemaining,
  freezeStatusLabel,
  freezeTimeText,
  freezeView,
  remainingSeconds,
  settlementRows,
  type CustomerFreeze,
  type LoanSettlement,
} from "./freeze";

const previous: LoanSettlement = {
  id: 7,
  loan_number: "2026000007",
  loan_category: "WAJASILIAMALI",
  disbursed_at: "2026-09-01T10:00:00+00:00",
  expected_completion_date: "2026-10-01",
  settled_at: "2026-09-08T15:00:00+00:00",
  early_settlement: true,
  freeze_days: 30,
  freeze_started_at: "2026-09-01T10:00:00+00:00",
  frozen_until: "2026-10-01T10:00:00+00:00",
  frozen_until_label: "01 October 2026",
  freeze_status: "frozen",
};

const frozen: CustomerFreeze = {
  status: "frozen",
  frozen: true,
  reborrowing_status: "Frozen",
  reason: "Previous loan was fully settled early.",
  loan_id: 7,
  loan_number: "2026000007",
  loan_category: "WAJASILIAMALI",
  freeze_days: 30,
  freeze_started_at: "2026-09-01T10:00:00+00:00",
  frozen_until: "2026-10-01T10:00:00+00:00",
  frozen_until_label: "01 October 2026",
  remaining_seconds: 20 * 86400 + 4 * 3600,
  checked_at: "2026-09-11T06:00:00+00:00",
  message: "Customer fully settled the previous loan early. Re-borrowing is frozen until 01 October 2026.",
  previous_loan: previous,
};

describe("formatRemaining", () => {
  it("shows days and hours, hours and minutes, or minutes", () => {
    expect(formatRemaining(5 * 86400 + 4 * 3600 + 59)).toBe("5 days 4 hours");
    expect(formatRemaining(86400)).toBe("1 day");
    expect(formatRemaining(3 * 3600 + 12 * 60)).toBe("3 hours 12 minutes");
    expect(formatRemaining(60)).toBe("1 minute");
    expect(formatRemaining(1)).toBe("less than a minute");
    expect(formatRemaining(0)).toBe("");
    expect(formatRemaining(-5)).toBe("");
  });
});

describe("formatFreezeUntil", () => {
  it("keeps the server wall clock, dropping a midnight time", () => {
    expect(formatFreezeUntil("2026-10-01T10:00:00+00:00")).toBe("01 Oct 2026, 10:00");
    expect(formatFreezeUntil("2026-10-01T10:00:00+03:00")).toBe("01 Oct 2026, 10:00");
    expect(formatFreezeUntil("2026-09-16T00:00:00+00:00")).toBe("16 Sep 2026");
    expect(formatFreezeUntil("2026-10-01")).toBe("01 Oct 2026");
    expect(formatFreezeUntil(null)).toBe("");
  });
});

describe("remainingSeconds", () => {
  it("uses server timestamps and subtracts the time elapsed since the response", () => {
    expect(remainingSeconds(frozen)).toBe(20 * 86400 + 4 * 3600);
    expect(remainingSeconds(frozen, 3600 * 1000)).toBe(20 * 86400 + 3 * 3600);
    expect(remainingSeconds(frozen, 30 * 86400 * 1000)).toBe(0);
    expect(remainingSeconds({ frozen_until: null, checked_at: frozen.checked_at })).toBe(0);
  });
});

describe("freezeView", () => {
  it("shows Re-borrowing Status Frozen with reason, remaining time and freeze end", () => {
    expect(freezeView(frozen)).toEqual({ state: "frozen", label: "Frozen", tone: "danger", reason: "Previous loan was fully settled early.", remaining: "20 days 4 hours", until: "01 Oct 2026, 10:00" });
  });

  it("becomes Available once the freeze end passes, never staying frozen", () => {
    expect(freezeView(frozen, 20 * 86400 * 1000 + 4 * 3600 * 1000)).toMatchObject({ state: "expired", label: "Available", remaining: null });
    expect(freezeView({ ...frozen, status: "expired", frozen: false, reborrowing_status: "Available", checked_at: "2026-10-02T00:00:00+00:00" })).toMatchObject({ state: "expired", label: "Available", until: "01 Oct 2026, 10:00" });
  });

  it("is Available without a freeze", () => {
    expect(freezeView(null)).toMatchObject({ state: "none", label: "Available", reason: null });
    expect(freezeView({ ...frozen, status: "none", frozen: false, frozen_until: null }).label).toBe("Available");
  });
});

describe("canApply", () => {
  it("requires eligible AND not frozen", () => {
    expect(canApply(true, frozen)).toBe(false);
    expect(canApply(false, null)).toBe(false);
    expect(canApply(true, null)).toBe(true);
    expect(canApply(true, frozen, 21 * 86400 * 1000)).toBe(true);
  });
});

describe("settlement rows", () => {
  it("lists previous loan, disbursement, expected completion, settlement, early settlement and the freeze window", () => {
    expect(settlementRows(previous)).toEqual([
      ["Previous Loan", "2026000007 (WAJASILIAMALI)"],
      ["Disbursement Date", "01 Sep 2026, 10:00"],
      ["Expected Completion Date", "01 Oct 2026"],
      ["Settlement Date", "08 Sep 2026, 15:00"],
      ["Early Settlement", "Yes"],
      ["Freeze Time", "30 days"],
      ["Freeze Start", "01 Sep 2026, 10:00"],
      ["Freeze End", "01 Oct 2026, 10:00"],
      ["Current Freeze Status", "Frozen"],
    ]);
  });

  it("labels not-early, zero-day and unsettled loans", () => {
    expect(earlySettlementLabel(false)).toBe("No");
    expect(earlySettlementLabel(null)).toBe("");
    expect(freezeTimeText({ early_settlement: false, freeze_days: null })).toBe("");
    expect(freezeTimeText({ early_settlement: true, freeze_days: 0 })).toBe("No freeze");
    expect(freezeTimeText({ early_settlement: true, freeze_days: 1 })).toBe("1 day");
    expect(freezeStatusLabel("expired")).toBe("Expired");
    expect(freezeStatusLabel("none")).toBe("Not frozen");
  });
});
