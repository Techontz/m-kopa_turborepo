export type ExpenseScope = "branch" | "hq" | "bank";

export interface ExpenseType {
  id: number;
  scope: ExpenseScope;
  name: string;
}

export interface ExpenseRequest {
  id: number;
  scope: ExpenseScope;
  branch_id: number | null;
  branch: string | null;
  expense_type_id: number;
  expense: string | null;
  bank_account_id: number | null;
  bank_account: string | null;
  amount: number;
  description: string | null;
  comment: string | null;
  status: "pending" | "accepted";
  staff: string | null;
  request_date: string;
  paid_from_account: string | null;
  paid_from: string | null;
  approved_by: string | null;
  approved_at: string | null;
  approval_level: "finance" | "admin";
  can_approve: boolean;
}

export interface BankTransfer {
  id: number;
  type: string;
  branch_id: number | null;
  branch: string | null;
  branch_account: string | null;
  branch_account_label: string | null;
  bank_account_id: number | null;
  bank_account: string | null;
  hq_account: string | null;
  hq_account_label: string | null;
  amount: number;
  charge: number;
  status: "pending" | "approved";
  transfer_date: string;
  reference?: string | null;
  journal_reference?: string | null;
  employee?: string | null;
  created_at?: string | null;
}

export interface HqTransaction {
  id: number;
  from_account: string;
  from_account_label: string | null;
  to_account: string;
  to_account_label: string | null;
  amount: number;
  charge: number;
  status: "pending" | "approved";
  staff: string | null;
  date: string;
  approved_at: string | null;
}
