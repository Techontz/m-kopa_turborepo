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
  created_at: string | null;
}

export interface ContributionHistory {
  share_holder: { id: number; first_name: string | null; middle_name: string | null; last_name: string | null; name: string };
  total_contributed: number;
  ownership_percent: number;
  company_total_contributed: number;
  contributions: Contribution[];
}

/** "25%" / "33.3333%": ownership is shown with the API's precision, without trailing zeros. */
export function ownershipLabel(percent: number | null | undefined): string {
  const value = Number(percent ?? 0);
  return `${Number.isFinite(value) ? Number(value.toFixed(4)) : 0}%`;
}
