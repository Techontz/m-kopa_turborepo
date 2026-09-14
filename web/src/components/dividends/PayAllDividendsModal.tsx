"use client";

import { useState } from "react";

import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useAction, useApi } from "@/lib/hooks";
import { newIdempotencyKey } from "@/lib/idempotency";

import { loadState, payAllConfirmText, tzs, type PayFormValues } from "./dividends";
import { PayMethodFields, useBankAccountLabel } from "./PayMethodFields";
import type { PayAllPreview, PayAllResult } from "./types";

type PayAllForm = Omit<PayFormValues, "amount">;

interface PayAllBody extends PayAllForm {
  expected_total: number;
  idempotency_key: string;
}

/**
 * PAY ALL OUTSTANDING for one declaration. The shareholder count and total come from the server preview; the API pays
 * the balances it computes under row locks in one transaction and refuses the batch when the confirmed total changed.
 */
export function PayAllDividendsModal({ declarationId, periodLabel, onClose }: { declarationId: number; periodLabel: string; onClose: () => void }) {
  const preview = useApi<PayAllPreview>(`capital/dividends/${declarationId}/pay-all/preview`);
  const [idempotencyKey] = useState(() => newIdempotencyKey("dividend-batch"));
  const [form, setForm] = useState<PayAllForm>({ pay_method: "CASH", bank_account_id: "", reference: "" });
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [touched, setTouched] = useState(false);
  const payAll = useAction<PayAllBody, { data: PayAllResult }>("post", `capital/dividends/${declarationId}/pay-all`);
  const accountLabel = useBankAccountLabel(form);

  const totals = preview.data;
  const bankMissing = form.pay_method === "BANK" && !form.bank_account_id;
  const nothingOutstanding = Boolean(totals) && ((totals?.total_outstanding ?? 0) <= 0 || (totals?.shareholders ?? 0) === 0);
  const status = loadState({ isLoading: preview.isLoading, error: preview.error });
  const update = (patch: Partial<PayAllForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    payAll.setErrors({});
  };

  if (step === "confirm" && totals) {
    return (
      <Modal
        open
        onClose={payAll.isPending ? () => undefined : onClose}
        title="Confirm Dividend Payment"
        submitLabel="Confirm Payment"
        cancelLabel="Cancel"
        submitting={payAll.isPending}
        onSubmit={() => {
          if (payAll.isPending) {
            return;
          }
          payAll.mutate(
            { ...form, expected_total: totals.total_outstanding, idempotency_key: idempotencyKey },
            {
              onSuccess: onClose,
              onError: () => {
                setStep("form");
                void preview.refetch();
              },
            },
          );
        }}
      >
        <p className="h6 mb-3">{payAllConfirmText(totals.total_outstanding, totals.shareholders)}</p>
        <table className="table table-sm mb-2" aria-label="Pay all summary">
          <tbody>
            <tr><th scope="row" className="text-muted font-weight-normal">Declaration</th><td className="text-right font-weight-bold">{totals.period_label}</td></tr>
            <tr><th scope="row" className="text-muted font-weight-normal">Payment Method</th><td className="text-right font-weight-bold">{form.pay_method === "BANK" ? "Bank" : "Cash (Company Account)"}</td></tr>
            <tr><th scope="row" className="text-muted font-weight-normal">Account</th><td className="text-right font-weight-bold">{form.pay_method === "BANK" ? accountLabel ?? "-" : "COMPANY ACCOUNT"}</td></tr>
            <tr><th scope="row" className="text-muted font-weight-normal">Reference / Receipt</th><td className="text-right font-weight-bold">{form.reference.trim() || "-"}</td></tr>
          </tbody>
        </table>
        <p className="text-muted small mb-0">Each shareholder receives exactly their outstanding balance as a separate payment with its own journal entry. Fully paid shareholders ({totals.paid_shareholders}) are skipped.</p>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Pay All Outstanding — ${totals?.period_label ?? periodLabel}`}
      submitLabel="Continue"
      cancelLabel="Cancel"
      onSubmit={() => {
        setTouched(true);
        if (totals && !nothingOutstanding && !bankMissing) {
          setStep("confirm");
        }
      }}
    >
      {status.state === "loading" && <div className="mf-loading">{status.message}</div>}
      {status.state === "error" && <div className="alert alert-danger">{status.message}</div>}
      {payAll.fieldError("expected_total") && <div className="alert alert-warning">{payAll.fieldError("expected_total")}</div>}
      {totals && (
        <div className="row">
          <Field label="Outstanding Shareholders:" className="col-md-6">
            <input className="form-control text-right" value={String(totals.shareholders)} readOnly aria-label="Outstanding Shareholders" />
          </Field>
          <Field label="Total Outstanding:" className="col-md-6">
            <input className="form-control text-right" value={tzs(totals.total_outstanding)} readOnly aria-label="Total Outstanding" />
          </Field>
          {nothingOutstanding ? (
            <div className="col-12">
              <div className="alert alert-success mb-0">All dividends for {totals.period_label} are paid. There is nothing outstanding.</div>
            </div>
          ) : (
            <>
              <div className="col-12 table-responsive mb-3">
                <table className="table table-sm mb-0" aria-label="Outstanding balances">
                  <thead>
                    <tr>
                      <th>Shareholder</th>
                      <th className="text-right">Entitlement</th>
                      <th className="text-right">Paid</th>
                      <th className="text-right">To Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totals.rows.map((row) => (
                      <tr key={row.allocation_id}>
                        <td>{row.share_holder}</td>
                        <td className="text-right text-nowrap">{tzs(row.entitlement)}</td>
                        <td className="text-right text-nowrap">{tzs(row.paid_amount)}</td>
                        <td className="text-right text-nowrap font-weight-bold">{tzs(row.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PayMethodFields
                form={{ ...form, amount: "" }}
                onChange={update}
                idPrefix="dividend-batch"
                errors={{
                  pay_method: payAll.fieldError("pay_method"),
                  bank_account_id: (touched && bankMissing ? "Select the company bank account to pay from." : undefined) ?? payAll.fieldError("bank_account_id"),
                  reference: payAll.fieldError("reference"),
                }}
              />
            </>
          )}
        </div>
      )}
      {payAll.fieldError("idempotency_key") && <div className="field-error">{payAll.fieldError("idempotency_key")}</div>}
    </Modal>
  );
}
