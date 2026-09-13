"use client";

import { Field } from "@/components/ui/Field";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

import { hasSufficientBalance, selectedSource, type DisbursementSources, type SourceChoice } from "./disbursementSource";

interface DisbursementSourceFieldsProps {
  loanId: number;
  value: SourceChoice;
  onChange: (value: SourceChoice) => void;
  fieldError?: (field: string) => string | undefined;
  /** False when leaving the source empty keeps the previous batch's source. */
  required?: boolean;
}

/**
 * Finance chooses where the loan is paid from: branch cash (the branch PRINCIPAL A/C) or a company bank account.
 * Shows each account's ledger balance and what this loan takes from it.
 */
export function DisbursementSourceFields({ loanId, value, onChange, fieldError, required = true }: DisbursementSourceFieldsProps) {
  const { data: sources, isLoading } = useApi<DisbursementSources>(`loans/${loanId}/disbursement-sources`);
  const selected = selectedSource(sources, value);

  return (
    <div className="row">
      <Field label="Disbursement Source:" required={required} className="col-md-12" error={fieldError?.("source_account")}>
        <select className="form-control" value={value.source_account} onChange={(e) => onChange({ source_account: e.target.value as SourceChoice["source_account"], source_bank_account_id: "" })} required={required}>
          <option value="">{isLoading ? "Loading..." : required ? "Select" : "Keep current source"}</option>
          <option value="cash">CASH — {sources?.cash.label ?? "PRINCIPAL A/C"} ({money(sources?.cash.balance)})</option>
          <option value="bank" disabled={sources !== undefined && sources.banks.length === 0}>BANK — company bank account</option>
        </select>
      </Field>
      {value.source_account === "bank" && (
        <Field label="Bank Account:" required className="col-md-12" error={fieldError?.("source_bank_account_id")}>
          <select className="form-control" value={value.source_bank_account_id} onChange={(e) => onChange({ ...value, source_bank_account_id: e.target.value })} required>
            <option value="">Select</option>
            {sources?.banks.map((bank) => <option key={bank.value} value={bank.value}>{bank.label} ({money(bank.balance)})</option>)}
          </select>
        </Field>
      )}
      {selected && (
        <div className="col-md-12">
          <p className={`mb-0 ${hasSufficientBalance(selected) ? "text-success" : "text-danger"}`}>
            Balance <b>{money(selected.balance)}</b> · this loan takes <b>{money(selected.required)}</b>
            {hasSufficientBalance(selected) ? "" : " — insufficient balance"}
          </p>
          <small className="text-muted">Posting: Dr LOAN RECEIVABLE (customer loan account) / Cr {selected.label}.</small>
        </div>
      )}
    </div>
  );
}
