import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AllocationActions } from "./AllocationActions";
import {
  ALLOCATION_COLUMNS,
  allocationBadge,
  allocationBalance,
  allocationStatus,
  nextPayStep,
  outstandingTile,
  payAllConfirmText,
  payAllEnabled,
  payConfirmationRows,
  payControl,
  shortDate,
  validatePayForm,
  type PayFormValues,
} from "./dividends";

const allocation = { share_holder: "BETA HOLDER", entitlement: 900000, paid_amount: 250000, balance: 650000 };
const form = (patch: Partial<PayFormValues> = {}): PayFormValues => ({ amount: "650000", pay_method: "CASH", bank_account_id: "", reference: "", ...patch });
const noop = () => undefined;
const actions = (balance: number, canManage: boolean) => renderToStaticMarkup(createElement(AllocationActions, { row: { balance, share_holder: "BETA" }, canManage, onPay: noop, onHistory: noop }));

describe("shareholder dividend allocation table", () => {
  it("has the 11 columns in order", () => {
    expect(ALLOCATION_COLUMNS.map((column) => column.header)).toEqual([
      "S/No.",
      "Shareholder",
      "Shares",
      "Ownership %",
      "Contributions",
      "Dividend Entitlement",
      "Amount Paid",
      "Balance",
      "Status",
      "Last Payment",
      "Action",
    ]);
  });

  it("derives balance and status from entitlement and paid amount", () => {
    expect(allocationBalance(900000, 250000)).toBe(650000);
    expect(allocationBalance(900000, 900000)).toBe(0);
    expect(allocationBalance(900000, 950000)).toBe(0);
    expect(allocationBalance(480000.01, 0.01)).toBe(480000);
    expect(allocationStatus(900000, 0)).toBe("unpaid");
    expect(allocationStatus(900000, 0.01)).toBe("partially_paid");
    expect(allocationStatus(900000, 899999.99)).toBe("partially_paid");
    expect(allocationStatus(900000, 900000)).toBe("paid");
    expect(allocationBadge(allocationStatus(900000, 1)).label).toBe("PARTIALLY PAID");
    expect(allocationBadge(allocationStatus(900000, 0)).tone).toBe("danger");
    expect(allocationBadge(allocationStatus(900000, 900000))).toEqual({ label: "PAID", tone: "success" });
  });

  it("formats dates as 14 Sep 2026", () => {
    expect(shortDate("2026-09-14")).toBe("14 Sep 2026");
    expect(shortDate("2026-08-01 10:53:18")).toBe("1 Aug 2026");
    expect(shortDate(null)).toBe("—");
    expect(shortDate("")).toBe("—");
  });

  it("shows PAY DIVIDEND, a disabled PAID or no pay control by balance and permission, with HISTORY always", () => {
    expect(payControl({ balance: 650000 }, true)).toBe("pay");
    expect(payControl({ balance: 0 }, true)).toBe("paid");
    expect(payControl({ balance: 650000 }, false)).toBe("none");

    const payable = actions(650000, true);
    expect(payable).toContain("PAY DIVIDEND");
    expect(payable).toContain("HISTORY");
    expect(payable).not.toContain("disabled");

    const paid = actions(0, true);
    expect(paid).not.toContain("PAY DIVIDEND");
    expect(paid).toMatch(/<button[^>]*disabled[^>]*>.*PAID<\/button>/);
    expect(paid).toContain("HISTORY");

    const viewer = actions(650000, false);
    expect(viewer).not.toContain("PAY DIVIDEND");
    expect(viewer).not.toContain("PAID");
    expect(viewer).toContain("HISTORY");
  });
});

describe("individual dividend payment", () => {
  it("validates the amount and bank account", () => {
    expect(validatePayForm(form(), 650000)).toEqual({});
    expect(validatePayForm(form({ amount: "0" }), 650000).amount).toBe("The amount to pay must be greater than zero.");
    expect(validatePayForm(form({ amount: "650000.01" }), 650000).amount).toBe("The amount to pay cannot exceed the outstanding balance of TZS 650,000.");
    expect(validatePayForm(form({ pay_method: "BANK" }), 650000)).toEqual({ bank_account_id: "Select the company bank account to pay from." });
    expect(validatePayForm(form({ pay_method: "BANK", bank_account_id: "3" }), 650000)).toEqual({});
  });

  it("moves to the confirmation step only with a valid form and back to the form", () => {
    expect(nextPayStep("form", "continue", form({ amount: "" }), 650000)).toBe("form");
    expect(nextPayStep("form", "continue", form({ pay_method: "BANK" }), 650000)).toBe("form");
    expect(nextPayStep("form", "continue", form({ amount: "100000" }), 650000)).toBe("confirm");
    expect(nextPayStep("confirm", "back", form(), 650000)).toBe("form");
  });

  it("summarises the payment for confirmation", () => {
    expect(payConfirmationRows(allocation, form({ amount: "100,000", reference: "DIVTEST-1" }), null)).toEqual([
      { label: "Shareholder", value: "BETA HOLDER" },
      { label: "Dividend Entitlement", value: "TZS 900,000" },
      { label: "Amount Already Paid", value: "TZS 250,000" },
      { label: "Payment", value: "TZS 100,000" },
      { label: "Remaining After Payment", value: "TZS 550,000" },
      { label: "Payment Method", value: "Cash (Company Account)" },
      { label: "Account", value: "COMPANY ACCOUNT" },
      { label: "Reference / Receipt", value: "DIVTEST-1" },
    ]);
    const bank = payConfirmationRows(allocation, form({ pay_method: "BANK", bank_account_id: "3" }), "NMB");
    expect(bank.find((row) => row.label === "Account")?.value).toBe("NMB");
    expect(bank.find((row) => row.label === "Remaining After Payment")?.value).toBe("TZS 0");
  });
});

describe("pay all outstanding", () => {
  it("is disabled when nothing is outstanding or the user cannot manage", () => {
    expect(payAllEnabled({ total_outstanding: 1250000, shareholders: 4 }, true)).toBe(true);
    expect(payAllEnabled({ total_outstanding: 0, shareholders: 0 }, true)).toBe(false);
    expect(payAllEnabled(undefined, true)).toBe(false);
    expect(payAllEnabled({ total_outstanding: 1250000, shareholders: 4 }, false)).toBe(false);
  });

  it("asks to confirm the server total and shareholder count", () => {
    expect(payAllConfirmText(1250000, 4)).toBe("Pay TZS 1,250,000 to 4 shareholders?");
    expect(payAllConfirmText(480000.01, 1)).toBe("Pay TZS 480,000.01 to 1 shareholder?");
  });

  it("makes the outstanding tile prominent until everything is paid", () => {
    expect(outstandingTile({ total_outstanding: 1250000, shareholders: 4 })).toEqual({ label: "TOTAL OUTSTANDING", value: "TZS 1,250,000", caption: "4 shareholders awaiting payment", settled: false });
    expect(outstandingTile({ total_outstanding: 0, shareholders: 0 })).toMatchObject({ label: "ALL DIVIDENDS PAID", value: "TZS 0 outstanding", settled: true });
    expect(outstandingTile(undefined).value).toBe("…");
  });
});
