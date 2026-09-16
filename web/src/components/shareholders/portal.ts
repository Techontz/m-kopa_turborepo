/** Shareholder Portal API shapes (portal/shareholder/*) and small display helpers. Every figure is computed by the API. */

export interface PortalDashboard {
  share_holder: { id: number; holder_number: string; name: string };
  my_shares: number;
  my_ownership_percent: number;
  my_capital: number;
  my_capital_breakdown: { cash: number; bank: number; asset: number };
  share_value: number;
  holding_value: number;
  total_company_shares: number;
  total_shareholder_capital: number;
  dividends: DividendTotals;
  pending_contributions: number;
  pending_contributions_amount: number;
}

export interface DividendTotals {
  entitled: number;
  paid: number;
  outstanding: number;
}

export type ContributionStatus = "pending" | "posted" | "rejected" | "cancelled" | "reversed";

export interface PortalContribution {
  id: number;
  date: string | null;
  amount: number;
  payment_method: string;
  bank_account: string | null;
  reference: string | null;
  status: ContributionStatus;
  source: "shareholder" | "staff";
  rejection_reason: string | null;
  journal_reference: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  cancelled_at: string | null;
  reversed_at: string | null;
  has_receipt: boolean;
  receipt_endpoint: string | null;
  can_cancel: boolean;
}

export interface PortalCapital {
  total_contributed: number;
  pending_amount: number;
  rows: PortalContribution[];
}

export interface PortalShareTransaction {
  id: number;
  reference: string;
  type: string;
  type_label: string;
  direction: "in" | "out";
  shares: number;
  signed_shares: number;
  share_value: number;
  price_per_share: number | null;
  total_amount: number | null;
  counterparty: string;
  transacted_at: string | null;
  status: string;
}

export interface PortalShares {
  shares: number;
  total_shares: number;
  ownership_percent: number;
  share_value: number;
  holding_value: number;
  history: Array<{ date: string; shares: number; total_shares: number; ownership_percent: number; share_value: number; holding_value: number }>;
  transactions: PortalShareTransaction[];
}

export interface PortalDividendRow {
  id: number;
  declaration_id: number;
  period: string | null;
  period_label: string | null;
  declared_at: string | null;
  shares_held: number | null;
  total_shares: number | null;
  share_percent: number;
  entitled: number;
  paid: number;
  outstanding: number;
  status: string;
  payments: Array<{ id: number; amount: number; pay_method: string; reference: string | null; paid_at: string | null; status: string; reversed_at: string | null }>;
}

export interface PortalDividends {
  totals: DividendTotals;
  rows: PortalDividendRow[];
}

export interface StatementLine {
  date: string;
  type: string;
  description: string;
  reference: string | null;
  capital_in: number;
  capital_out: number;
  dividend_paid: number;
  shares: number;
  capital_balance: number;
}

export interface PortalStatement {
  share_holder: { holder_number: string; name: string };
  company: string | null;
  from: string;
  to: string;
  generated_at: string;
  opening_capital: number;
  closing_capital: number;
  capital_in: number;
  capital_out: number;
  dividends_paid: number;
  opening_shares: number;
  closing_shares: number;
  closing_ownership_percent: number;
  lines: StatementLine[];
}

export interface DirectoryRow {
  holder_number: string;
  name: string;
  shares: number;
  ownership_percent: number;
  capital_contributed: number;
  is_me: boolean;
}

export interface PortalDirectory {
  totals: { shareholders: number; total_shares: number; total_capital: number };
  rows: DirectoryRow[];
  distribution: Array<{ name: string; shares: number; ownership_percent: number }>;
}

export interface PortalStructure {
  has_structure: boolean;
  authorised_shares: number | null;
  issued_shares: number;
  available_shares: number | null;
  par_value: number | null;
  initial_shares: number | null;
  established_on: string | null;
  current_share_value: number;
  total_valuation: number;
  shareholders: number;
}

export interface PortalProfile {
  holder_number: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  name: string;
  mobile: string;
  email: string;
  gender: string | null;
  date_of_birth: string | null;
  photo_endpoint: string | null;
  login: string;
  account_type: string;
  registered_at: string | null;
}

export const STATUS_TONE: Record<ContributionStatus, "warning" | "success" | "danger" | "default" | "dark"> = {
  pending: "warning",
  posted: "success",
  rejected: "danger",
  cancelled: "default",
  reversed: "dark",
};

export const STATUS_LABEL: Record<ContributionStatus, string> = {
  pending: "PENDING APPROVAL",
  posted: "APPROVED",
  rejected: "REJECTED",
  cancelled: "CANCELLED",
  reversed: "REVERSED",
};

/** "12.5%" with up to 4 decimals and no trailing zeros. */
export function ownership(percent: number | null | undefined): string {
  const value = Number(percent ?? 0);
  return `${Number.isFinite(value) ? Number(value.toFixed(4)) : 0}%`;
}

/** Client-side check before the confirm step (the API validates again): amount > 0 with at most 2 decimals. */
export function validAmount(input: string): boolean {
  const normalised = input.replace(/,/g, "").trim();
  return /^\d+(\.\d{1,2})?$/.test(normalised) && Number(normalised) > 0;
}

/** Year-to-date range used by default on the statement page. */
export function defaultStatementRange(today: Date = new Date()): { from: string; to: string } {
  const iso = today.toISOString().slice(0, 10);
  return { from: `${iso.slice(0, 4)}-01-01`, to: iso };
}
