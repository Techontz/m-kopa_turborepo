"use client";

import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

import { hasSufficientBalance, type DisbursementSources } from "./disbursementSource";

interface DisbursementSourceFieldsProps {
  loanId: number;
  fieldError?: (field: string) => string | undefined;
}

/**
 * Every loan is paid from the HQ PRINCIPAL A/C — there is nothing to choose. Shows the account's ledger balance and
 * what this loan takes from it.
 */
export function DisbursementSourceFields({ loanId, fieldError }: DisbursementSourceFieldsProps) {
  const { data: sources, isLoading } = useApi<DisbursementSources>(`loans/${loanId}/disbursement-sources`);
  const cash = sources?.cash;
  const error = fieldError?.("source_account");

  return (
    <div>
      <p className="mb-1">Source: <b>{cash?.label ?? "PRINCIPAL A/C (HQ CASH)"}</b></p>
      {isLoading && <small className="text-muted">Loading balance...</small>}
      {cash && (
        <>
          <p className={`mb-0 ${hasSufficientBalance(cash) ? "text-success" : "text-danger"}`}>
            Balance <b>{money(cash.balance)}</b> · this loan takes <b>{money(cash.required)}</b>
            {hasSufficientBalance(cash) ? "" : " — insufficient balance"}
          </p>
          <small className="text-muted">Posting: Dr LOAN RECEIVABLE (customer loan account) / Cr {cash.label}.</small>
        </>
      )}
      {error && <div className="text-danger mt-1"><small>{error}</small></div>}
    </div>
  );
}
