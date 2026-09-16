"use client";

import { useState } from "react";

import type { FloatTransfer } from "@/components/capital/DateFilterModal";
import { ApprovalActions, ApprovalStatus, isPending } from "@/components/finance/Approval";
import { ReverseButton } from "@/components/finance/Reversal";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface Balances {
  branches: { id: number; name: string; principal: number; interest: number }[];
}

const EMPTY = { blanch_id: "", from_acc: "", to_acc: "", amount: "" };

/**
 * Live admin/float_branch_ac_ac — PRINCIPAL ↔ INTEREST within a branch (never from the RESERVE A/C, rule 3). Rule 6: the
 * movement is requested as PENDING and posted when another authorised user approves it.
 */
export default function AccountFloatPage() {
  const [form, setForm] = useState(EMPTY);
  const { data: balances } = useApi<Balances>("capital/floats/balances");
  const { data: transfers, isLoading } = useApi<FloatTransfer[]>("capital/floats/accounts");
  const create = useAction<typeof EMPTY>("post", "capital/floats/accounts");
  const branch = balances?.branches.find((item) => String(item.id) === form.blanch_id);
  const set = (field: keyof typeof EMPTY) => (event: { target: { value: string } }) => setForm({ ...form, [field]: event.target.value });

  return (
    <>
      <PageHeader crumbs={["Transfer Float From Account - Account"]} />
      <Card title="Transfer Float From Ac-Ac">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(form, { onSuccess: () => setForm(EMPTY) }); }}>
          <div className="row">
            <Field label="To Branch Name:" required className="col-md-3" error={create.fieldError("blanch_id")}>
              <SelectBox placeholder="---Select Branch---" optionsUrl="options/branches" value={form.blanch_id} onChange={(value) => setForm({ ...form, blanch_id: value ?? "" })} />
            </Field>
            <Field label="From Account:" required className="col-md-3" error={create.fieldError("from_acc")}>
              <select className="form-control" value={form.from_acc} onChange={set("from_acc")} required>
                <option value="">select</option>
                <option value="PR">PRINCIPAL</option>
                <option value="INT">INTEREST</option>
              </select>
            </Field>
            <Field label="To Account:" required className="col-md-3" error={create.fieldError("to_acc")}>
              <select className="form-control" value={form.to_acc} onChange={set("to_acc")} required>
                <option value="">select</option>
                <option value="PR">PRINCIPAL</option>
                <option value="INT">INTEREST</option>
              </select>
            </Field>
            <Field label="Amount:" required className="col-md-3" error={create.fieldError("amount")}>
              <input type="number" className="form-control" value={form.amount} onChange={set("amount")} required />
            </Field>
          </div>
          {branch && (
            <div className="text-muted text-center">
              PRINCIPAL A/C: <b>{money(branch.principal)}</b> &nbsp; INTEREST A/C: <b>{money(branch.interest)}</b>
            </div>
          )}
          <div className="text-center m-t-20">
            <button type="submit" className="btn btn-primary" disabled={create.isPending}><i className="icon-pencil" />Request Transfer</button>
          </div>
        </form>
      </Card>

      <Card title="Today Transaction">
        <DataTable
          rows={transfers}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/no.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "from_branch", header: "Branch" },
            { key: "from_account", header: "From Account" },
            { key: "to_account", header: "To Account" },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "date", header: "Date" },
            { key: "status", header: "Status", render: (row) => <ApprovalStatus row={row} /> },
            {
              key: "action",
              header: "Action",
              sortable: false,
              render: (row) =>
                isPending(row) ? (
                  <ApprovalActions row={row} approvePath={`capital/floats/${row.id}/approve`} rejectPath={`capital/floats/${row.id}/reject`} description={`${row.from_account ?? ""} → ${row.to_account ?? ""} (${row.from_branch ?? ""})`} />
                ) : (
                  row.status === "approved" && <ReverseButton row={row} path={`capital/floats/${row.id}/reverse`} description={`${row.from_account ?? ""} → ${row.to_account ?? ""} (${row.from_branch ?? ""})`} />
                ),
            },
          ]}
        />
      </Card>
    </>
  );
}
