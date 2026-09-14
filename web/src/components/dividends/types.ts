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
  dividend_percent: number;
  reinvest_percent: number;
  dividend_pool: number;
  reinvestment_amount: number;
  already_declared: boolean;
  declaration_id: number | null;
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

export interface DividendPreview {
  period: string;
  period_label: string;
  profit_available: number;
  profit_source: ProfitSource;
  period_closed: boolean;
  period_profit: number | null;
  profit_account_balance: number;
  profit_note: string;
  dividend_percent: number;
  reinvest_percent: number;
  dividend_pool: number;
  reinvestment_amount: number;
  total_shares: number;
  as_of_date: string;
  declaration_id: number | null;
  already_declared: boolean;
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
