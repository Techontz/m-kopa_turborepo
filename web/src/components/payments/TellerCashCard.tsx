"use client";

import { useState } from "react";

import { DEPOSIT_BADGE, type Payment, type TellerDeposit } from "@/components/payments/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { SelectBox } from "@/components/ui/SelectBox";
import { api } from "@/lib/api";
import { money, todayIso } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";
import { useQuery } from "@tanstack/react-query";

interface CashResponse {
  data: Payment[];
  teller_cash: number;
}

interface SlipForm {
  bank_account_id: string;
  slip_number: string;
  amount: string;
  deposit_date: string;
  payment_ids: number[];
}

const EMPTY: SlipForm = { bank_account_id: "", slip_number: "", amount: "", deposit_date: todayIso(), payment_ids: [] };

/**
 * Documents (cash flow): teller cash stays PENDING_VERIFICATION until the teller deposits it to the bank
 * and Finance verifies the slip. Shows the teller's receipts and deposit slips.
 */
export function TellerCashCard() {
  const { data: cash, isLoading } = useQuery({ queryKey: ["teller/cash"], queryFn: () => api.get<CashResponse>("teller/cash") });
  const { data: slips, isLoading: slipsLoading } = useApi<TellerDeposit[]>("teller/bank-deposits");
  const [form, setForm] = useState<SlipForm | null>(null);
  const submit = useAction<Omit<SlipForm, "amount"> & { amount: number }>("post", "teller/bank-deposits");

  const pending = (cash?.data ?? []).filter((payment) => payment.status === "pending_verification");
  const toggle = (id: number) => {
    if (!form) {
      return;
    }
    const ids = form.payment_ids.includes(id) ? form.payment_ids.filter((item) => item !== id) : [...form.payment_ids, id];
    const sum = pending.filter((payment) => ids.includes(payment.id)).reduce((total, payment) => total + payment.amount, 0);
    setForm({ ...form, payment_ids: ids, amount: String(sum) });
  };

  return (
    <>
      <Card
        title={<>Teller Cash (Pending Verification): <b>{money(cash?.teller_cash)}</b></>}
        actions={pending.length > 0 && (
          <button type="button" className="btn btn-primary" onClick={() => setForm({ ...EMPTY, payment_ids: pending.map((payment) => payment.id), amount: String(pending.reduce((sum, payment) => sum + payment.amount, 0)) })}>
            <i className="icon-plus" /> Bank Deposit
          </button>
        )}
      >
        <DataTable
          rows={cash?.data}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "receipt_number", header: "Receipt" },
            { key: "customer", header: "Customer Name" },
            { key: "branch", header: "Branch Name" },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "slip_number", header: "Deposit Slip" },
            { key: "paid_on", header: "Date" },
            { key: "status", header: "Status", render: (row) => <Badge tone={row.status_badge}>{row.status_label}</Badge> },
          ]}
        />
      </Card>

      <Card title="Bank Deposit Slips">
        <DataTable
          rows={slips}
          loading={slipsLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "slip_number", header: "Slip Number" },
            { key: "bank_account", header: "Bank" },
            { key: "branch", header: "Branch Name" },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "expected_amount", header: "Receipts", render: (row) => money(row.expected_amount) },
            { key: "deposit_date", header: "Date" },
            { key: "status", header: "Status", render: (row) => <Badge tone={DEPOSIT_BADGE[row.status]}>{row.status.toUpperCase()}</Badge> },
            { key: "rejection_reason", header: "Comment" },
          ]}
        />
      </Card>

      <Modal
        open={form !== null}
        onClose={() => setForm(null)}
        title="Bank Deposit"
        size="lg"
        submitLabel="Save"
        submitting={submit.isPending}
        onSubmit={() => form && submit.mutate({ ...form, amount: Number(form.amount) }, { onSuccess: () => setForm(null) })}
      >
        {form && (
          <div className="row">
            <Field label="Select Bank:" required className="col-md-6" error={submit.fieldError("bank_account_id")}>
              <SelectBox placeholder="Select Account" optionsUrl="teller/bank-accounts" value={form.bank_account_id} onChange={(value) => setForm({ ...form, bank_account_id: value ?? "" })} />
            </Field>
            <Field label="Slip Number:" required className="col-md-6" error={submit.fieldError("slip_number")}>
              <input className="form-control" placeholder="Enter slip number" value={form.slip_number} onChange={(e) => setForm({ ...form, slip_number: e.target.value })} required />
            </Field>
            <Field label="Amount:" required className="col-md-6" error={submit.fieldError("amount")}>
              <input type="number" className="form-control" placeholder="Enter Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            </Field>
            <Field label="Deposit Date:" required className="col-md-6" error={submit.fieldError("deposit_date")}>
              <input type="date" className="form-control" value={form.deposit_date} onChange={(e) => setForm({ ...form, deposit_date: e.target.value })} required />
            </Field>
            <div className="col-md-12">
              <span>Receipts:</span>
              {submit.fieldError("payment_ids") && <div className="field-error">{submit.fieldError("payment_ids")}</div>}
              <table className="table table-custom mb-0">
                <thead className="thead-info"><tr><th /><th>Receipt</th><th>Customer</th><th>Amount</th><th>Date</th></tr></thead>
                <tbody>
                  {pending.map((payment) => (
                    <tr key={payment.id}>
                      <td><input type="checkbox" checked={form.payment_ids.includes(payment.id)} onChange={() => toggle(payment.id)} /></td>
                      <td>{payment.receipt_number}</td>
                      <td>{payment.customer}</td>
                      <td>{money(payment.amount)}</td>
                      <td>{payment.paid_on}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
