/** Shareholder capital contribution as returned by the Capital API (one row per contribution, never overwritten). */
export interface Contribution {
  id: number;
  share_holder_id: number;
  amount: number;
  pay_method: "CASH" | "BANK" | string;
  receiving_account: "company_cash" | "bank" | null;
  receiving_account_label: string | null;
  bank_account_id: number | null;
  bank_account: string | null;
  receipt_number: string | null;
  cheque_number: string | null;
  receipt_file_name: string | null;
  receipt_endpoint: string | null;
  recorded_by: string | null;
  contributed_at: string | null;
  journal_entry_id: number | null;
  journal_reference: string | null;
  share_transaction_reference?: string | null;
  asset_id?: number | null;
  asset_code?: string | null;
  asset_name?: string | null;
  reversed?: boolean;
  /** "pending" (awaiting approval by another user, not counted anywhere), "posted", "rejected" or "reversed". */
  status?: string;
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
  /** Rule 6: false for the employee who recorded it; approve_blocked_reason then says why. */
  can_approve?: boolean;
  approve_blocked_reason?: string | null;
  can_reject?: boolean;
  reversed_at?: string | null;
  reversed_by?: string | null;
  reversal_reason?: string | null;
  reversal_reference?: string | null;
  /** Whether the signed-in user may reverse this CASH / BANK contribution now (capital.manage + accounting.reverse). */
  can_reverse?: boolean;
  reverse_blocked_reason?: string | null;
  created_at: string | null;
  /** "shareholder_portal" when the shareholder submitted it from the Shareholder Portal; null when staff recorded it. */
  source?: string | null;
  source_label?: string;
  cancelled_at?: string | null;
}

export interface ContributionHistory {
  share_holder: { id: number; first_name: string | null; middle_name: string | null; last_name: string | null; name: string };
  total_contributed: number;
  cash_contributed?: number;
  bank_contributed?: number;
  asset_contributed?: number;
  shares: number;
  total_shares: number;
  ownership_percent: number;
  holding_value: number;
  company_total_contributed: number;
  contributions: Contribution[];
}

/** Pay method badge tone: cash green, bank blue, asset primary. */
export function payMethodTone(method: string): "success" | "info" | "primary" {
  return method === "ASSET" ? "primary" : method === "BANK" ? "info" : "success";
}

/** "25%" / "33.3333%": ownership is shown with the API's precision, without trailing zeros. */
export function ownershipLabel(percent: number | null | undefined): string {
  const value = Number(percent ?? 0);
  return `${Number.isFinite(value) ? Number(value.toFixed(4)) : 0}%`;
}
