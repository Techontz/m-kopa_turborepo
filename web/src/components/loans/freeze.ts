/**
 * Re-borrowing freeze (loan category "Freeze Time (Days)") as returned by the API: `freeze` on the eligibility
 * responses and `customer_freeze` on the loan detail. All times are server timestamps (ISO 8601 with offset).
 */
export interface CustomerFreeze {
  status: "frozen" | "expired" | "none";
  frozen: boolean;
  loan_id: number | null;
  loan_number: string | null;
  loan_category: string | null;
  freeze_days: number | null;
  freeze_started_at: string | null;
  frozen_until: string | null;
  remaining_seconds: number;
  checked_at: string;
  message: string | null;
}

export type FreezeState = "frozen" | "expired" | "none";

export interface FreezeView {
  state: FreezeState;
  label: "FROZEN" | "FREEZE EXPIRED" | "NO FREEZE";
  tone: "danger" | "success" | "default";
  remaining: string | null;
  until: string | null;
}

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

/** "17 Sep 2026, 10:00". */
export function formatFreezeUntil(value: string | null | undefined, timeZone?: string): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const parts = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${Number(part("day"))} ${MONTHS[Number(part("month")) - 1]} ${part("year")}, ${part("hour")}:${part("minute")}`;
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

export function freezeView(freeze: CustomerFreeze | null | undefined, elapsedMs = 0, timeZone?: string): FreezeView {
  if (!freeze || freeze.status === "none" || !freeze.frozen_until) {
    return { state: "none", label: "NO FREEZE", tone: "default", remaining: null, until: null };
  }
  const left = freeze.frozen ? remainingSeconds(freeze, elapsedMs) : 0;
  const until = formatFreezeUntil(freeze.frozen_until, timeZone);
  if (left > 0) {
    return { state: "frozen", label: "FROZEN", tone: "danger", remaining: formatRemaining(left), until };
  }
  return { state: "expired", label: "FREEZE EXPIRED", tone: "success", remaining: null, until };
}

/** Customer may apply only when eligible AND not frozen. */
export function canApply(eligible: boolean, freeze: CustomerFreeze | null | undefined, elapsedMs = 0): boolean {
  return eligible && freezeView(freeze, elapsedMs).state !== "frozen";
}
