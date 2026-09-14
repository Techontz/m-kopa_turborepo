"use client";

import type { Option } from "@/components/ui/SelectBox";
import { Field } from "@/components/ui/Field";
import { SelectBox } from "@/components/ui/SelectBox";
import { useApi } from "@/lib/hooks";

import type { PayFormValues } from "./dividends";

export const BANK_ACCOUNTS_URL = "capital/options/bank-accounts";

/** Company bank account name for a selected id (null when not paying by Bank or not loaded yet). */
export function useBankAccountLabel(form: Pick<PayFormValues, "pay_method" | "bank_account_id">): string | null {
  const { data } = useApi<Option[]>(form.pay_method === "BANK" ? BANK_ACCOUNTS_URL : null);
  return data?.find((option) => String(option.value) === form.bank_account_id)?.label ?? null;
}

interface Props {
  form: PayFormValues;
  onChange: (patch: Partial<PayFormValues>) => void;
  errors: Partial<Record<"pay_method" | "bank_account_id" | "reference", string | undefined>>;
  idPrefix: string;
}

/** Payment Method Cash (Company Account) / Bank (+ company bank account) and Reference / Receipt. */
export function PayMethodFields({ form, onChange, errors, idPrefix }: Props) {
  return (
    <>
      <Field label="Payment Method:" required className="col-md-6" error={errors.pay_method}>
        <select
          className="form-control"
          value={form.pay_method}
          onChange={(e) => onChange({ pay_method: e.target.value as PayFormValues["pay_method"], bank_account_id: "" })}
          required
          aria-label="Payment Method"
        >
          <option value="CASH">Cash (Company Account)</option>
          <option value="BANK">Bank</option>
        </select>
      </Field>
      {form.pay_method === "BANK" && (
        <Field label="Bank Account:" required className="col-md-6" error={errors.bank_account_id}>
          <SelectBox placeholder="Select Account" optionsUrl={BANK_ACCOUNTS_URL} value={form.bank_account_id} onChange={(value) => onChange({ bank_account_id: value ?? "" })} inputId={`${idPrefix}-bank-account`} />
        </Field>
      )}
      <Field label="Reference / Receipt:" className={form.pay_method === "BANK" ? "col-md-12" : "col-md-6"} error={errors.reference}>
        <input className="form-control" maxLength={100} placeholder="Receipt / transaction reference" value={form.reference} onChange={(e) => onChange({ reference: e.target.value })} aria-label="Reference / Receipt" />
      </Field>
    </>
  );
}
