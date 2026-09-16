/** Capital → Dividends API shapes (api/app/Http/Controllers/Api/V1/Capital/DividendController.php). */

export type ProfitSource = "period_close" | "profit_account";

export type AllocationStatus = "unpaid" | "partially_paid" | "paid";

export interface DividendSummary {
  period: string;
  period_label: string;
  profit_available: number;
  profit_source: ProfitSource;
  profit_note: string;
  period_closed: boolean;
  period_profit: number | null;
  profit_account_balance: number;
  distributable_profit?: number | null;
  commission_amount?: number | null;
  /** C1: a dividend can only be declared once the month's commission is calculated (otherwise `blocking_reason`). */
  commission_calculated?: boolean;
  base_amount?: number | null;
  can_declare?: boolean;
  blocking_reason?: string | null;
  dividend_percent: number;
  reinvest_percent: number;
  dividend_pool: number;
  reinvestment_amount: number;
  already_declared: boolean;
  declaration_id: number | null;
  /** C1 maker/checker: a declaration request of the period awaiting approval. */
  pending_request_id?: number | null;
  pending_requested_by?: string | null;
  total_declared: number;
  total_paid: number;
  total_outstanding: number;
  dividend_balance: number;
  declarations: number;
}

export interface PreviewRow {
  share_holder_id: number;
  name: string;
  shares: number;
  total_shares: number;
  ownership_percent: number;
  entitlement: number;
  contribution_total: number;
}

/** One branch of the declaration base: its share of the base, its reinvestment and the income pools that fund it. */
export interface BranchSplitRow {
  branch_id: number;
  branch: string | null;
  distributable_profit: number;
  commission_amount: number;
  weight: number;
  base_amount: number;
  reinvestment_amount: number;
  interest_pool: number;
  loan_fee_pool: number;
  penalty_pool: number;
  pools_total: number;
  shortfall: number;
  sources: Array<{ account: string; amount: number }>;
}

export interface DividendPreview {
  period: string;
  period_label: string;
  profit_available: number;
  profit_source: ProfitSource;
  period_closed: boolean;
  period_profit: number | null;
  profit_account_balance: number;
  profit_note: string;
  distributable_profit?: number | null;
  commission_amount?: number | null;
  /** C1: a dividend can only be declared once the month's commission is calculated (otherwise `blocking_reason`). */
  commission_calculated?: boolean;
  base_amount?: number | null;
  dividend_percent: number;
  reinvest_percent: number;
  dividend_pool: number;
  reinvestment_amount: number;
  branches?: BranchSplitRow[];
  total_shares: number;
  as_of_date: string;
  declaration_id: number | null;
  already_declared: boolean;
  pending_request_id?: number | null;
  pending_requested_by?: string | null;
  can_declare: boolean;
  blocking_reason: string | null;
  rows: PreviewRow[];
}

export interface DividendDeclaration {
  id: number;
  period: string;
  period_label: string;
  profit_amount: number;
  profit_source: string | null;
  dividend_percent: number;
  dividend_amount: number;
  reinvest_percent: number;
  reinvest_amount: number;
  total_shares: number | null;
  as_of_date: string | null;
  shareholders: number;
  paid_amount: number;
  outstanding_amount: number;
  status: "OPEN" | "PARTIALLY PAID" | "FULLY PAID";
  declared_by: string | null;
  declared_at: string | null;
  journal_reference: string | null;
  allocation_rule?: string | null;
  distributable_profit?: number | null;
  commission_amount?: number | null;
  base_amount?: number | null;
  reinvestment_credited_to?: string;
  reinvestment_reference?: string | null;
}

/** GET capital/dividends/requests — a requested declaration (pending → approved / rejected by another user, rule 6). */
export interface DividendDeclarationRequest {
  id: number;
  period: string;
  period_label: string;
  status: "pending" | "approved" | "rejected";
  /** The profit amount (for the shared approval component). */
  amount: number;
  profit_amount: number;
  distributable_profit: number | null;
  commission_amount: number | null;
  dividend_percent: number;
  dividend_amount: number;
  reinvest_percent: number;
  reinvest_amount: number;
  requested_by: string | null;
  requested_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  declaration_id: number | null;
  can_approve: boolean;
  approve_blocked_reason: string | null;
  can_reject: boolean;
}

export interface DividendAllocation {
  id: number;
  declaration_id: number;
  share_holder_id: number;
  share_holder: string | null;
  shares_held: number | null;
  total_shares: number | null;
  ownership_percent: number;
  contribution_total: number | null;
  entitlement: number;
  paid_amount: number;
  balance: number;
  status: AllocationStatus;
  status_label: string;
  last_payment_date: string | null;
  payments_count: number;
}

export interface DividendPayment {
  id: number;
  allocation_id: number;
  declaration_id: number | null;
  period: string | null;
  period_label: string | null;
  share_holder: string | null;
  amount: number;
  pay_method: "CASH" | "BANK";
  account: string;
  bank_account_id: number | null;
  reference: string | null;
  paid_at: string | null;
  paid_by: string | null;
  journal_entry_id: number | null;
  journal_reference: string | null;
  status: "posted" | "reversed";
  batch_id: number | null;
  batch_reference: string | null;
  reversed_at: string | null;
  reversed_by: string | null;
  reversal_reason: string | null;
  reversal_reference: string | null;
  /** Whether the signed-in user may reverse this payment now (capital.manage + accounting.reverse, not its poster). */
  can_reverse?: boolean;
  reverse_blocked_reason?: string | null;
}

/** GET capital/dividends/{declaration}/pay-all/preview — computed by the server from the posted payments. */
export interface PayAllPreview {
  declaration_id: number;
  period: string;
  period_label: string;
  /** Shareholders with a remaining balance. */
  shareholders: number;
  paid_shareholders: number;
  total_entitlement: number;
  total_paid: number;
  total_outstanding: number;
  rows: Array<{ allocation_id: number; share_holder_id: number; share_holder: string | null; entitlement: number; paid_amount: number; balance: number }>;
}

export interface PayAllResult {
  id: number;
  batch_reference: string | null;
  total_amount: number;
  payments_count: number;
  payment_ids: number[];
  created: boolean;
}

export interface DividendSettings {
  dividend_percent: number;
  reinvest_percent: number;
}
