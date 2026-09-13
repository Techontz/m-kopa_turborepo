/** Shared types for the Customers / KYC module (API: api/routes/api/customers.php). */

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
}

export interface NidaIdentity {
  nida_number: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  phone: string;
  phone_masked?: string;
  photo?: string | null;
}

export interface OptionSource {
  kind: "tree" | "flat" | "fixed";
  tree?: string;
  path?: Array<{ field?: string; property?: string }>;
  take?: "keys" | "values";
  extraOptions?: string[];
  options?: string[];
}

export interface FormField {
  key: string;
  label: string;
  control: "select" | "input";
  inputType: string | null;
  required: boolean;
  fullWidth: boolean;
  dependsOn: string | null;
  requiredWhen: { field: string; equals: string[] } | null;
  optionSource?: OptionSource;
  group?: string;
}

export interface CustomerCategory {
  id: number;
  key: string;
  name: string;
  icon: string | null;
  section_title: string | null;
  risk_level: string;
  min_loan_amount: number;
  max_loan_amount: number;
  required_documents: string[];
  form_schema: FormField[];
  loan_categories: Array<{ id: number; name: string }>;
}

export type OptionTrees = Record<string, unknown>;

export interface CustomerDocumentRow {
  id: number;
  document_type: string;
  original_name: string;
  size: number;
  uploaded_at: string;
  url: string;
}

export interface GuarantorRow {
  id: number;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  phone: string;
  gender: string | null;
  marital_status: string | null;
  id_number: string | null;
  relationship: string;
  region_id: number | null;
  region: string | null;
  district: string | null;
  ward: string | null;
  street: string | null;
}

export interface CustomerLoanRow {
  id: number;
  loan_number: string;
  product: string | null;
  interest_rate: number;
  amount_withdrawn: number;
  total_payable: number;
  duration: string | null;
  sessions: number;
  restoration: number;
  status: string | null;
  status_badge: string | null;
  withdrawn_at: string | null;
  end_date: string | null;
}

export interface CustomerProfile {
  id: number;
  customer_code: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  full_name: string;
  short_name: string;
  gender: string;
  date_of_birth: string | null;
  age: number | null;
  phone: string;
  branch_id: number;
  branch: string | null;
  employee_id: number | null;
  employee: string | null;
  work_status: string;
  customer_type: string | null;
  region_id: number | null;
  region: string | null;
  district: string;
  ward: string;
  street: string;
  nickname: string | null;
  marital_status: string | null;
  business_type: string | null;
  place_of_business: string | null;
  dependents: number | null;
  monthly_income: number | null;
  id_number: string | null;
  check_number: string | null;
  account_number: string | null;
  status: string;
  status_label: string;
  kyc_status: string;
  is_marked: boolean;
  registration_step: number;
  created_at: string | null;
  photo_url: string | null;
  legacy_attachment: string | null;
  category: { id: number; key: string; name: string; icon: string | null; risk_level: string; required_documents: string[] } | null;
  kyc: {
    state: "completed" | "pending" | "legacy";
    checklist: ChecklistItem[];
    nida: NidaIdentity | null;
    nida_verified_at: string | null;
    otp_verified_at: string | null;
    face_verified_at: string | null;
    face_liveness_score: number | null;
    face_match_score: number | null;
    category_answers: Record<string, string | number> | null;
    completed_at: string | null;
  };
  residence: { region_code: string; region_name: string; district_code: string; district_name: string; ward_code: string; ward_name: string; street_name: string; ownership: string } | null;
  bank: { bank_name: string; account_number: string; account_name: string; check_number: string | null; phone: string | null } | null;
  next_of_kin: { first_name: string; middle_name: string | null; last_name: string; phone: string; relationship: string | null } | null;
  documents: CustomerDocumentRow[];
  guarantors: GuarantorRow[];
  loans: CustomerLoanRow[];
}

/** Browser path of an API file endpoint (served through the authenticated /api/backend proxy). */
export function backendUrl(path: string): string {
  return `/api/backend/${path.replace(/^\//, "")}`;
}
