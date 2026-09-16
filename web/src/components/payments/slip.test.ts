import { describe, expect, it } from "vitest";

import { receiptsTotal } from "./slip";

describe("receiptsTotal", () => {
  const receipts = [
    { id: 1, amount: 0.1 },
    { id: 2, amount: 0.2 },
    { id: 3, amount: 105000 },
  ];

  it("sums only the selected receipts in cents", () => {
    expect(receiptsTotal(receipts, [1, 2])).toBe(0.3);
    expect(receiptsTotal(receipts, [2, 3])).toBe(105000.2);
  });

  it("is zero when nothing is selected", () => {
    expect(receiptsTotal(receipts, [])).toBe(0);
  });
});
