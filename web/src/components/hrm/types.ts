export interface SalaryInfo {
  salary: number;
  account_name: string;
  account_number: string;
  fee: number;
  salary_type: string;
  salary_type_label: string | null;
  commission_eligible: boolean;
  payment_method: string;
}

export interface Staff {
  id: number;
  employee_number: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string | null;
  full_name: string;
  phone: string;
  email: string | null;
  username: string | null;
  date_of_birth: string | null;
  gender: string | null;
  position: string;
  status: string;
  photo_url: string;
  branch_id: number | null;
  branch?: string | null;
  role_id: number | null;
  role?: { id: number; key: string; name: string; scope: string } | null;
  zone_id: number | null;
  zone?: string | null;
  salary_info?: SalaryInfo | null;
  created_at: string | null;
}

export interface AmountItem {
  id: number;
  amount: number;
  description: string | null;
  status: string;
  created_at: string;
}

export interface StaffLoan {
  id: number;
  /** Rule 6: whether the signed-in user may take the next step (approve / disburse) and, if not, why. */
  can_approve?: boolean;
  approve_blocked_reason?: string | null;
  branch: string | null;
  employee_id: number;
  employee: string | null;
  category: string | null;
  amount_applied: number;
  amount_approved: number;
  duration: string;
  sessions: number;
  total_payable: number;
  restoration: number;
  fee: number;
  paid_amount: number;
  remaining_amount: number;
  reason: string;
  status: string;
  /** Spec §49 label of the status (e.g. "HR Approved"). */
  status_label: string;
  /** "hr", or "admin" when the request benefits an HR user (§32). */
  review_stage: string;
  /** The step the signed-in user may take now: approve (HR), admin_approve, finance_approve or disburse. */
  next_action: "approve" | "admin_approve" | "finance_approve" | "disburse" | null;
  requested_by: number | null;
  requested_by_name: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  finance_approved_by_name: string | null;
  finance_approved_at: string | null;
  disbursed_by_name: string | null;
  disbursed_at: string | null;
  rejected_by_name: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  completed_at: string | null;
  payments?: { id: number; amount: number; paid_on: string }[];
  created_at: string;
}

export interface StaffAdvance {
  id: number;
  /** Rule 6: whether the signed-in user may take the next step (approve / disburse) and, if not, why. */
  can_approve?: boolean;
  approve_blocked_reason?: string | null;
  branch: string | null;
  employee: string | null;
  category: string | null;
  amount: number;
  fee: number;
  recovered_amount: number;
  outstanding_amount: number;
  source_account: string | null;
  status: string;
  /** Spec §49 label of the status (e.g. "HR Approved"). */
  status_label: string;
  /** "hr", or "admin" when the request benefits an HR user (§32). */
  review_stage: string;
  /** The step the signed-in user may take now: approve (HR), admin_approve, finance_approve or disburse. */
  next_action: "approve" | "admin_approve" | "finance_approve" | "disburse" | null;
  requested_by: number | null;
  requested_by_name: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  finance_approved_by_name: string | null;
  finance_approved_at: string | null;
  disbursed_by_name: string | null;
  disbursed_at: string | null;
  rejected_by_name: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface SalaryPayment {
  id: number;
  employee_id: number;
  employee: string | null;
  employee_number: string | null;
  position: string | null;
  branch: string | null;
  period: string | null;
  salary_type_label: string | null;
  salary: number;
  commission: number;
  allowance: number;
  gross: number;
  staff_fund: number;
  salary_advance: number;
  deduction: number;
  loan_restoration: number;
  total_deductions: number;
  take_home: number;
  phone: string | null;
  account_name: string | null;
  account_number: string | null;
  paid_from_account: string;
  paid_on: string;
  created_at: string;
}

export interface StaffDetail extends Staff {
  allowances: AmountItem[];
  deductions: AmountItem[];
  salary_advances: StaffAdvance[];
  staff_loans: StaffLoan[];
  salary_changes: SalaryChange[];
  salary_payments: SalaryPayment[];
  staff_fund_balance: number;
}

export interface SalaryChange {
  id: number;
  employee_id: number;
  employee?: string | null;
  current_salary: number | null;
  proposed_salary: number;
  proposed_values: Partial<SalaryInfo> & { salary: number };
  status: "submitted" | "approved" | "rejected";
  /** "finance", or "admin" for an HR user's / the proposer's own salary (§32). */
  approval_stage: string;
  reason: string | null;
  requested_by_name?: string | null;
  approved_by_name?: string | null;
  approved_at: string | null;
  rejected_by_name?: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  can_approve: boolean;
  approve_blocked_reason: string | null;
  created_at: string;
}
