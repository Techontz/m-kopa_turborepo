import { describe, expect, it } from "vitest";

import { totalAmount, type FloatTransfer } from "@/components/capital/DateFilterModal";

import { isReversed } from "./Reversal";

const row = (amount: number, status: FloatTransfer["status"]): FloatTransfer => ({ id: amount, type: "company_to_branch", from_branch: null, to_branch: "Kigoma", from_account: null, to_account: null, amount, status, date: "2026-09-15" });

describe("reversal helpers", () => {
  it("flags reversed rows", () => {
    expect(isReversed({ status: "reversed" })).toBe(true);
    expect(isReversed({ status: "approved" })).toBe(false);
  });

  it("excludes reversed transfers from the list total", () => {
    expect(totalAmount([row(1000, "approved"), row(400, "reversed"), row(250, "approved")])).toBe(1250);
    expect(totalAmount(undefined)).toBe(0);
  });
});
