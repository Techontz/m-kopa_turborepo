import { describe, expect, it } from "vitest";

import { evidenceValue, humanize, isMoneyKey, ratio, riskBandLabel } from "./format";

describe("credit evidence formatting", () => {
  it("formats amounts but not counts, rates or days", () => {
    expect(isMoneyKey("written_off_amount")).toBe(true);
    expect(isMoneyKey("monthly_income")).toBe(true);
    expect(isMoneyKey("total_outstanding")).toBe(true);
    expect(isMoneyKey("existing_monthly_obligation")).toBe(true);
    expect(isMoneyKey("previous_loans")).toBe(false);
    expect(isMoneyKey("repayment_rate")).toBe(false);
    expect(isMoneyKey("avg_delay_days")).toBe(false);
    expect(isMoneyKey("debt_to_income")).toBe(false);
    expect(isMoneyKey("other_loans_outstanding")).toBe(true);
    expect(isMoneyKey("other_loans_monthly")).toBe(true);
    expect(isMoneyKey("instalments_due_amount")).toBe(true);
    expect(isMoneyKey("principal_repaid_rate")).toBe(false);
    expect(isMoneyKey("other_open_loans")).toBe(false);
    expect(isMoneyKey("instalments_due")).toBe(false);
  });

  it("renders values", () => {
    expect(evidenceValue("offset_amount", 1858000)).toBe("1,858,000");
    expect(evidenceValue("completion_rate", 0.83333)).toBe("0.8333");
    expect(evidenceValue("income_known", false)).toBe("No");
    expect(evidenceValue("income_field", null)).toBe("—");
  });

  it("labels", () => {
    expect(humanize("income_field")).toBe("Income field");
    expect(ratio(0.425)).toBe("42.5%");
    expect(ratio(null)).toBe("—");
    expect(riskBandLabel("moderate")).toBe("Moderate risk");
    expect(riskBandLabel("low", "Custom")).toBe("Custom");
  });
});
