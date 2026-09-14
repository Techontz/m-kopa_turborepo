"use client";

import { useState } from "react";

import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useAction } from "@/lib/hooks";
import { newIdempotencyKey } from "@/lib/idempotency";

import { nextPayStep, payConfirmationRows, tzs, validatePayForm, type PayFormValues, type PayStep } from "./dividends";
import { PayMethodFields, useBankAccountLabel } from "./PayMethodFields";
import type { DividendAllocation } from "./types";

interface PayBody extends PayFormValues {
  idempotency_key: string;
}

/**
 * Pay Dividend (two steps): 1. amount (default = outstanding balance, capped at it), Cash (Company Account) or a company
 * bank account, reference; 2. "Confirm Dividend Payment" summary. The API re-checks the balance under a row lock; the
 * idempotency key is generated once per modal so a double click cannot pay twice.
 */
export function PayDividendModal({ allocation, onClose }: { allocation: DividendAllocation; onClose: () => void }) {
  const outstanding = allocation.balance;
  const [idempotencyKey] = useState(() => newIdempotencyKey("dividend"));
  const [form, setForm] = useState<PayFormValues>(() => ({
    amount: outstanding.toFixed(2).replace(/\.00$/, ""),
    pay_method: "CASH",
    bank_account_id: "",
    reference: "",
  }));
  const [step, setStep] = useState<PayStep>("form");
  const [touched, setTouched] = useState(false);
  const pay = useAction<PayBody>("post", `capital/dividends/allocations/${allocation.id}/pay`);
  const accountLabel = useBankAccountLabel(form);

  const errors = validatePayForm(form, outstanding);
  const update = (patch: Partial<PayFormValues>) => {
    setForm((current) => ({ ...current, ...patch }));
    pay.setErrors({});
  };

  if (step === "confirm") {
    return (
      <Modal
        open
        onClose={pay.isPending ? () => undefined : onClose}
        title="Confirm Dividend Payment"
        submitLabel="Confirm Payment"
        cancelLabel="Cancel"
        submitting={pay.isPending}
        onSubmit={() => {
          if (!pay.isPending) {
            pay.mutate({ ...form, idempotency_key: idempotencyKey }, { onSuccess: onClose, onError: () => setStep("form") });
          }
        }}
      >
        <table className="table table-sm mb-2" aria-label="Payment summary">
          <tbody>
            {payConfirmationRows(allocation, form, accountLabel).map((row) => (
              <tr key={row.label}>
                <th scope="row" className="text-muted font-weight-normal">{row.label}</th>
                <td className="text-right font-weight-bold">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className="btn btn-link btn-sm p-0" disabled={pay.isPending} onClick={() => setStep(nextPayStep(step, "back", form, outstanding))}>
          <i className="icon-arrow-left" /> Edit payment
        </button>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Pay Dividend"
      submitLabel="Continue"
      cancelLabel="Cancel"
      onSubmit={() => {
        setTouched(true);
        setStep(nextPayStep(step, "continue", form, outstanding));
      }}
    >
      <div className="row">
        <Field label="Shareholder:" className="col-md-6">
          <input className="form-control" value={allocation.share_holder ?? ""} readOnly aria-label="Shareholder" />
        </Field>
        <Field label="Dividend Entitlement:" className="col-md-6">
          <input className="form-control text-right" value={tzs(allocation.entitlement)} readOnly aria-label="Dividend Entitlement" />
        </Field>
        <Field label="Amount Already Paid:" className="col-md-6">
          <input className="form-control text-right" value={tzs(allocation.paid_amount)} readOnly aria-label="Amount Already Paid" />
        </Field>
        <Field label="Outstanding Balance:" className="col-md-6">
          <input className="form-control text-right" value={tzs(outstanding)} readOnly aria-label="Outstanding Balance" />
        </Field>
        <Field label="Maximum Payable:" className="col-md-6">
          <input className="form-control text-right" value={tzs(outstanding)} readOnly aria-label="Maximum Payable" />
        </Field>
        <Field label="Amount to Pay:" required className="col-md-6" error={(touched || form.amount !== "") && errors.amount ? errors.amount : pay.fieldError("amount")}>
          <input
            className="form-control text-right"
            inputMode="decimal"
            value={form.amount}
            onChange={(e) => update({ amount: e.target.value })}
            onBlur={() => setTouched(true)}
            required
            autoComplete="off"
            aria-label="Amount to Pay"
          />
          <button type="button" className="btn btn-link btn-sm p-0" onClick={() => update({ amount: outstanding.toFixed(2).replace(/\.00$/, "") })}>
            Pay full balance ({tzs(outstanding)})
          </button>
        </Field>
        <PayMethodFields
          form={form}
          onChange={update}
          idPrefix="dividend"
          errors={{
            pay_method: pay.fieldError("pay_method"),
            bank_account_id: (touched ? errors.bank_account_id : undefined) ?? pay.fieldError("bank_account_id"),
            reference: pay.fieldError("reference"),
          }}
        />
      </div>
      {pay.fieldError("idempotency_key") && <div className="field-error">{pay.fieldError("idempotency_key")}</div>}
    </Modal>
  );
}
