"use client";

import { useState } from "react";

import { BranchStaffFields, FilterModal, HeaderButton, type Filters } from "@/components/hrm/common";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface Deduction {
  id: number;
  branch: string | null;
  employee: string | null;
  amount: number;
  instalments: number;
  instalment_amount: number;
  paid_amount: number;
  description: string | null;
  status: string;
  created_at: string;
}

const EMPTY = { blanch_id: "", empl_id: "", amount: "", instalment: "", description: "" };

export default function StaffDeductionPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [filtering, setFiltering] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const { data: deductions, isLoading } = useApi<Deduction[]>("hrm/deductions", { ...filters });
  const create = useAction<typeof EMPTY>("post", "hrm/deductions");

  return (
    <>
      <PageHeader crumbs={["HRM", "Staff Deduction"]} />
      <Card title="Staff Deduction Form">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(form, { onSuccess: () => setForm(EMPTY) }); }} onReset={() => setForm(EMPTY)}>
          <div className="row">
            <BranchStaffFields className="col-lg-4 col-4" branchPlaceholder="Select branch" branchId={form.blanch_id} employeeId={form.empl_id} onChange={(value) => setForm({ ...form, ...value })} errors={create.fieldError} />
            <Field label="Amount" className="col-lg-2 col-6" error={create.fieldError("amount")}>
              <input type="number" className="form-control input-sm" placeholder="Enter Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            </Field>
            <Field label="Instalment" className="col-lg-2 col-6" error={create.fieldError("instalment")}>
              <input type="number" className="form-control input-sm" placeholder="instalment" value={form.instalment} onChange={(e) => setForm({ ...form, instalment: e.target.value })} required />
            </Field>
            <Field label="Description" className="col-md-12 col-12" error={create.fieldError("description")}>
              <textarea className="form-control" rows={4} placeholder="Enter Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
          </div>
          <div className="text-center mt-3">
            <button type="submit" className="btn btn-primary btn-sm mr-1" disabled={create.isPending}>Save</button>
            <button type="reset" className="btn btn-danger btn-sm">Cancel</button>
          </div>
        </form>
      </Card>

      <Card title="Staff Deduction List" actions={<HeaderButton onClick={() => setFiltering(true)} />}>
        <DataTable
          rows={deductions}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "branch", header: "Branch" },
            { key: "employee", header: "Staff name" },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "instalments", header: "Instalment" },
            { key: "instalment_amount", header: "Instalment Amount", render: (row) => money(row.instalment_amount) },
            { key: "description", header: "Description" },
            { key: "status", header: "status", render: (row) => <Badge tone={row.status === "active" ? "success" : "info"}>{row.status}</Badge> },
            { key: "created_at", header: "Date" },
            { key: "action", header: "Action", sortable: false, render: () => null },
          ]}
        />
      </Card>

      <FilterModal open={filtering} onClose={() => setFiltering(false)} onApply={setFilters} />
    </>
  );
}
