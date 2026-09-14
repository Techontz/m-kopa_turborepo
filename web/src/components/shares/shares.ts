/**
 * Share arithmetic used by the Shares forms for previews. The API recomputes every figure from the share register;
 * these helpers only show the user what a submission will do before it is sent.
 */

/** "1,250" — share quantities are whole units. */
export function sharesLabel(value: number | string | null | undefined): string {
  const shares = Number(value ?? 0);
  return Number.isFinite(shares) ? Math.trunc(shares).toLocaleString("en-US") : "0";
}

/** Parse a typed amount or quantity ("50,000,000" → 50000000); NaN when not a number. */
export function parseAmount(value: string | number | null | undefined): number {
  if (typeof value === "number") {
    return value;
  }
  const cleaned = String(value ?? "").replace(/[,\s]/g, "");
  return cleaned === "" ? Number.NaN : Number(cleaned);
}

/** Ownership % = shares ÷ total issued shares × 100, rounded like the API (4 decimals). */
export function ownershipPercent(shares: number, totalShares: number): number {
  if (!(totalShares > 0)) {
    return 0;
  }
  return Math.round((shares / totalShares) * 100 * 10000) / 10000;
}

/** Holding value = shares × share value (2 decimals). */
export function holdingValue(shares: number, shareValue: number): number {
  return Math.round(shares * shareValue * 100) / 100;
}

/** Initial share value = capital basis ÷ number of shares (2 decimals); 0 when either is missing. */
export function initialShareValue(capitalBasis: number, totalShares: number): number {
  if (!(capitalBasis > 0) || !(totalShares > 0)) {
    return 0;
  }
  return Math.round((capitalBasis / totalShares) * 100) / 100;
}

export interface HoldingPreview {
  id: number;
  name: string;
  shares: number;
}

export interface ProjectedRow extends HoldingPreview {
  ownership_percent: number;
  holding_value: number;
}

/** Register after issuing `shares` to `holderId`: total grows, every other holder is diluted. */
export function projectIssuance(holdings: HoldingPreview[], holderId: number, shares: number, shareValue: number): { total: number; rows: ProjectedRow[] } {
  const added = Math.max(0, Math.trunc(shares || 0));
  const rows = holdings.map((row) => ({ ...row, shares: row.id === holderId ? row.shares + added : row.shares }));
  return project(rows, shareValue);
}

/** Register after moving `shares` from one holder to another: the total never changes. */
export function projectTransfer(holdings: HoldingPreview[], fromId: number, toId: number, shares: number, shareValue: number): { total: number; rows: ProjectedRow[]; valid: boolean } {
  const moved = Math.max(0, Math.trunc(shares || 0));
  const source = holdings.find((row) => row.id === fromId);
  const valid = fromId !== toId && moved > 0 && source !== undefined && source.shares >= moved;
  const rows = holdings.map((row) => ({
    ...row,
    shares: valid && row.id === fromId ? row.shares - moved : valid && row.id === toId ? row.shares + moved : row.shares,
  }));
  return { ...project(rows, shareValue), valid };
}

export interface AllocationLine {
  shares: string;
}

/** Initial allocation check: allocated shares must equal the initial number of shares. */
export function allocationStatus(lines: AllocationLine[], totalShares: number): { allocated: number; remaining: number; complete: boolean } {
  const allocated = lines.reduce((sum, line) => sum + (Number.isFinite(parseAmount(line.shares)) ? Math.trunc(parseAmount(line.shares)) : 0), 0);
  const remaining = (Number.isFinite(totalShares) ? totalShares : 0) - allocated;
  return { allocated, remaining, complete: totalShares > 0 && remaining === 0 };
}

function project(rows: HoldingPreview[], shareValue: number): { total: number; rows: ProjectedRow[] } {
  const total = rows.reduce((sum, row) => sum + row.shares, 0);
  return {
    total,
    rows: rows.map((row) => ({ ...row, ownership_percent: ownershipPercent(row.shares, total), holding_value: holdingValue(row.shares, shareValue) })),
  };
}

export const TRANSACTION_TONES = {
  initial_allocation: "primary",
  issuance: "success",
  bonus_issuance: "info",
  transfer: "warning",
  cancellation: "danger",
  adjustment: "default",
  reversal: "dark",
} as const;
