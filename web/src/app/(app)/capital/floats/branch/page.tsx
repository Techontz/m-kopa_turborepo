"use client";

import { useState } from "react";

import type { FloatTransfer } from "@/components/capital/DateFilterModal";
import { ApprovalActions, ApprovalStatus } from "@/components/finance/Approval";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { confirmAction } from "@/components/ui/notify";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

const EMPTY = { from_blanch_id: "", to_blanch_id: "", trans_amount: "" };

/** Live admin/float_branch_branch — pending branch → branch float requests. */
export default function BranchFloatPage() {
  const { data: transfers, isLoading } = useApi<FloatTransfer[]>("capital/floats/branch");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const create = useAction<typeof EMPTY>("post", "capital/floats/branch");
  const remove = useAction<{ id: number }>("delete", (body) => `capital/floats/branch/${body.id}`);

  return (
    <>
      <PageHeader crumbs={["Float", "Branch To Branch"]} />

      <Card title="Transaction List" actions={<button type="button" className="btn btn-sm btn-icon btn-primary" onClick={() => setOpen(true)}><i className="icon-plus" /></button>}>
        <DataTable
          rows={transfers}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/no.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "from_branch", header: "From Branch" },
            { key: "to_branch", header: "To Branch" },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "status", header: "Status", render: (row) => <ApprovalStatus row={row} /> },
            { key: "date", header: "Date" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  <ApprovalActions row={row} approvePath={`capital/floats/${row.id}/approve`} rejectPath={`capital/floats/${row.id}/reject`} description={`float ${row.from_branch ?? ""} → ${row.to_branch ?? ""}`} />
                  <button type="button" className="btn btn-danger btn-sm ml-1" title="Delete request" disabled={remove.isPending} onClick={async () => (await confirmAction()) && remove.mutate({ id: row.id })}><i className="icon-trash" /></button>
                </>
              ),
            },
          ]}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Transfer float" submitLabel="Transfer" submitting={create.isPending} onSubmit={() => create.mutate(form, { onSuccess: () => { setForm(EMPTY); setOpen(false); } })}>
        <div className="row clearfix">
          <Field label="From branch:" className="col-lg-6" error={create.fieldError("from_blanch_id")}>
            <SelectBox placeholder="Select Branch" optionsUrl="options/branches" value={form.from_blanch_id} onChange={(value) => setForm({ ...form, from_blanch_id: value ?? "" })} />
          </Field>
          <Field label="To branch:" required className="col-lg-6" error={create.fieldError("to_blanch_id")}>
            <SelectBox placeholder="Select Branch" optionsUrl="options/branches" value={form.to_blanch_id} onChange={(value) => setForm({ ...form, to_blanch_id: value ?? "" })} />
          </Field>
          <Field label="Amount:" required className="col-lg-12" error={create.fieldError("trans_amount")}>
            <input type="number" className="form-control" placeholder="Enter Amount" value={form.trans_amount} onChange={(e) => setForm({ ...form, trans_amount: e.target.value })} required />
          </Field>
        </div>
      </Modal>
    </>
  );
}
