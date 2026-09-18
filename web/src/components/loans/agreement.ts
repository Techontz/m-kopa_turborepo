/** GET /loans/{id}/agreement — the agreement generated after branch manager approval (LoanAgreement service). */
export interface LoanAgreementData {
  company: { name: string; registration_number: string | null; address: string | null; phone: string | null; email: string | null; logo_url: string | null };
  branch: { name: string | null; phone: string | null };
  agreement: {
    number: string;
    loan_number: string;
    reference_number: string | null;
    approved_at: string | null;
    approved_by: string | null;
    loan_officer: string | null;
    generated_at: string;
    uploaded_file: string | null;
    uploaded_at: string | null;
    uploaded_by: string | null;
  };
  borrower: {
    full_name: string;
    customer_code: string | null;
    /** An API path to stream (face-scan capture) or an absolute URL (legacy passport photo). */
    photo_url: string | null;
    id_type: string | null;
    id_number: string | null;
    date_of_birth: string | null;
    gender: string | null;
    marital_status: string | null;
    phone: string | null;
    alternative_phone: string | null;
    email: string | null;
    region: string | null;
    district: string | null;
    ward: string | null;
    street: string | null;
    house_number: string | null;
    postal_code: string | null;
    occupation: string | null;
    employer: string | null;
    department: string | null;
    check_number: string | null;
    business_name: string | null;
    business_address: string | null;
    monthly_income: number;
    bank_name: string | null;
    account_number: string | null;
    wallet: string | null;
  };
  loan: {
    category: string | null;
    amount: number;
    interest_rate: number;
    interest_amount: number;
    total_payable: number;
    loan_fee: number;
    fee_deducted: boolean;
    insurance: number;
    net_disbursement: number;
    topup_of: string | null;
    frequency: "daily" | "weekly" | "monthly";
    instalments: number;
    instalment_amount: number;
    purpose: string | null;
    disbursed_on: string | null;
    end_date: string | null;
    freeze_days: number;
    penalty: { type: "percentage" | "money"; value: number } | null;
  };
  /** Due dates are null until the loan is disbursed; the printed page leaves them blank. */
  schedule: { number: number; due_date: string | null; amount: number }[];
  guarantors: { full_name: string; phone: string | null; id_number: string | null; relationship: string | null; gender: string | null; marital_status: string | null; photo_url: string | null; occupation: string | null; address: string | null }[];
  collaterals: { name: string | null; type: string | null; location: string | null; value: number }[];
  next_of_kin: { full_name: string; phone: string | null; relationship: string | null; address: string | null }[];
}

/** "Kila mwezi" — repayment frequency as printed on the agreement. */
export const FREQUENCY_LABEL: Record<LoanAgreementData["loan"]["frequency"], string> = {
  daily: "Kila siku",
  weekly: "Kila wiki",
  monthly: "Kila mwezi",
};

/** Singular period noun used inside the clauses ("kila mwezi"). */
export const PERIOD_NOUN: Record<LoanAgreementData["loan"]["frequency"], string> = {
  daily: "siku",
  weekly: "wiki",
  monthly: "mwezi",
};

export const agreementPath = (loanId: number) => `/loans/${loanId}/agreement`;
