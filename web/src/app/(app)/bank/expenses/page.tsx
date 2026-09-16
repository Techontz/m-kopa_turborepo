"use client";

import { useState } from "react";

import { HeaderButton, sum } from "@/components/finance/FilterModal";
import { BlockedApproveButton } from "@/components/finance/Approval";
import { ReversedStatus, ReverseButton } from "@/components/finance/Reversal";
import type { ExpenseRequest } from "@/components/finance/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { confirmAction } from "@/components/ui/notify";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface RequestForm {
  scope: "bank";
  ac_id: string;
  exp_id: string;
  amount: string;
  comment: string;
}

const EMPTY: RequestForm = { scope: "bank", ac_id: "", exp_id: "", amount: "", comment: "" };

export default function BankExpensesPage() {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<RequestForm>(EMPTY);
  const { data: rows, isLoading } = useApi<ExpenseRequest[]>("expenses/requests", { scope: "bank", status: "all" });
  const create = useAction<RequestForm>("post", "expenses/requests");
  const accept = useAction<{ id: number }>("post", (body) => `expenses/requests/${body.id}/accept`);
  const remove = useAction<{ id: number }>("delete", (body) => `expenses/requests/${body.id}`);

  return (
    <>
      <PageHeader crumbs={["Bank", "Request Expenses"]} />
      <Card title="Expenses List" actions={<HeaderButton icon="icon-plus" onClick={() => { setForm(EMPTY); setCreating(true); }} />}>
        <DataTable
          rows={rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/no.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "expense", header: "Expenses Name" },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "bank_account", header: "From Account" },
            { key: "comment", header: "Comment" },
            { key: "request_date", header: "Date" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) =>
                row.status === "reversed" ? (
                  <ReversedStatus row={row} />
                ) : row.status === "accepted" ? (
                  <>
                    <Badge tone="success">ACCEPTED</Badge>
                    <span className="ml-1"><ReverseButton row={row} path={`expenses/requests/${row.id}/reverse`} description={`${row.expense ?? "expense"} paid from ${row.bank_account ?? "bank"}`} /></span>
                  </>
                ) : (
                  <>
                    {row.can_approve && <button type="button" className="btn btn-sm btn-icon btn-success mr-1" title="Accept" disabled={accept.isPending} onClick={async () => (await confirmAction()) && accept.mutate({ id: row.id })}><i className="icon-like" /></button>}
                    {!row.can_approve && row.approve_blocked_reason && <BlockedApproveButton reason={row.approve_blocked_reason} label="Accept" />}
                    <button type="button" className="btn btn-sm btn-icon btn-danger" disabled={remove.isPending} onClick={async () => (await confirmAction()) && remove.mutate({ id: row.id })}><i className="icon-trash" /></button>
                  </>
                ),
            },
          ]}
          footer={
            <tr>
              <td>TOTAL <small className="text-muted">(excl. reversed)</small>:</td>
              <td />
              <td><b>{money(sum(rows, (row) => (row.status === "reversed" ? 0 : row.amount)))}</b></td>
              <td colSpan={4} />
            </tr>
          }
        />
      </Card>

      <Modal open={creating} onClose={() => setCreating(false)} title="Register Expenses" submitLabel="Save" submitting={create.isPending} onSubmit={() => create.mutate(form, { onSuccess: () => setCreating(false) })}>
        <div className="row clearfix">
          <Field label="Select Account:" className="col-lg-6" error={create.fieldError("ac_id")}>
            <SelectBox placeholder="Select Account" optionsUrl="bank/options/accounts" value={form.ac_id} onChange={(value) => setForm({ ...form, ac_id: value ?? "" })} />
          </Field>
          <Field label="*Expenses:" className="col-lg-6" error={create.fieldError("exp_id")}>
            <SelectBox placeholder="Select Expenses" optionsUrl="expenses/options/types" query={{ scope: "bank" }} value={form.exp_id} onChange={(value) => setForm({ ...form, exp_id: value ?? "" })} />
          </Field>
          <Field label="*Amount:" className="col-lg-12" error={create.fieldError("amount")}>
            <input type="number" className="form-control" placeholder="Enter Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </Field>
          <Field label="*Comment:" className="col-lg-12" error={create.fieldError("comment")}>
            <textarea className="form-control" rows={3} placeholder="Enter Comment" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} required />
          </Field>
        </div>
      </Modal>
    </>
  );
}
