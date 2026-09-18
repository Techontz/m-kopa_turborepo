import type { CreditAssessment } from "@/components/credit/types";
import type { BadgeTone } from "@/components/ui/Badge";

import type { CustomerFreeze, FreezeState } from "./freeze";
import type { ReversalRequestRow } from "./reversalRequest";
import type { ComponentsStatus, LoanFeeMemo, LoanRecoveryRow, RecoveryPosition } from "./recovery";

/** A write-off request (rule 6 maker/checker): pending until another user with loans.write_off approves or rejects it. */
export interface WriteOffRequest {
  id: number;
  status: "pending" | "approved" | "rejected";
  reason: string | null;
  requested_by: string | null;
  requested_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  can_approve: boolean;
  approve_blocked_reason: string | null;
}

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
  /** Customer type of the loan category (loan detail only). */
  category_customer_type?: string | null;
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
  latest_disbursement?: {
    batch_id: string;
    attempt: number;
    channel: string;
    amount: number;
    status: string;
    failure_reason: string | null;
    source_account: "cash" | "bank";
    source_bank_account_id: number | null;
    source_label: string;
    provider_reference: string | null;
    journal_reference: string | null;
    completed_at: string | null;
  } | null;
  days_past_due: number;
  topup_of_loan_id: number | null;
  agreement_file: string | null;
  agreement_uploaded_at: string | null;
  /** Past branch manager approval: the agreement can be printed and the signed copy uploaded. */
  agreement_available: boolean;
  created_at: string | null;
  approved_at: string | null;
  disbursed_at: string | null;
  withdrawn_at: string | null;
  end_date: string | null;
  closed_at: string | null;
  /** Early full settlement freeze: disbursement (ISO) → expected completion → settlement → freeze window. */
  disbursed_at_iso: string | null;
  expected_completion_date: string | null;
  settled_at: string | null;
  early_settlement: boolean | null;
  freeze_started_at: string | null;
  freeze_days: number | null;
  frozen_until: string | null;
  frozen_until_label: string | null;
  freeze_status: FreezeState;
}

export interface Schedule {
  id: number;
  due_date: string;
  amount: number;
  paid_amount: number;
  pending: number;
}

export interface Eligibility {
  /** eligible AND not frozen */
  allowed: boolean;
  /** normal eligibility rules only (KYC, customer type, one application at a time, top-up) */
  eligible: boolean;
  frozen: boolean;
  /** eligibility reasons plus the freeze message */
  reasons: string[];
  eligibility_reasons: string[];
  frozen_until: string | null;
  freeze: CustomerFreeze;
  topup: { loan_id: number; loan_number: string; eligible: boolean; paid_percent: number; required_percent: number; outstanding: number; reasons: string[] } | null;
  /** `category` = the customer's customer type; `loan_category_ids` = its active loan categories (limits live on each loan category). */
  rules: { kyc_complete: boolean; risk_level: string | null; category: { id: number; code: string | null; name: string } | null; loan_category_ids: number[] };
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
  freeze_time_days?: number;
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
    /** The customer's customer type (customer_categories name). */
    customer_type: string | null;
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
  transactions: LoanTransactionRow[];
  can_reverse_disbursement: boolean;
  reverse_disbursement_blocked_reason: string | null;
  /** Pending maker/checker reversal request of the disbursement, if any. */
  disbursement_reversal_request: ReversalRequestRow | null;
  write_off: {
    amount: number;
    principal_amount: number | null;
    penalty_amount?: number | null;
    interest_amount?: number | null;
    insurance_amount?: number | null;
    /** How the split at write-off is known (C3 Option B). */
    components_status?: ComponentsStatus | null;
    written_off_on: string | null;
  } | null;
  /** Latest write-off request (maker/checker) with the viewer's approval flags. */
  write_off_request?: WriteOffRequest | null;
  /** Rule 7: a fee that is not deducted is a memo only, never part of the repayment. */
  loan_fee?: LoanFeeMemo;
  recovery?: RecoveryPosition | null;
  recovered_total?: number | null;
  recovery_status?: RecoveryPosition["status"] | null;
  recoveries?: LoanRecoveryRow[];
  mandate: { bank_name: string; account_number: string; account_name: string; mandate_reference: string | null; status: string; otp_attempts: number; failure_reason: string | null; activated_at: string | null } | null;
  disbursements: {
    id: number;
    batch_id: string;
    attempt: number;
    channel: string;
    phone: string | null;
    amount: number;
    status: string;
    provider_reference: string | null;
    failure_reason: string | null;
    requested_by: string | null;
    requested_at: string | null;
    completed_at: string | null;
    source_account: "cash" | "bank";
    source_label: string;
    destination: string;
    journal_entry: JournalEntrySummary | null;
  }[];
  disbursement_chain: DisbursementChain | null;
  ledger: { receivable_balance: number; entries: JournalEntrySummary[] };
  max_disbursement_attempts: number;
  topup_of: { id: number; loan_number: string; status_label: string } | null;
  timeline: { id: number; action: string; from: string | null; to: string | null; context: Record<string, unknown> | null; user: string; created_at: string | null }[];
  customer_loans: Loan[];
  customer_freeze: CustomerFreeze;
  /** normal eligibility rules of the loan's customer (LoanWorkflow::borrowingStatus()['eligible']) */
  customer_eligible: boolean;
  /** CreditAssessment::forDisplay() — latest stored snapshot or an unstored preview; null when neither applies (§37) */
  credit_assessment?: CreditAssessment | null;
}

/** A loan transaction on the loan detail page; repayments carry the server-computed reversal eligibility. */
export interface LoanTransactionRow {
  id: number;
  date: string;
  type: string;
  description: string;
  method: string;
  amount: number;
  principal: number;
  penalty: number;
  interest: number;
  reserve: number;
  insurance: number;
  receipt_number: string | null;
  journal_reference: string | null;
  reversed: boolean;
  reversed_at: string | null;
  reversed_by: string | null;
  reversal_reason: string | null;
  reversal_reference: string | null;
  can_reverse: boolean;
  reverse_blocked_reason: string | null;
  /** Pending maker/checker reversal request of this repayment, if any. */
  reversal_request: ReversalRequestRow | null;
}

export interface JournalEntrySummary {
  id: number;
  reference: string;
  description: string;
  entry_date: string | null;
  created_at: string | null;
  lines: { key: string | null; account: string | null; code: string | null; debit: number; credit: number }[];
}

export interface DisbursementChain {
  customer: { id: number; name: string; code: string | null };
  loan: { id: number; loan_number: string; reference_number: string | null; amount_approved: number };
  manager_approval: { by: string; at: string | null; context: Record<string, unknown> | null } | null;
  credit_approval: { by: string; at: string | null; context: Record<string, unknown> | null } | null;
  disbursement: {
    id: number;
    batch_id: string;
    channel: string;
    status: string;
    amount: number;
    source_label: string;
    destination: string;
    provider_reference: string | null;
    requested_by: string | null;
    completed_at: string | null;
  };
  journal_entry: JournalEntrySummary | null;
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
