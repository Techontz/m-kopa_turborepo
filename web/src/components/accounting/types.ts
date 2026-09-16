export interface ChartChild {
  id: number;
  code: string;
  name: string;
  scope: string;
  branch_id: number | null;
  debits: number;
  credits: number;
  balance: number;
}

export interface ChartAccount {
  key: string;
  code: string;
  name: string;
  normal_balance: "debit" | "credit";
  balance: number;
  children: ChartChild[];
}

export interface ChartType {
  type: string;
  label: string;
  balance: number;
  accounts: ChartAccount[];
}

export interface JournalLine {
  id: number;
  code: string | null;
  account: string | null;
  key: string | null;
  scope: string | null;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: number;
  reference: string;
  entry_date: string;
  description: string;
  /** Business event (TransactionType), e.g. "loan_repayment"; null only for untyped legacy rows. */
  transaction_type: string | null;
  transaction_type_label: string | null;
  branch_id: number | null;
  branch: string;
  employee: string | null;
  source_type: string | null;
  source_label: string;
  source_id: number | null;
  total: number;
  reversal_of: string | null;
  reversal_of_id: number | null;
  reversal_reason: string | null;
  reversed_by: string | null;
  is_reversed: boolean;
  /** Whether the generic journal reversal is allowed (manual entries only); the reason explains a block. */
  can_reverse: boolean;
  reverse_blocked_reason: string | null;
  created_at: string | null;
  lines?: JournalLine[];
}

export interface PeriodResult {
  branch_id: number;
  branch: string | null;
  interest_income: number;
  reserve_amount: number;
  fee_income: number;
  penalty_income: number;
  recovery_income: number;
  salary_advance_income: number;
  total_income: number;
  expenses: number;
  gross_profit: number;
  loss_brought_forward: number;
  net_profit: number;
  loss_carried_forward: number;
  hq_hold_percent: number;
  hq_hold_amount: number;
  distributable_profit: number;
  commission_eligible: boolean;
}

export interface AccountingPeriod {
  id: number;
  month: string;
  period_start: string;
  period_end: string;
  status: "open" | "closed";
  closed_by: string | null;
  closed_at: string | null;
  updated_at: string | null;
  results?: PeriodResult[];
  totals?: Omit<PeriodResult, "branch_id" | "branch" | "hq_hold_percent" | "commission_eligible">;
}

export interface AuditChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface AuditEntry {
  id: number;
  created_at: string | null;
  employee_id: number | null;
  employee: string;
  action: string;
  event: string;
  model: string | null;
  model_id: number | null;
  changes: AuditChange[];
  ip_address: string | null;
}
