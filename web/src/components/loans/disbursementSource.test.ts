import { describe, expect, it } from "vitest";

import { ownershipLabel } from "@/components/capital/contributions";
import { newIdempotencyKey } from "@/lib/idempotency";

import { EMPTY_SOURCE, hasSufficientBalance, selectedSource, sourcePayload, type DisbursementSources } from "./disbursementSource";

const sources: DisbursementSources = {
  cash: { value: "cash", label: "PRINCIPAL A/C (HQ CASH)", balance: 300000, required: 500000 },
  banks: [
    { value: "4", label: "NMB", balance: 2000000, required: 495000 },
    { value: "7", label: "CRDB", balance: 100, required: 495000 },
  ],
};

describe("disbursement source", () => {
  it("resolves the chosen account and checks its balance", () => {
    expect(selectedSource(sources, EMPTY_SOURCE)).toBeNull();
    expect(selectedSource(sources, { source_account: "cash", source_bank_account_id: "" })?.label).toBe("PRINCIPAL A/C (HQ CASH)");
    expect(hasSufficientBalance(selectedSource(sources, { source_account: "cash", source_bank_account_id: "" }))).toBe(false);
    expect(hasSufficientBalance(selectedSource(sources, { source_account: "bank", source_bank_account_id: "4" }))).toBe(true);
    expect(hasSufficientBalance(selectedSource(sources, { source_account: "bank", source_bank_account_id: "7" }))).toBe(false);
    expect(selectedSource(sources, { source_account: "bank", source_bank_account_id: "" })).toBeNull();
  });

  it("builds the API payload", () => {
    expect(sourcePayload(EMPTY_SOURCE)).toEqual({});
    expect(sourcePayload({ source_account: "cash", source_bank_account_id: "4" })).toEqual({ source_account: "cash" });
    expect(sourcePayload({ source_account: "bank", source_bank_account_id: "4" })).toEqual({ source_account: "bank", source_bank_account_id: 4 });
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
