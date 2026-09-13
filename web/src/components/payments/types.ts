export type BadgeTone = "success" | "warning" | "danger" | "info" | "primary" | "default" | "dark";

export interface Allocation {
  loan_id: number;
  loan_number: string | null;
  amount: number;
  principal: number;
  penalty: number;
  interest: number;
  insurance: number;
  date: string | null;
}

export interface Payment {
  id: number;
  receipt_number: string | null;
  source: "teller" | "webhook" | "manual";
  channel: string;
  reference: string | null;
  transaction_id: string | null;
  phone: string | null;
  amount: number;
  allocated_amount: number;
  unallocated_amount: number;
  status: string;
  status_label: string;
  status_badge: BadgeTone;
  paid_on: string;
  branch_id: number | null;
  branch?: string | null;
  customer_id: number | null;
  customer?: string | null;
  customer_code?: string | null;
  loan_id: number | null;
  loan_number?: string | null;
  employee?: string | null;
  verifier?: string | null;
  verified_at: string | null;
  teller_deposit_id: number | null;
  slip_number?: string | null;
  parent_receipt?: string | null;
  rejection_reason: string | null;
  flag_reason: string | null;
  note: string | null;
  allocations?: Allocation[];
  created_at: string;
}

export interface TellerDeposit {
  id: number;
  branch_id: number;
  branch: string | null;
  teller: string | null;
  bank_account_id: number;
  bank_account: string | null;
  slip_number: string;
  amount: number;
  expected_amount: number;
  difference: number;
  deposit_date: string;
  status: "pending" | "verified" | "mismatch" | "confirmed" | "rejected";
  statement_amount: number | null;
  statement_reference: string | null;
  verifier: string | null;
  verified_at: string | null;
  confirmer: string | null;
  confirmed_at: string | null;
  rejection_reason: string | null;
  payments: Payment[];
}

export const DEPOSIT_BADGE: Record<TellerDeposit["status"], BadgeTone> = {
  pending: "warning",
  verified: "info",
  mismatch: "danger",
  confirmed: "success",
  rejected: "danger",
};
