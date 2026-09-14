import { describe, expect, it } from "vitest";

import {
  allocateEntitlements,
  allocationBadge,
  currentMonth,
  declarationBadge,
  loadState,
  mapPreview,
  paymentBadge,
  periodLabel,
  profitSourceLabel,
  settingsTotal,
  splitProfit,
  tzs,
  validatePayAmount,
} from "./dividends";
import type { DividendPreview } from "./types";

const preview: DividendPreview = {
  period: "2026-09",
  period_label: "September 2026",
  profit_available: 10000000,
  profit_source: "profit_account",
  period_closed: false,
  period_profit: null,
  profit_account_balance: 10000000,
  profit_note: "The month-end close has not run for September 2026; Profit Available is the undistributed Profit Account balance.",
  dividend_percent: 30,
  reinvest_percent: 70,
  dividend_pool: 3000000,
  reinvestment_amount: 7000000,
  total_shares: 1000,
  as_of_date: "2026-09-13",
  declaration_id: null,
  already_declared: false,
  can_declare: true,
  blocking_reason: null,
  rows: [
    { share_holder_id: 1, name: "A", shares: 500, total_shares: 1000, ownership_percent: 50, entitlement: 1500000, contribution_total: 0 },
    { share_holder_id: 2, name: "B", shares: 300, total_shares: 1000, ownership_percent: 30, entitlement: 900000, contribution_total: 0 },
    { share_holder_id: 3, name: "C", shares: 200, total_shares: 1000, ownership_percent: 20, entitlement: 600000, contribution_total: 0 },
  ],
};

describe("dividend display", () => {
  it("formats profit and amounts from API data as TZS", () => {
    expect(tzs(preview.profit_available)).toBe("TZS 10,000,000");
    expect(tzs(1500000)).toBe("TZS 1,500,000");
    expect(tzs(7000000.01)).toBe("TZS 7,000,000.01");
    expect(tzs(null)).toBe("TZS 0");
    expect(profitSourceLabel(preview.profit_source)).toBe("Profit Account (undistributed balance)");
    expect(profitSourceLabel("period_close")).toBe("Month-end close (distributable profit)");
    expect(periodLabel("2026-08")).toBe("August 2026");
    expect(currentMonth(new Date(2026, 8, 13))).toBe("2026-09");
  });

  it("mirrors the server split and allocation exactly", () => {
    expect(splitProfit(10000000.01, 30)).toEqual({ pool: 3000000, reinvest: 7000000.01 });
    expect(splitProfit(1000000.03, 30)).toEqual({ pool: 300000.01, reinvest: 700000.02 });
    expect(splitProfit(1000000, 40)).toEqual({ pool: 400000, reinvest: 600000 });

    const shares = allocateEntitlements(3000000, [{ id: 1, shares: 500 }, { id: 2, shares: 300 }, { id: 3, shares: 200 }]);
    expect([...shares.values()]).toEqual([1500000, 900000, 600000]);

    const cents = allocateEntitlements(300000.01, [{ id: 1, shares: 1 }, { id: 2, shares: 1 }, { id: 3, shares: 1 }]);
    expect([...cents.values()]).toEqual([100000.01, 100000, 100000]);
    expect(allocateEntitlements(100, [{ id: 1, shares: 0 }]).get(1)).toBe(0);
  });

  it("validates the settings total", () => {
    expect(settingsTotal("30", "70")).toEqual({ total: 100, valid: true, message: null });
    expect(settingsTotal("30.01", "69.99").valid).toBe(true);
    expect(settingsTotal("30", "80")).toMatchObject({ total: 110, valid: false, message: "Total Allocation must be exactly 100% (currently 110.00%)." });
    expect(settingsTotal("100", "10").valid).toBe(false);
    expect(settingsTotal("-5", "105").message).toBe("Each percentage must be between 0 and 100.");
    expect(settingsTotal("abc", "70").valid).toBe(false);
    expect(settingsTotal("30.123", "69.877").valid).toBe(false);
    expect(settingsTotal("", "100").valid).toBe(false);
  });

  it("maps the preview rows with serial numbers and totals", () => {
    const mapped = mapPreview(preview);
    expect(mapped.rows.map((row) => row.serial)).toEqual([1, 2, 3]);
    expect(mapped.totalShares).toBe(1000);
    expect(mapped.totalEntitlement).toBe(3000000);
    expect(mapped.totalPercent).toBe(100);
    expect(mapPreview(undefined)).toEqual({ rows: [], totalShares: 0, totalEntitlement: 0, totalPercent: 0 });
  });

  it("validates the pay amount against the remaining balance", () => {
    expect(validatePayAmount("", 900000)).toBe("Enter the amount to pay.");
    expect(validatePayAmount("0", 900000)).toBe("The amount to pay must be greater than zero.");
    expect(validatePayAmount("-100", 900000)).toBe("The amount to pay must be greater than zero.");
    expect(validatePayAmount("abc", 900000)).toBe("The amount to pay must be a number.");
    expect(validatePayAmount("10.001", 900000)).toBe("The amount to pay may have at most 2 decimal places.");
    expect(validatePayAmount("900000.01", 900000)).toBe("The amount to pay cannot exceed the outstanding balance of TZS 900,000.");
    expect(validatePayAmount("900,000", 900000)).toBeNull();
    expect(validatePayAmount("250000.50", 900000)).toBeNull();
  });

  it("maps statuses to badges", () => {
    expect(allocationBadge("unpaid")).toEqual({ label: "UNPAID", tone: "danger" });
    expect(allocationBadge("partially_paid")).toEqual({ label: "PARTIALLY PAID", tone: "warning" });
    expect(allocationBadge("paid")).toEqual({ label: "PAID", tone: "success" });
    expect(allocationBadge("odd").tone).toBe("default");
    expect(declarationBadge("FULLY PAID").tone).toBe("success");
    expect(declarationBadge("OPEN").label).toBe("OPEN");
    expect(paymentBadge("reversed")).toEqual({ label: "REVERSED", tone: "danger" });
    expect(paymentBadge("posted").label).toBe("POSTED");
  });

  it("chooses loading, error, empty and ready states", () => {
    expect(loadState({ isLoading: true, error: null })).toEqual({ state: "loading", message: "Loading..." });
    expect(loadState({ isLoading: false, error: new Error("Server error") })).toEqual({ state: "error", message: "Server error" });
    expect(loadState({ isLoading: false, error: "x" }).message).toBe("The data could not be loaded.");
    expect(loadState({ isLoading: false, error: null, count: 0 }, "No payments yet")).toEqual({ state: "empty", message: "No payments yet" });
    expect(loadState({ isLoading: false, error: null, count: 2 }).state).toBe("ready");
  });
});
