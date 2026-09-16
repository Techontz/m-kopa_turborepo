import { describe, expect, it } from "vitest";

import { feeStatusBadge } from "./SalaryAdvanceModals";

describe("feeStatusBadge", () => {
  it("labels every salary advance fee status (C2: income only once collected)", () => {
    expect(feeStatusBadge("uncollected")).toEqual({ label: "FEE NOT COLLECTED", tone: "warning" });
    expect(feeStatusBadge("collected")).toEqual({ label: "FEE COLLECTED", tone: "success" });
    expect(feeStatusBadge("collected_at_approval").label).toBe("FEE POSTED AT APPROVAL (LEGACY)");
    expect(feeStatusBadge("no_fee").label).toBe("NO FEE");
    expect(feeStatusBadge("not_approved").label).toBe("PENDING APPROVAL");
    expect(feeStatusBadge(undefined).label).toBe("PENDING APPROVAL");
  });
});
