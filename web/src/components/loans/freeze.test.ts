import { describe, expect, it } from "vitest";

import { canApply, formatFreezeUntil, formatRemaining, freezeView, remainingSeconds, type CustomerFreeze } from "./freeze";

const frozen: CustomerFreeze = {
  status: "frozen",
  frozen: true,
  loan_id: 7,
  loan_number: "2026000007",
  loan_category: "WAJASILIAMALI",
  freeze_days: 7,
  freeze_started_at: "2026-09-10T10:00:00+00:00",
  frozen_until: "2026-09-17T10:00:00+00:00",
  remaining_seconds: 446400,
  checked_at: "2026-09-12T06:00:00+00:00",
  message: "Customer is currently frozen and cannot apply for another loan until 17 September 2026 10:00.",
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
  it("formats the freeze end as day month year, time", () => {
    expect(formatFreezeUntil("2026-09-17T10:00:00+00:00", "UTC")).toBe("17 Sep 2026, 10:00");
    expect(formatFreezeUntil("2026-09-17T10:00:00+00:00", "Africa/Dar_es_Salaam")).toBe("17 Sep 2026, 13:00");
    expect(formatFreezeUntil(null)).toBe("");
  });
});

describe("remainingSeconds", () => {
  it("uses server timestamps and subtracts the time elapsed since the response", () => {
    expect(remainingSeconds(frozen)).toBe(5 * 86400 + 4 * 3600);
    expect(remainingSeconds(frozen, 3600 * 1000)).toBe(5 * 86400 + 3 * 3600);
    expect(remainingSeconds(frozen, 10 * 86400 * 1000)).toBe(0);
    expect(remainingSeconds({ frozen_until: null, checked_at: frozen.checked_at })).toBe(0);
  });
});

describe("freezeView", () => {
  it("shows FROZEN with remaining time and freeze end", () => {
    expect(freezeView(frozen, 0, "UTC")).toEqual({ state: "frozen", label: "FROZEN", tone: "danger", remaining: "5 days 4 hours", until: "17 Sep 2026, 10:00" });
  });

  it("turns into FREEZE EXPIRED once the end passes, never staying frozen", () => {
    expect(freezeView(frozen, 5 * 86400 * 1000 + 4 * 3600 * 1000, "UTC")).toMatchObject({ state: "expired", label: "FREEZE EXPIRED", remaining: null });
    expect(freezeView({ ...frozen, status: "expired", frozen: false, remaining_seconds: 0, checked_at: "2026-09-18T00:00:00+00:00" }, 0, "UTC")).toMatchObject({ state: "expired", until: "17 Sep 2026, 10:00" });
  });

  it("shows no freeze when there is none", () => {
    expect(freezeView(null).state).toBe("none");
    expect(freezeView({ ...frozen, status: "none", frozen: false, frozen_until: null }).label).toBe("NO FREEZE");
  });
});

describe("canApply", () => {
  it("requires eligible AND not frozen", () => {
    expect(canApply(true, frozen)).toBe(false);
    expect(canApply(false, null)).toBe(false);
    expect(canApply(true, null)).toBe(true);
    expect(canApply(true, frozen, 6 * 86400 * 1000)).toBe(true);
  });
});
