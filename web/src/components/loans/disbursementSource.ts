/** Disbursement source helpers shared by the disbursement desk and the loan detail page. */

export type SourceAccount = "cash" | "bank";

export interface SourceOption {
  value: string;
  label: string;
  balance: number;
  required: number;
}

export interface DisbursementSources {
  cash: SourceOption;
  banks: SourceOption[];
}

export interface SourceChoice {
  source_account: SourceAccount | "";
  source_bank_account_id: string;
}

export const EMPTY_SOURCE: SourceChoice = { source_account: "", source_bank_account_id: "" };

/** The option the choice points at (branch cash or one bank account), if any. */
export function selectedSource(sources: DisbursementSources | undefined, choice: SourceChoice): SourceOption | null {
  if (!sources || choice.source_account === "") {
    return null;
  }
  if (choice.source_account === "cash") {
    return sources.cash;
  }
  return sources.banks.find((bank) => bank.value === choice.source_bank_account_id) ?? null;
}

/** True when the selected account holds what the posting takes from it. */
export function hasSufficientBalance(option: SourceOption | null): boolean {
  return option !== null && option.balance + 0.001 >= option.required;
}

/** Request body for prepare / disburse / retry / escalation (empty when nothing was chosen). */
export function sourcePayload(choice: SourceChoice): Partial<{ source_account: SourceAccount; source_bank_account_id: number }> {
  if (choice.source_account === "") {
    return {};
  }
  return choice.source_account === "bank"
    ? { source_account: "bank", source_bank_account_id: Number(choice.source_bank_account_id) }
    : { source_account: "cash" };
}
