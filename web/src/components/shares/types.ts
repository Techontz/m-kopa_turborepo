/** Shares Management API shapes (api/app/Http/Resources/Api/V1/Shares and the Shares controllers). */

export interface ShareStructure {
  id: number;
  authorised_shares: number | null;
  initial_capital_basis: number;
  initial_shares: number;
  initial_share_value: number;
  established_on: string;
  notes: string | null;
  created_by: string | null;
  created_at: string | null;
}

export interface RegisterRow {
  share_holder_id: number;
  name: string;
  shares: number;
  total_shares: number;
  ownership_percent: number;
  share_value: number;
  holding_value: number;
  date_acquired: string | null;
  status: "active" | "no_shares";
  rank?: number;
  cumulative_percent?: number;
  /** Contribution columns, present only for users who may see capital. */
  total_contributed?: number;
  cash_contributed?: number;
  bank_contributed?: number;
  asset_contributed?: number;
}

export interface ShareHolderInfo {
  id: number;
  name: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  mobile: string | null;
  email: string | null;
  gender: string | null;
  date_of_birth: string | null;
  photo_endpoint: string | null;
}

export type ShareHolderRow = ShareHolderInfo & RegisterRow;

export type ShareTransactionType = "initial_allocation" | "issuance" | "bonus_issuance" | "transfer" | "cancellation" | "adjustment" | "reversal";

export interface ShareTransaction {
  id: number;
  reference: string;
  type: ShareTransactionType;
  type_label: string;
  from_share_holder_id: number | null;
  from_share_holder: string | null;
  to_share_holder_id: number | null;
  to_share_holder: string | null;
  shares: number;
  issued_change: number;
  share_value: number;
  value_at_time: number;
  price_per_share: number | null;
  total_amount: number | null;
  payment_treatment: "paid" | "linked_contribution" | "no_cash" | null;
  payment_treatment_label: string | null;
  transacted_at: string;
  date: string;
  status: "completed" | "reversed";
  notes: string | null;
  capital_id: number | null;
  capital_amount: number | null;
  receiving_account: string | null;
  receipt_number: string | null;
  journal_entry_id: number | null;
  journal_reference: string | null;
  reversal_of_id: number | null;
  reversal_of_reference: string | null;
  reversed_by_reference: string | null;
  document_name: string | null;
  document_endpoint: string | null;
  performed_by: string | null;
  created_at: string | null;
}

export interface ShareValuation {
  id: number;
  reference: string;
  kind: "initial" | "revaluation";
  previous_value: number | null;
  new_value: number;
  change: number | null;
  change_percent: number | null;
  valuation_date: string;
  total_shares: number;
  previous_total_valuation: number | null;
  new_total_valuation: number;
  reason: string;
  status: "effective" | "reversed";
  performed_by: string | null;
  reversed_at: string | null;
  reversed_by: string | null;
  reversal_reason: string | null;
  created_at: string | null;
}

export interface SharesOverview {
  has_structure: boolean;
  structure: ShareStructure | null;
  total_issued_shares: number;
  authorised_shares: number | null;
  available_shares: number | null;
  current_share_value: number;
  total_valuation: number;
  shareholders_with_shares: number;
  registered_shareholders: number;
  register_consistent: boolean;
  distribution: RegisterRow[];
  recent_transactions: ShareTransaction[];
  recent_valuations: ShareValuation[];
}

export interface HoldingPoint {
  date: string;
  shares: number;
  total_shares: number;
  ownership_percent: number;
  share_value: number;
  holding_value: number;
}

export interface ShareProfile {
  share_holder: ShareHolderInfo;
  holding: RegisterRow;
  history: HoldingPoint[];
  transactions: ShareTransaction[];
  can_view_contributions: boolean;
  total_contributed: number | null;
  contribution_breakdown?: { cash: number; bank: number; asset: number; total: number } | null;
  contributions:
    | {
        id: number;
        amount: number;
        pay_method: string;
        receiving_account_label: string | null;
        receipt_number: string | null;
        contributed_at: string | null;
        recorded_by: string | null;
        journal_reference: string | null;
        share_transaction_reference: string | null;
        asset_id?: number | null;
        asset_code?: string | null;
        asset_name?: string | null;
        reversed?: boolean;
      }[]
    | null;
}

export interface RegisterResponse {
  as_of: string;
  total_shares: number;
  share_value: number;
  total_valuation: number;
  can_view_contributions?: boolean;
  rows: RegisterRow[];
}
