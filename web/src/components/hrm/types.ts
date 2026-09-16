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
  salary_payments: SalaryPayment[];
  staff_fund_balance: number;
}
