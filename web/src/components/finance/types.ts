import type { Approvable } from "./Approval";
import type { Reversible } from "./Reversal";

export type ExpenseScope = "branch" | "hq" | "bank";

export interface ExpenseType {
  id: number;
  scope: ExpenseScope;
  name: string;
}

export interface ExpenseRequest extends Reversible, Approvable {
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
  status: "pending" | "accepted" | "reversed";
  staff: string | null;
  request_date: string;
  paid_from_account: string | null;
  paid_from: string | null;
  approved_by: string | null;
  approved_at: string | null;
  approval_level: "finance" | "admin";
  can_approve: boolean;
  approve_blocked_reason?: string | null;
  journal_reference?: string | null;
}

export interface BankTransfer extends Reversible, Approvable {
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
  status: "pending" | "approved" | "rejected" | "reversed";
  transfer_date: string;
  reference?: string | null;
  journal_reference?: string | null;
  employee?: string | null;
  created_at?: string | null;
}

export interface HqTransaction extends Reversible, Approvable {
  id: number;
  from_account: string;
  from_account_label: string | null;
  to_account: string;
  to_account_label: string | null;
  amount: number;
  charge: number;
  status: "pending" | "approved" | "reversed";
  staff: string | null;
  date: string;
  approved_at: string | null;
}
