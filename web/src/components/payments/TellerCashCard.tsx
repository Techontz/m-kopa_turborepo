"use client";

import { useState } from "react";

import { receiptsTotal } from "@/components/payments/slip";
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
  /** Set when correcting a MISMATCH slip. */
  id?: number;
  bank_account_id: string;
  slip_number: string;
  amount: string;
  deposit_date: string;
  payment_ids: number[];
}

const EMPTY: SlipForm = { bank_account_id: "", slip_number: "", amount: "", deposit_date: todayIso(), payment_ids: [] };

/**
 * Documents (cash flow): teller cash stays PENDING_VERIFICATION until the teller deposits it to the bank
 * and Finance verifies the slip.
 * Teller → Bank Deposit: the cash still to bank, the Bank Deposit form and the deposit slips.
 */
export function TellerCashCard() {
  const { data: cash, isLoading } = useQuery({ queryKey: ["teller/cash"], queryFn: () => api.get<CashResponse>("teller/cash") });
  const { data: slips, isLoading: slipsLoading } = useApi<TellerDeposit[]>("teller/bank-deposits");
  const [form, setForm] = useState<SlipForm | null>(null);
  const [editing, setEditing] = useState<TellerDeposit | null>(null);
  const submit = useAction<Omit<SlipForm, "amount"> & { amount: number }>("post", "teller/bank-deposits");
  const update = useAction<Omit<SlipForm, "amount"> & { amount: number }>("put", (body) => `teller/bank-deposits/${body.id}`);
  const action = form?.id ? update : submit;

  const pendingOnly = (cash?.data ?? []).filter((payment) => payment.status === "pending_verification");
  /** Receipts the form can put on the slip: those still to bank, plus (when correcting) those already on this slip. */
  const pending = editing ? [...editing.payments, ...pendingOnly.filter((payment) => !editing.payments.some((onSlip) => onSlip.id === payment.id))] : pendingOnly;
  const toggle = (id: number) => {
    if (!form) {
      return;
    }
    const ids = form.payment_ids.includes(id) ? form.payment_ids.filter((item) => item !== id) : [...form.payment_ids, id];
    setForm({ ...form, payment_ids: ids, amount: String(receiptsTotal(pending, ids)) });
  };

  const openDeposit = () => {
    submit.setErrors({});
    setEditing(null);
    setForm({ ...EMPTY, payment_ids: pendingOnly.map((payment) => payment.id), amount: String(receiptsTotal(pendingOnly, pendingOnly.map((payment) => payment.id))) });
  };
  const openEdit = (slip: TellerDeposit) => {
    update.setErrors({});
    setEditing(slip);
    setForm({
      id: slip.id,
      bank_account_id: String(slip.bank_account_id),
      slip_number: slip.slip_number,
      amount: String(slip.amount),
      deposit_date: slip.deposit_date,
      payment_ids: slip.payments.map((payment) => payment.id),
    });
  };
  const close = () => {
    setForm(null);
    setEditing(null);
  };

  return (
    <>
      <Card
        title={<>To Bank: <b>{money(receiptsTotal(pendingOnly, pendingOnly.map((payment) => payment.id)))}</b> <small className="ml-2">{pendingOnly.length} receipt{pendingOnly.length === 1 ? "" : "s"} not yet banked</small></>}
        actions={pendingOnly.length > 0 && (
          <button type="button" className="btn btn-primary" onClick={openDeposit}>
            <i className="icon-plus" /> Bank Deposit
          </button>
        )}
      >
        <DataTable
          rows={pendingOnly}
          loading={isLoading}
          rowKey={(row) => row.id}
          emptyMessage="Everything collected has been banked"
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "receipt_number", header: "Receipt" },
            { key: "customer", header: "Customer Name" },
            { key: "branch", header: "Branch Name" },
            { key: "channel", header: "Method", render: (row) => (row.provider ? `${row.channel} · ${row.provider}` : row.channel) },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "paid_on", header: "Date" },
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
            {
              key: "statement_amount",
              header: "Bank Statement",
              render: (row) => (row.statement_amount === null ? "—" : <span className={row.status === "mismatch" ? "text-danger" : ""}>{money(row.statement_amount)}{row.statement_reference ? ` (${row.statement_reference})` : ""}</span>),
            },
            { key: "rejection_reason", header: "Comment" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              render: (row) =>
                row.can_edit && (
                  <button type="button" className="btn btn-sm btn-icon btn-primary" title="Edit mismatched slip" onClick={() => openEdit(row)}>
                    <i className="icon-pencil" />
                  </button>
                ),
            },
          ]}
        />
      </Card>

      <Modal
        open={form !== null}
        onClose={close}
        title={editing ? `Edit Mismatched Slip ${editing.slip_number}` : "Bank Deposit"}
        size="lg"
        submitLabel={editing ? "Update & Send to Finance" : "Save"}
        submitting={action.isPending}
        onSubmit={() => form && action.mutate({ ...form, amount: Number(form.amount) }, { onSuccess: close })}
      >
        {form && (
          <div className="row">
            {editing && (
              <div className="col-md-12">
                <div className="alert alert-danger">
                  Finance found <b>TZS {money(editing.statement_amount)}</b> on the bank statement{editing.statement_reference ? ` (ref ${editing.statement_reference})` : ""} for this slip of <b>TZS {money(editing.amount)}</b>
                  {editing.verifier ? `, checked by ${editing.verifier}` : ""}. Correct the bank, slip number, date or the receipts actually banked. Receipts you untick go back to To Bank; the slip returns to Finance for verification.
                </div>
              </div>
            )}
            <Field label="Select Bank:" required className="col-md-6" error={action.fieldError("bank_account_id")}>
              <SelectBox placeholder="Select Account" optionsUrl="teller/bank-accounts" value={form.bank_account_id} onChange={(value) => setForm({ ...form, bank_account_id: value ?? "" })} />
            </Field>
            <Field label="Slip Number:" required className="col-md-6" error={action.fieldError("slip_number")}>
              <input className="form-control" placeholder="Enter slip number" value={form.slip_number} onChange={(e) => setForm({ ...form, slip_number: e.target.value })} required />
            </Field>
            <Field label="Amount (as on the slip):" required className="col-md-6" error={action.fieldError("amount")}>
              <input type="number" step="0.01" className="form-control" placeholder="Enter Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
              <small className={Math.abs(Number(form.amount) - receiptsTotal(pending, form.payment_ids)) > 0.005 ? "text-danger" : "text-muted"}>
                Selected receipts total: <b>TZS {money(receiptsTotal(pending, form.payment_ids))}</b>
                {Math.abs(Number(form.amount) - receiptsTotal(pending, form.payment_ids)) > 0.005 ? " — the slip amount must equal this total" : ""}
              </small>
            </Field>
            <Field label="Deposit Date:" required className="col-md-6" error={action.fieldError("deposit_date")}>
              <input type="date" className="form-control" value={form.deposit_date} onChange={(e) => setForm({ ...form, deposit_date: e.target.value })} required />
            </Field>
            <div className="col-md-12">
              <span>Receipts:</span>
              {action.fieldError("payment_ids") && <div className="field-error">{action.fieldError("payment_ids")}</div>}
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
