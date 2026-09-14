import { describe, expect, it } from "vitest";

import { allocationStatus, holdingValue, initialShareValue, ownershipPercent, parseAmount, projectIssuance, projectTransfer, sharesLabel } from "./shares";

const founders = [
  { id: 1, name: "A", shares: 500 },
  { id: 2, name: "B", shares: 500 },
  { id: 3, name: "C", shares: 0 },
];

describe("share arithmetic", () => {
  it("derives the initial share value from the capital basis", () => {
    expect(initialShareValue(50_000_000, 1000)).toBe(50_000);
    expect(initialShareValue(0, 1000)).toBe(0);
    expect(initialShareValue(100, 3)).toBe(33.33);
  });

  it("computes ownership and holding value", () => {
    expect(ownershipPercent(500, 1000)).toBe(50);
    expect(ownershipPercent(500, 750)).toBe(66.6667);
    expect(ownershipPercent(10, 0)).toBe(0);
    expect(holdingValue(500, 50_000)).toBe(25_000_000);
    expect(holdingValue(400, 200_000)).toBe(80_000_000);
  });

  it("dilutes every holder when shares are issued", () => {
    const result = projectIssuance(founders, 3, 250, 100_000);
    expect(result.total).toBe(1250);
    expect(result.rows.map((row) => row.ownership_percent)).toEqual([40, 40, 20]);
    expect(result.rows.map((row) => row.holding_value)).toEqual([50_000_000, 50_000_000, 25_000_000]);
  });

  it("keeps the total unchanged on a transfer and rejects overspending", () => {
    const result = projectTransfer(founders, 1, 3, 100, 200_000);
    expect(result.valid).toBe(true);
    expect(result.total).toBe(1000);
    expect(result.rows.map((row) => row.shares)).toEqual([400, 500, 100]);
    expect(result.rows.map((row) => row.ownership_percent)).toEqual([40, 50, 10]);
    expect(result.rows.map((row) => row.holding_value)).toEqual([80_000_000, 100_000_000, 20_000_000]);

    expect(projectTransfer(founders, 1, 1, 10, 1).valid).toBe(false);
    expect(projectTransfer(founders, 3, 1, 1, 1).valid).toBe(false);
    expect(projectTransfer(founders, 1, 2, 501, 1).valid).toBe(false);
    expect(projectTransfer(founders, 1, 2, 501, 1).total).toBe(1000);
  });

  it("checks that the initial allocation covers every initial share", () => {
    expect(allocationStatus([{ shares: "500" }, { shares: "500" }], 1000)).toEqual({ allocated: 1000, remaining: 0, complete: true });
    expect(allocationStatus([{ shares: "600" }, { shares: "" }], 1000)).toEqual({ allocated: 600, remaining: 400, complete: false });
  });

  it("parses and formats typed quantities", () => {
    expect(parseAmount("50,000,000")).toBe(50_000_000);
    expect(Number.isNaN(parseAmount(""))).toBe(true);
    expect(sharesLabel(1250)).toBe("1,250");
  });
});

describe("shares sub-navigation", async () => {
  const { SHARES_NAV, isSharesTabActive } = await import("./SharesNav");
  const active = (pathname: string) => SHARES_NAV.filter((link) => isSharesTabActive(pathname, link)).map((link) => link.label);

  it("marks exactly one tab for every Shares route", () => {
    expect(active("/shares")).toEqual(["Overview"]);
    expect(active("/shares/setup")).toEqual(["Overview"]);
    expect(active("/shares/share-holders/12")).toEqual(["Shareholders"]);
    expect(active("/shares/transfer")).toEqual(["Transfer Shares"]);
    expect(active("/reports/shares/distribution")).toEqual(["Share Reports"]);
  });
});
