"use client";

import { useState } from "react";

import { BranchStaffFields, FilterModal, HeaderButton, type Filters } from "@/components/hrm/common";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction } from "@/components/ui/notify";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface Allowance {
  id: number;
  branch: string | null;
  employee: string | null;
  amount: number;
  description: string | null;
  status: string;
  created_at: string;
}

const EMPTY = { blanch_id: "", empl_id: "", new_amount: "", remaks_allow: "" };

export default function StaffAllowancePage() {
  const [filters, setFilters] = useState<Filters>({});
  const [filtering, setFiltering] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const { data: allowances, isLoading } = useApi<Allowance[]>("hrm/allowances", { ...filters });
  const create = useAction<typeof EMPTY>("post", "hrm/allowances");
  const stop = useAction<{ id: number }>("post", (body) => `hrm/allowances/${body.id}/stop`);

  return (
    <>
      <PageHeader crumbs={["HRM", "Staff Allowance"]} />
      <Card title="Staff Allowance Form">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(form, { onSuccess: () => setForm(EMPTY) }); }} onReset={() => setForm(EMPTY)}>
          <div className="row">
            <BranchStaffFields className="col-lg-4 col-4" branchPlaceholder="Select branch" branchId={form.blanch_id} employeeId={form.empl_id} onChange={(value) => setForm({ ...form, ...value })} errors={create.fieldError} />
            <Field label="Amount" className="col-lg-4 col-4" error={create.fieldError("new_amount")}>
              <input type="number" className="form-control input-sm" placeholder="Enter Amount" value={form.new_amount} onChange={(e) => setForm({ ...form, new_amount: e.target.value })} required />
            </Field>
            <Field label="Description" className="col-md-12 col-12" error={create.fieldError("remaks_allow")}>
              <textarea className="form-control" rows={4} placeholder="Enter Description" value={form.remaks_allow} onChange={(e) => setForm({ ...form, remaks_allow: e.target.value })} />
            </Field>
          </div>
          <div className="text-center mt-3">
            <button type="submit" className="btn btn-primary btn-sm mr-1" disabled={create.isPending}>Save</button>
            <button type="reset" className="btn btn-danger btn-sm">Cancel</button>
          </div>
        </form>
      </Card>

      <Card title="Staff Allowance List" actions={<HeaderButton onClick={() => setFiltering(true)} />}>
        <DataTable
          rows={allowances}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "branch", header: "Branch" },
            { key: "employee", header: "Staff name" },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "description", header: "Description" },
            { key: "created_at", header: "Date" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              render: (row) => row.status === "active"
                ? <button type="button" className="btn btn-sm btn-danger" title="Stop allowance" onClick={async () => (await confirmAction()) && stop.mutate({ id: row.id })}><i className="icon-close" /></button>
                : <Badge tone="info">{row.status}</Badge>,
            },
          ]}
        />
      </Card>

      <FilterModal open={filtering} onClose={() => setFiltering(false)} onApply={setFilters} />
    </>
  );
}
