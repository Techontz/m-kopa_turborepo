/**
 * Display helpers for Capital → Dividends and Settings → Dividend Settings. The API computes and enforces every figure
 * (profit, split, entitlements, balances); these helpers only format API data and mirror the server rules so a form can
 * warn before it is submitted.
 */

import type { BadgeTone } from "@/components/ui/Badge";

import type { AllocationStatus, DividendAllocation, DividendPayment, DividendPreview, PayAllPreview, PreviewRow, ProfitSource } from "./types";

/** "TZS 1,500,000" — cents are shown only when present ("TZS 7,000,000.01"). */
export function tzs(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) {
    return "TZS 0";
  }
  const cents = Math.round(amount * 100);
  const hasCents = cents % 100 !== 0;
  return `TZS ${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** Amount in integer cents (the server's unit). */
export function toCents(value: number | string | null | undefined): number {
  const cleaned = typeof value === "number" ? value : Number(String(value ?? "").replace(/[,\s]/g, ""));
  return Number.isFinite(cleaned) ? Math.round(cleaned * 100) : Number.NaN;
}

/** "2026-09" for today. */
export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-08" → "August 2026". */
export function periodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) {
    return period;
  }
  return new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

export function profitSourceLabel(source: ProfitSource | string | null | undefined): string {
  switch (source) {
    case "period_close":
      return "Month-end close (distributable profit)";
    case "profit_account":
      return "Profit Account (undistributed balance)";
    case "manual":
      return "Entered manually (before this rework)";
    default:
      return "-";
  }
}

/** Settings total check: both 0–100 with ≤ 2 decimals and a total of exactly 100.00. */
export function settingsTotal(dividend: string | number, reinvest: string | number): { total: number; valid: boolean; message: string | null } {
  const values = [dividend, reinvest].map((value) => String(value ?? "").trim());
  const numeric = values.every((value) => /^-?\d+(\.\d{1,2})?$/.test(value));
  const basis = numeric ? values.map((value) => Math.round(Number(value) * 100)) : [Number.NaN, Number.NaN];
  const total = numeric ? (basis[0] + basis[1]) / 100 : Number.NaN;

  if (!numeric) {
    return { total, valid: false, message: "Enter both percentages as numbers with at most 2 decimals." };
  }
  if (basis.some((value) => value < 0 || value > 10000)) {
    return { total, valid: false, message: "Each percentage must be between 0 and 100." };
  }
  if (basis[0] + basis[1] !== 10000) {
    return { total, valid: false, message: `Total Allocation must be exactly 100% (currently ${total.toFixed(2)}%).` };
  }
  return { total, valid: true, message: null };
}

/** Pool and reinvestment from a profit and the shareholder % — same rounding as the server (half-up to the cent). */
export function splitProfit(profit: number, dividendPercent: number): { pool: number; reinvest: number } {
  const profitCents = Math.max(0, toCents(profit) || 0);
  const basis = Math.round(dividendPercent * 100);
  const poolCents = Number((BigInt(profitCents) * BigInt(Math.max(0, basis)) + BigInt(5000)) / BigInt(10000));
  return { pool: poolCents / 100, reinvest: (profitCents - poolCents) / 100 };
}

/** Entitlements by shares with the largest-remainder rule, summing exactly to the pool (mirrors the server). */
export function allocateEntitlements(pool: number, holdings: Array<{ id: number; shares: number }>): Map<number, number> {
  const poolCents = Math.max(0, toCents(pool) || 0);
  const total = holdings.reduce((sum, row) => sum + Math.max(0, row.shares), 0);
  const result = new Map<number, number>();
  if (total <= 0 || poolCents <= 0) {
    holdings.forEach((row) => result.set(row.id, 0));
    return result;
  }

  const rows = holdings.map((row, order) => {
    const product = BigInt(poolCents) * BigInt(Math.max(0, row.shares));
    return { row, order, cents: Number(product / BigInt(total)), remainder: Number(product % BigInt(total)) };
  });
  let leftover = poolCents - rows.reduce((sum, item) => sum + item.cents, 0);
  [...rows]
    .sort((left, right) => right.remainder - left.remainder || left.order - right.order)
    .forEach((item) => {
      if (leftover > 0 && item.row.shares > 0) {
        item.cents += 1;
        leftover -= 1;
      }
    });
  rows.forEach((item) => result.set(item.row.id, item.cents / 100));
  return result;
}

export interface PreviewTableRow extends PreviewRow {
  serial: number;
}

/** Preview API rows → table rows with S/No. and totals. */
export function mapPreview(preview: DividendPreview | undefined): { rows: PreviewTableRow[]; totalShares: number; totalEntitlement: number; totalPercent: number } {
  const rows = (preview?.rows ?? []).map((row, index) => ({ ...row, serial: index + 1 }));
  const totalEntitlementCents = rows.reduce((sum, row) => sum + toCents(row.entitlement), 0);
  return {
    rows,
    totalShares: rows.reduce((sum, row) => sum + row.shares, 0),
    totalEntitlement: totalEntitlementCents / 100,
    totalPercent: rows.length ? Math.round(rows.reduce((sum, row) => sum + row.ownership_percent, 0) * 100) / 100 : 0,
  };
}

/** Pay modal amount check: > 0, at most 2 decimals, ≤ remaining balance. */
export function validatePayAmount(amount: string, remaining: number): string | null {
  const cleaned = String(amount ?? "").replace(/[,\s]/g, "");
  if (cleaned === "") {
    return "Enter the amount to pay.";
  }
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return "The amount to pay must be a number.";
  }
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) {
    return "The amount to pay may have at most 2 decimal places.";
  }
  const cents = toCents(cleaned);
  if (cents <= 0) {
    return "The amount to pay must be greater than zero.";
  }
  if (cents > toCents(remaining)) {
    return `The amount to pay cannot exceed the outstanding balance of ${tzs(remaining)}.`;
  }
  return null;
}

const ALLOCATION_BADGES: Record<AllocationStatus, { label: string; tone: BadgeTone }> = {
  unpaid: { label: "UNPAID", tone: "danger" },
  partially_paid: { label: "PARTIALLY PAID", tone: "warning" },
  paid: { label: "PAID", tone: "success" },
};

export function allocationBadge(status: string): { label: string; tone: BadgeTone } {
  return ALLOCATION_BADGES[status as AllocationStatus] ?? { label: String(status || "-").toUpperCase(), tone: "default" };
}

export function declarationBadge(status: string): { label: string; tone: BadgeTone } {
  switch (status) {
    case "FULLY PAID":
      return { label: "FULLY PAID", tone: "success" };
    case "PARTIALLY PAID":
      return { label: "PARTIALLY PAID", tone: "warning" };
    default:
      return { label: "OPEN", tone: "info" };
  }
}

export function paymentBadge(status: DividendPayment["status"] | string): { label: string; tone: BadgeTone } {
  return status === "reversed" ? { label: "REVERSED", tone: "danger" } : { label: "POSTED", tone: "success" };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09-14" or "2026-09-14 10:53:18" → "14 Sep 2026"; "—" when empty. */
export function shortDate(value: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ""));
  if (!match || !MONTHS[Number(match[2]) - 1]) {
    return "—";
  }
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

/** Outstanding balance = entitlement − paid, never negative (cent-exact). */
export function allocationBalance(entitlement: number, paid: number): number {
  return Math.max(0, toCents(entitlement) - toCents(paid)) / 100;
}

/** UNPAID (nothing paid) / PARTIALLY PAID / PAID (paid ≥ entitlement) — the server derives the same from posted payments. */
export function allocationStatus(entitlement: number, paid: number): AllocationStatus {
  const paidCents = toCents(paid);
  if (paidCents <= 0) {
    return "unpaid";
  }
  return paidCents >= toCents(entitlement) ? "paid" : "partially_paid";
}

/** The allocation table's columns, in order. */
export const ALLOCATION_COLUMNS = [
  { key: "serial", header: "S/No." },
  { key: "share_holder", header: "Shareholder" },
  { key: "shares_held", header: "Shares" },
  { key: "ownership_percent", header: "Ownership %" },
  { key: "contribution_total", header: "Contributions" },
  { key: "entitlement", header: "Dividend Entitlement" },
  { key: "paid_amount", header: "Amount Paid" },
  { key: "balance", header: "Balance" },
  { key: "status", header: "Status" },
  { key: "last_payment_date", header: "Last Payment" },
  { key: "actions", header: "Action" },
] as const;

export type PayControl = "pay" | "paid" | "none";

/** PAY DIVIDEND when the user can manage and a balance remains; a disabled PAID when fully paid; nothing for view-only users. */
export function payControl(row: Pick<DividendAllocation, "balance">, canManage: boolean): PayControl {
  if (!canManage) {
    return "none";
  }
  return toCents(row.balance) > 0 ? "pay" : "paid";
}

export interface PayFormValues {
  amount: string;
  pay_method: "CASH" | "BANK";
  bank_account_id: string;
  reference: string;
}

/** Individual payment form check: amount (> 0, ≤ outstanding) and the bank account when paying by Bank. */
export function validatePayForm(form: PayFormValues, outstanding: number): Partial<Record<"amount" | "bank_account_id", string>> {
  const errors: Partial<Record<"amount" | "bank_account_id", string>> = {};
  const amountError = validatePayAmount(form.amount, outstanding);
  if (amountError) {
    errors.amount = amountError;
  }
  if (form.pay_method === "BANK" && !form.bank_account_id) {
    errors.bank_account_id = "Select the company bank account to pay from.";
  }
  return errors;
}

export type PayStep = "form" | "confirm";

/** Step 1 → step 2 only with a valid form; Back / Cancel return to the form. */
export function nextPayStep(step: PayStep, action: "continue" | "back", form: PayFormValues, outstanding: number): PayStep {
  if (action === "back") {
    return "form";
  }
  return step === "form" && Object.keys(validatePayForm(form, outstanding)).length > 0 ? "form" : "confirm";
}

/** "Confirm Dividend Payment" summary rows. */
export function payConfirmationRows(
  allocation: Pick<DividendAllocation, "share_holder" | "entitlement" | "paid_amount" | "balance">,
  form: PayFormValues,
  accountLabel: string | null,
): Array<{ label: string; value: string }> {
  const payment = toCents(form.amount) / 100;
  return [
    { label: "Shareholder", value: allocation.share_holder ?? "-" },
    { label: "Dividend Entitlement", value: tzs(allocation.entitlement) },
    { label: "Amount Already Paid", value: tzs(allocation.paid_amount) },
    { label: "Payment", value: tzs(payment) },
    { label: "Remaining After Payment", value: tzs(allocationBalance(allocation.balance, payment)) },
    { label: "Payment Method", value: form.pay_method === "BANK" ? "Bank" : "Cash (Company Account)" },
    { label: "Account", value: form.pay_method === "BANK" ? accountLabel || "-" : "COMPANY ACCOUNT" },
    { label: "Reference / Receipt", value: form.reference.trim() || "-" },
  ];
}

/** "Pay TZS 1,250,000 to 4 shareholders?" */
export function payAllConfirmText(total: number, shareholders: number): string {
  return `Pay ${tzs(total)} to ${shareholders} shareholder${shareholders === 1 ? "" : "s"}?`;
}

/** PAY ALL OUTSTANDING is available to managers while the server reports an outstanding total. */
export function payAllEnabled(totals: Pick<PayAllPreview, "total_outstanding" | "shareholders"> | undefined, canManage: boolean): boolean {
  return canManage && Boolean(totals) && toCents(totals?.total_outstanding) > 0 && (totals?.shareholders ?? 0) > 0;
}

/** The prominent TOTAL OUTSTANDING tile for the selected declaration. */
export function outstandingTile(totals: Pick<PayAllPreview, "total_outstanding" | "shareholders"> | undefined): { label: string; value: string; caption: string; settled: boolean } {
  if (!totals) {
    return { label: "TOTAL OUTSTANDING", value: "…", caption: "", settled: false };
  }
  if (toCents(totals.total_outstanding) <= 0) {
    return { label: "ALL DIVIDENDS PAID", value: "TZS 0 outstanding", caption: "Every shareholder has been paid", settled: true };
  }
  return {
    label: "TOTAL OUTSTANDING",
    value: tzs(totals.total_outstanding),
    caption: `${totals.shareholders} shareholder${totals.shareholders === 1 ? "" : "s"} awaiting payment`,
    settled: false,
  };
}

export type LoadState = "loading" | "error" | "empty" | "ready";

/** Which state a data block renders, and its message. */
export function loadState(input: { isLoading: boolean; error: unknown; count?: number }, emptyMessage = "No data available in table"): { state: LoadState; message: string } {
  if (input.isLoading) {
    return { state: "loading", message: "Loading..." };
  }
  if (input.error) {
    const message = input.error instanceof Error && input.error.message ? input.error.message : "The data could not be loaded.";
    return { state: "error", message };
  }
  if (input.count === 0) {
    return { state: "empty", message: emptyMessage };
  }
  return { state: "ready", message: "" };
}
