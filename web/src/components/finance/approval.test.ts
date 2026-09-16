import { describe, expect, it } from "vitest";

import { totalAmount, type FloatTransfer } from "@/components/capital/DateFilterModal";

import { isPending } from "./Approval";

const row = (amount: number, status: FloatTransfer["status"]): FloatTransfer => ({ id: amount, type: "company_to_branch", from_branch: null, to_branch: "Kakonko", from_account: null, to_account: null, amount, status, date: "2026-09-15" });

describe("approval helpers (rule 6)", () => {
  it("flags pending rows", () => {
    expect(isPending({ status: "pending" })).toBe(true);
    expect(isPending({ status: "approved" })).toBe(false);
    expect(isPending({ status: "rejected" })).toBe(false);
  });

  it("counts only posted transfers in the list total", () => {
    expect(totalAmount([row(1000, "approved"), row(300, "pending"), row(200, "rejected"), row(400, "reversed")])).toBe(1000);
  });
});
