import type { BadgeTone } from "@/components/ui/Badge";

export interface Loan {
  id: number;
  loan_number: string;
  reference_number: string | null;
  customer_id: number;
  customer_name?: string;
  customer_phone?: string;
  customer_status?: string;
  customer_status_label?: string;
  branch_id: number;
  branch?: string;
  loan_category_id: number;
  category?: string;
  requires_mandate?: boolean;
  group_id: number | null;
  amount_applied: number;
  amount_approved: number;
  interest_rate: number;
  interest_amount: number;
  total_payable: number;
  restoration: number;
  instalment: number;
  loan_fee: number;
  insurance: number;
  fee_deduct: boolean;
  formula: string;
  duration: string | null;
  duration_label: string | null;
  sessions: number;
  reason: string;
  is_special: boolean;
  status: string;
  status_label: string;
  status_badge: BadgeTone;
  decision_reason: string | null;
  telco_name: string | null;
  telco_matched: boolean | null;
  telco_verified_at: string | null;
  disbursement_channel: string | null;
  disbursement_attempts: number;
  latest_disbursement?: { batch_id: string; attempt: number; channel: string; amount: number; status: string; failure_reason: string | null } | null;
  days_past_due: number;
  topup_of_loan_id: number | null;
  agreement_file: string | null;
  created_at: string | null;
  approved_at: string | null;
  disbursed_at: string | null;
  withdrawn_at: string | null;
  end_date: string | null;
  closed_at: string | null;
  frozen_until: string | null;
}

export interface Schedule {
  id: number;
  due_date: string;
  amount: number;
  paid_amount: number;
  pending: number;
}

export interface Eligibility {
  allowed: boolean;
  reasons: string[];
  frozen_until: string | null;
  topup: { loan_id: number; loan_number: string; eligible: boolean; paid_percent: number; required_percent: number; outstanding: number; reasons: string[] } | null;
  rules: { kyc_complete: boolean; risk_level: string | null; min_amount: number | null; max_amount: number | null; category: { name: string } | null };
}

export interface CategoryOption {
  value: string;
  label: string;
  allowed: boolean;
  amount_from: number;
  amount_to: number;
  interest_rate: number;
  formula: string;
  duration: string | null;
  duration_label: string | null;
  repayment_from: number;
  repayment_to: number;
  fee_deduct: boolean;
  requires_mandate: boolean;
  topup_percent: number;
}

export interface LoanDetail {
  loan: Loan;
  customer: {
    id: number;
    full_name: string;
    short_name: string;
    customer_code: string;
    photo_url: string;
    phone: string;
    gender: string;
    age: number | null;
    monthly_income: number;
    business_type: string | null;
    place_of_business: string | null;
    region: string | null;
    district: string;
    ward: string;
    street: string;
    id_number: string | null;
    branch: string | null;
    status_label: string;
    kyc_status: string;
    created_at: string | null;
  };
  guarantors: { id: number; full_name: string; phone: string; gender: string | null; marital_status: string | null; id_number: string | null; relationship: string; address: string }[];
  available_guarantors: { value: string; label: string }[];
  collaterals: { id: number; name: string; type: string; location: string; value: number }[];
  collateral_attachment: string | null;
  deductions: { remain_loan: number; salary_advance: number; penalty: number; loan_fee: number; total: number; remain_cash: number };
  net_disbursement: number;
  outstanding: { principal: number; penalty: number; interest: number; insurance: number; total: number } | null;
  paid_amount: number;
  schedules: Schedule[];
  transactions: { id: number; date: string; type: string; description: string; method: string; amount: number; principal: number; penalty: number; interest: number }[];
  mandate: { bank_name: string; account_number: string; account_name: string; mandate_reference: string | null; status: string; otp_attempts: number; failure_reason: string | null; activated_at: string | null } | null;
  disbursements: { id: number; batch_id: string; attempt: number; channel: string; phone: string | null; amount: number; status: string; provider_reference: string | null; failure_reason: string | null; requested_by: string | null; requested_at: string | null; completed_at: string | null }[];
  max_disbursement_attempts: number;
  topup_of: { id: number; loan_number: string; status_label: string } | null;
  timeline: { id: number; action: string; from: string | null; to: string | null; context: Record<string, unknown> | null; user: string; created_at: string | null }[];
  customer_loans: Loan[];
}

export interface LoanForm {
  category_id: string;
  group_id: string;
  how_loan: string;
  day: string;
  session: string;
  rate: string;
  fee_status: string;
  reason: string;
  instalment?: string;
}

export const EMPTY_LOAN_FORM: LoanForm = { category_id: "", group_id: "", how_loan: "", day: "", session: "", rate: "", fee_status: "", reason: "" };
