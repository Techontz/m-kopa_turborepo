export interface SalaryAdvanceCategory {
  id: number;
  name: string;
  interest_rate: number;
  amount_from: number;
  amount_to: number;
  fee: number;
}

export interface SalaryAdvancePayment {
  id: number;
  amount: number;
  paid_on: string;
  created_at: string | null;
}

export interface SalaryAdvance {
  id: number;
  branch_id: number;
  branch: string | null;
  customer_id: number;
  customer: string | null;
  phone: string | null;
  category: string | null;
  amount: number;
  interest_rate: number;
  total_payable: number;
  paid_amount: number;
  remaining_amount: number;
  fee: number;
  status: "pending" | "active" | "done" | "reversed";
  created_at: string;
  approved_at: string | null;
  start_date: string;
  end_date: string;
  alert: "new" | "old";
  payments?: SalaryAdvancePayment[];
}

export interface AgentTransaction {
  id: number;
  branch_id: number;
  branch: string | null;
  payment_mode: string | null;
  agent: string | null;
  customer: string | null;
  user: string | null;
  amount: number;
  loan_amount: number;
  transaction_time: string | null;
  transaction_date: string;
  reversed: boolean;
  reversal_reason: string | null;
}

export interface BranchBalance {
  branch_id: number;
  branch: string;
  amount: number;
}

export interface SavingTransaction {
  id: number;
  branch: string | null;
  customer_id: number;
  customer: string | null;
  type: "deposit" | "withdrawal";
  withdrawal_type: "TAKEN" | "CLEAR" | null;
  description: string;
  amount: number;
  transaction_date: string;
  reversed: boolean;
  reversal_reason: string | null;
  balance?: number;
}
