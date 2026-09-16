import type { BadgeTone } from "@/components/ui/Badge";
import { money } from "@/lib/format";

/** Risk bands of config/credit.php — used when a stored snapshot carries no `risk_band_label`. */
const BAND_LABELS: Record<string, string> = { low: "Low risk", moderate: "Moderate risk", elevated: "Elevated risk", high: "High risk" };
const BAND_TONES: Record<string, BadgeTone> = { low: "success", moderate: "info", elevated: "warning", high: "danger" };

export function riskBandLabel(key: string | null | undefined, label?: string | null): string {
  return label || (key ? BAND_LABELS[key] ?? humanize(key) : "—");
}

export function riskBandTone(key: string | null | undefined): BadgeTone {
  return (key && BAND_TONES[key]) || "default";
}

export function directionTone(direction: string): BadgeTone {
  return direction === "positive" ? "success" : direction === "negative" ? "danger" : "default";
}

/** "income_field" → "Income field". */
export function humanize(key: string): string {
  const text = key.replace(/_/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A 0 – 1 share as "42.5%". */
export function ratio(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "—";
  }
  return `${Math.round(Number(value) * 1000) / 10}%`;
}

/** Evidence keys that hold TZS amounts (not counts, rates or days). */
const MONEY_KEY = /(amount|outstanding|income|obligation|contribution|collected|collections|fees?$|penalt|principal|borrowed|repaid|instalment|cost|disposable|balance|interest|profit|monthly$)/;
const NOT_MONEY_KEY = /(rate|ratio|share|days|months|cover|score|to_income|_id)$|^(late|on_time|dependents|instalments_due|previous_loans|completed_loans|ended_loans|open_loans|other_open_loans|written_off_loans|topup_loans|offsets|loans|customers)$/;

export function isMoneyKey(key: string): boolean {
  return MONEY_KEY.test(key) && !NOT_MONEY_KEY.test(key);
}

/**
 * One evidence figure as the officer reads it: money-looking keys as "1,858,000", other numbers with at most 4
 * decimals, booleans as Yes / No, empty as "—". Nested arrays / objects are handled by the caller.
 */
export function evidenceValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "number") {
    return isMoneyKey(key) ? money(value) : String(Math.round(value * 10000) / 10000);
  }
  return String(value);
}
