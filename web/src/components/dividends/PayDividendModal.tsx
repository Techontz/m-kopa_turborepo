"use client";

import { useState } from "react";

import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { SelectBox } from "@/components/ui/SelectBox";
import { useAction } from "@/lib/hooks";
import { newIdempotencyKey } from "@/lib/idempotency";

import { tzs, validatePayAmount } from "./dividends";
import type { DividendAllocation } from "./types";

interface PayForm {
  amount: string;
  pay_method: "CASH" | "BANK";
  bank_account_id: string;
  reference: string;
  idempotency_key: string;
}

/**
 * Pay Dividend: full or partial payment of a shareholder's remaining entitlement from the COMPANY ACCOUNT (Cash) or a
 * company bank account. The amount is checked here and again by the API under a row lock.
 */
export function PayDividendModal({ allocation, onClose }: { allocation: DividendAllocation; onClose: () => void }) {
  const [form, setForm] = useState<PayForm>(() => ({
    amount: allocation.balance.toFixed(2).replace(/\.00$/, ""),
    pay_method: "CASH",
    bank_account_id: "",
    reference: "",
    idempotency_key: newIdempotencyKey("dividend"),
  }));
  const [touched, setTouched] = useState(false);
  const pay = useAction<PayForm>("post", `capital/dividends/allocations/${allocation.id}/pay`);

  const amountError = validatePayAmount(form.amount, allocation.balance);
  const bankMissing = form.pay_method === "BANK" && !form.bank_account_id;
  const invalid = Boolean(amountError) || bankMissing;

  return (
    <Modal
      open
      onClose={onClose}
      title="Pay Dividend"
      submitLabel="Pay Dividend"
      cancelLabel="Cancel"
      submitting={pay.isPending}
      onSubmit={() => {
        setTouched(true);
        if (!invalid) {
          pay.mutate(form, { onSuccess: onClose });
        }
      }}
    >
      <div className="row">
        <Field label="Shareholder:" className="col-md-6">
          <input className="form-control" value={allocation.share_holder ?? ""} readOnly />
        </Field>
        <Field label="Dividend Entitlement:" className="col-md-6">
          <input className="form-control" value={tzs(allocation.entitlement)} readOnly />
        </Field>
        <Field label="Amount Paid:" className="col-md-6">
          <input className="form-control" value={tzs(allocation.paid_amount)} readOnly />
        </Field>
        <Field label="Outstanding Balance:" className="col-md-6">
          <input className="form-control" value={tzs(allocation.balance)} readOnly />
        </Field>
        <Field label="Amount to Pay:" required className="col-md-6" error={(touched || form.amount !== "") && amountError ? amountError : pay.fieldError("amount")}>
          <input
            className="form-control"
            inputMode="decimal"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            onBlur={() => setTouched(true)}
            required
            autoComplete="off"
          />
        </Field>
        <Field label="Payment Method:" required className="col-md-6" error={pay.fieldError("pay_method")}>
          <select className="form-control" value={form.pay_method} onChange={(e) => setForm({ ...form, pay_method: e.target.value as PayForm["pay_method"], bank_account_id: "" })} required>
            <option value="CASH">Cash (Company Account)</option>
            <option value="BANK">Bank</option>
          </select>
        </Field>
        {form.pay_method === "BANK" && (
          <Field label="Bank Account:" required className="col-md-6" error={(touched && bankMissing ? "Select the company bank account to pay from." : undefined) ?? pay.fieldError("bank_account_id")}>
            <SelectBox placeholder="Select Account" optionsUrl="capital/options/bank-accounts" value={form.bank_account_id} onChange={(value) => setForm({ ...form, bank_account_id: value ?? "" })} inputId="dividend-bank-account" />
          </Field>
        )}
        <Field label="Reference / Receipt:" className={form.pay_method === "BANK" ? "col-md-6" : "col-md-12"} error={pay.fieldError("reference")}>
          <input className="form-control" maxLength={100} placeholder="Receipt / transaction reference" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
        </Field>
      </div>
      {pay.fieldError("idempotency_key") && <div className="field-error">{pay.fieldError("idempotency_key")}</div>}
    </Modal>
  );
}
