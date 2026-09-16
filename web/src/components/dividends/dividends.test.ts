import { describe, expect, it } from "vitest";

import {
  allocationBadge,
  currentMonth,
  declarationBadge,
  loadState,
  mapPreview,
  paymentBadge,
  periodLabel,
  profitChain,
  profitSourceLabel,
  settingsTotal,
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

describe("profitChain", () => {
  it("lists distributable → commission → remaining → reinvestment / dividend for a closed month", () => {
    const chain = profitChain({ period_closed: true, distributable_profit: 346920, commission_amount: 34692, commission_calculated: true, base_amount: 312228, reinvestment_amount: 218559.6, dividend_pool: 93668.4, reinvest_percent: 70, dividend_percent: 30 });
    expect(chain.map((step) => step.label)).toEqual(["Net distributable profit", "Commission (10%)", "Remaining profit", "Principal reinvestment (70%)", "Shareholder dividend (30%)"]);
    expect(chain.map((step) => step.value)).toEqual(["TZS 346,920", "TZS 34,692", "TZS 312,228", "TZS 218,559.60", "TZS 93,668.40"]);
  });

  it("deducts nothing while commission is not calculated and says it must be calculated first (C1)", () => {
    const chain = profitChain({ period_closed: true, distributable_profit: 10000000, commission_amount: 0, commission_calculated: false, base_amount: 10000000, reinvestment_amount: 7000000, dividend_pool: 3000000, reinvest_percent: 70, dividend_percent: 30 });
    expect(chain[1]).toEqual({ label: "Commission — not calculated (calculate it before declaring)", value: "TZS 0", tone: "out" });
    expect(chain[2].value).toBe("TZS 10,000,000");
  });

  it("is empty for a month that is not closed", () => {
    expect(profitChain({ period_closed: false, distributable_profit: null, commission_amount: null, base_amount: null, reinvestment_amount: 0, dividend_pool: 0, reinvest_percent: 70, dividend_percent: 30 })).toEqual([]);
    expect(profitChain(undefined)).toEqual([]);
  });
});
