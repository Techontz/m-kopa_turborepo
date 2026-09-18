import { describe, expect, it } from "vitest";

import { ownershipLabel } from "@/components/capital/contributions";
import { newIdempotencyKey } from "@/lib/idempotency";

import { hasSufficientBalance, type SourceOption } from "./disbursementSource";

describe("disbursement source", () => {
  it("checks the PRINCIPAL A/C balance against what the loan takes", () => {
    const cash: SourceOption = { value: "cash", label: "PRINCIPAL A/C (HQ CASH)", balance: 300000, required: 500000 };
    expect(hasSufficientBalance(cash)).toBe(false);
    expect(hasSufficientBalance({ ...cash, balance: 500000 })).toBe(true);
    expect(hasSufficientBalance(undefined)).toBe(false);
  });
});

describe("idempotency key", () => {
  it("is unique per submission and fits the API limit", () => {
    const first = newIdempotencyKey("capital");
    expect(first.startsWith("capital-")).toBe(true);
    expect(first.length).toBeLessThanOrEqual(100);
    expect(newIdempotencyKey("capital")).not.toBe(first);
  });
});

describe("ownership label", () => {
  it("shows the contribution percentage without trailing zeros", () => {
    expect(ownershipLabel(25)).toBe("25%");
    expect(ownershipLabel(33.33333)).toBe("33.3333%");
    expect(ownershipLabel(null)).toBe("0%");
  });
});
