"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { validAmount } from "@/components/shareholders/portal";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FileField } from "@/components/ui/FileField";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface CapitalForm {
  amount: string;
  payment_method: "" | "CASH" | "BANK";
  bank_account_id: string;
  transaction_reference: string;
  receipt_file: File | null;
}

const EMPTY: CapitalForm = { amount: "", payment_method: "", bank_account_id: "", transaction_reference: "", receipt_file: null };

/**
 * Add Capital: amount, payment method (company bank account for BANK), transaction reference and an optional receipt,
 * then a confirm step. The contribution is recorded PENDING — nothing is posted until the finance team approves it.
 */
export default function AddCapitalPage() {
  const router = useRouter();
  const { can } = useAuth();
  const allowed = can("shareholder.capital.submit");
  const { data: banks } = useApi<Array<{ id: number; name: string }>>(allowed ? "portal/shareholder/bank-accounts" : null);
  const [form, setForm] = useState<CapitalForm>(EMPTY);
  const [confirming, setConfirming] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const submit = useAction<FormData>("post", "portal/shareholder/capital");

  if (!allowed) {
    return <Card title="Add Capital"><p className="mb-0">Your account cannot submit capital contributions.</p></Card>;
  }

  const set = (field: keyof CapitalForm) => (event: { target: { value: string } }) => setForm({ ...form, [field]: event.target.value });
  const bankName = banks?.find((bank) => String(bank.id) === form.bank_account_id)?.name;

  const review = () => {
    if (!validAmount(form.amount)) {
      setLocalError("Enter an amount greater than zero (at most 2 decimals).");
      return;
    }
    if (!form.payment_method || (form.payment_method === "BANK" && !form.bank_account_id) || !form.transaction_reference.trim()) {
      setLocalError("Choose the payment method, the bank account for bank payments and enter the transaction reference.");
      return;
    }
    setLocalError(null);
    setConfirming(true);
  };

  const send = () => {
    const body = new FormData();
    body.append("amount", form.amount.replace(/,/g, "").trim());
    body.append("payment_method", form.payment_method);
    if (form.payment_method === "BANK") {
      body.append("bank_account_id", form.bank_account_id);
    }
    body.append("transaction_reference", form.transaction_reference.trim());
    if (form.receipt_file) {
      body.append("receipt_file", form.receipt_file);
    }
    submit.mutate(body, {
      onSuccess: () => {
        setForm(EMPTY);
        router.push("/shareholder/capital");
      },
      onError: () => setConfirming(false),
    });
  };

  return (
    <>
      <PageHeader crumbs={["Shareholder", "Add Capital"]} right={<Link href="/shareholder/capital" className="btn btn-info btn-sm">Capital History</Link>} />
      <Card title="Add Capital">
        <p className="text-muted">
          Record money you have paid to the company. It stays <b>pending</b> until the finance team verifies and approves it; only then is it added to your
          capital. Shares are issued separately by the company under its share rules.
        </p>

        {confirming ? (
          <div className="sh-confirm" data-testid="capital-confirm">
            <h6>Please confirm your contribution</h6>
            <dl className="sh-kv">
              <dt>Amount</dt><dd><b>TZS {money(form.amount.replace(/,/g, ""))}</b>{form.amount.includes(".") ? ` (${form.amount})` : ""}</dd>
              <dt>Payment method</dt><dd>{form.payment_method}{bankName ? ` · ${bankName}` : ""}</dd>
              <dt>Transaction reference</dt><dd>{form.transaction_reference}</dd>
              <dt>Receipt</dt><dd>{form.receipt_file?.name ?? "None"}</dd>
            </dl>
            <div className="mt-3">
              <button type="button" className="btn btn-primary mr-2" onClick={send} disabled={submit.isPending}>{submit.isPending ? "Please wait..." : "Confirm & Submit"}</button>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)} disabled={submit.isPending}>Back</button>
            </div>
          </div>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); review(); }}>
            <div className="row">
              <Field label="Amount (TZS):" required className="col-md-4" error={submit.fieldError("amount")}>
                <input className="form-control" inputMode="decimal" placeholder="e.g. 1000000" value={form.amount} onChange={set("amount")} required />
              </Field>
              <Field label="Payment method:" required className="col-md-4" error={submit.fieldError("payment_method")}>
                <select className="form-control" value={form.payment_method} onChange={set("payment_method")} required>
                  <option value="">Select method</option>
                  <option value="CASH">CASH</option>
                  <option value="BANK">BANK</option>
                </select>
              </Field>
              {form.payment_method === "BANK" && (
                <Field label="Company bank account:" required className="col-md-4" error={submit.fieldError("bank_account_id")}>
                  <select className="form-control" value={form.bank_account_id} onChange={set("bank_account_id")} required>
                    <option value="">Select bank account</option>
                    {banks?.map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Transaction reference:" required className="col-md-4" error={submit.fieldError("transaction_reference")}>
                <input className="form-control" maxLength={50} placeholder="Bank / receipt reference" value={form.transaction_reference} onChange={set("transaction_reference")} required />
              </Field>
              <Field label="Receipt (optional):" className="col-md-8" error={submit.fieldError("receipt_file")}>
                <FileField file={form.receipt_file} onChange={(file) => setForm({ ...form, receipt_file: file })} accept="application/pdf,image/*" extensions={["pdf", "jpg", "jpeg", "png", "webp"]} maxMb={5} placeholder="Upload receipt (PDF / image)" />
              </Field>
            </div>
            {localError && <div className="field-error mb-2">{localError}</div>}
            <button type="submit" className="btn btn-primary">Review</button>
          </form>
        )}
      </Card>
    </>
  );
}
