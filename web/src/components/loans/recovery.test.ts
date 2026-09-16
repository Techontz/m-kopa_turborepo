import { describe, expect, it } from "vitest";

import { canRecordRecovery, isAmbiguous, previewRecoverySplit, recoveryExcess, recoveryStatusLabel, recoveryStatusTone, type RecoveryPosition } from "./recovery";

const position: RecoveryPosition = {
  write_off_id: 1,
  written_off: 134000,
  recovered: 50000,
  unrecovered: 84000,
  status: "PARTIALLY_RECOVERED",
  components_status: "snapshot",
  components: {
    principal: { written_off: 100000, recovered: 50000, remaining: 50000 },
    penalty: { written_off: 3000, recovered: 0, remaining: 3000 },
    interest: { written_off: 30000, recovered: 0, remaining: 30000 },
    insurance: { written_off: 1000, recovered: 0, remaining: 1000 },
  },
  pending: 0,
};

const ambiguous: RecoveryPosition = { ...position, recovered: 0, unrecovered: 134000, status: "NOT_RECOVERED", components_status: "ambiguous", components: null, ambiguous_reason: "unknown split" };

describe("recovery after write-off helpers", () => {
  it("allows recording only on a written-off loan with a known split and an unrecovered balance", () => {
    expect(canRecordRecovery(position, "written_off")).toBe(true);
    expect(canRecordRecovery(position, "active")).toBe(false);
    expect(canRecordRecovery({ ...position, unrecovered: 0, status: "FULLY_RECOVERED" }, "written_off")).toBe(false);
    expect(canRecordRecovery(null, "written_off")).toBe(false);
    expect(canRecordRecovery(ambiguous, "written_off")).toBe(false);
    expect(isAmbiguous(ambiguous)).toBe(true);
    expect(isAmbiguous(position)).toBe(false);
  });

  it("labels and colours the recovery status", () => {
    expect(recoveryStatusLabel("PARTIALLY_RECOVERED")).toBe("PARTIALLY RECOVERED");
    expect(recoveryStatusLabel("NOT_RECOVERED")).toBe("NOT RECOVERED");
    expect(recoveryStatusTone("FULLY_RECOVERED")).toBe("success");
    expect(recoveryStatusTone("PARTIALLY_RECOVERED")).toBe("warning");
    expect(recoveryStatusTone("NOT_RECOVERED")).toBe("danger");
  });

  it("computes the excess over the unrecovered balance in exact cents", () => {
    expect(recoveryExcess(position, 84000)).toBe(0);
    expect(recoveryExcess(position, 84000.01)).toBe(0.01);
    expect(recoveryExcess(position, 90000)).toBe(6000);
    expect(recoveryExcess(position, Number.NaN)).toBe(0);
    expect(recoveryExcess(position, -5)).toBe(0);
  });

  it("previews the split principal → penalty → interest (reserve 20%) → insurance", () => {
    expect(previewRecoverySplit(position, 60000)).toEqual({ principal: 50000, penalty: 3000, interest: 7000, insurance: 0, reserve: 1400, excess: 0 });
    expect(previewRecoverySplit(position, 90000)).toEqual({ principal: 50000, penalty: 3000, interest: 30000, insurance: 1000, reserve: 6000, excess: 6000 });
    expect(previewRecoverySplit(position, 53000.5).interest).toBe(0.5);
    expect(previewRecoverySplit(position, 53000.5).reserve).toBe(0.1);
    expect(previewRecoverySplit(ambiguous, 1000)).toEqual({ principal: 0, penalty: 0, interest: 0, insurance: 0, reserve: 0, excess: 0 });
  });
});
