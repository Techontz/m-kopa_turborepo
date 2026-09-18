/** Disbursement source helpers shared by the disbursement desk and the loan detail page. */

export interface SourceOption {
  value: string;
  label: string;
  balance: number;
  required: number;
}

/** Loans are always paid out of the HQ PRINCIPAL A/C. */
export interface DisbursementSources {
  cash: SourceOption;
}

/** True when the account holds what the posting takes from it. */
export function hasSufficientBalance(option: SourceOption | null | undefined): boolean {
  return option != null && option.balance + 0.001 >= option.required;
}
