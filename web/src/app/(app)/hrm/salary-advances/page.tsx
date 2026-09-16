"use client";

import { useState } from "react";

import { BranchStaffFields, FilterModal, HeaderButton, sum, type Filters } from "@/components/hrm/common";
import { StaffCreditActions, StaffCreditStatus, StaffCreditTrail } from "@/components/hrm/StaffCreditActions";
import type { StaffAdvance } from "@/components/hrm/types";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface Lists {
  pending: StaffAdvance[];
  approved: StaffAdvance[];
  disbursed: StaffAdvance[];
  rejected: StaffAdvance[];
}

interface Category {
  id: number;
  name: string;
  amount_from: number;
  amount_to: number;
}

const EMPTY = { blanch_id: "", empl_id: "", fee: "", advance_amount: "" };

export default function StaffSalaryAdvancePage() {
  const { can } = useAuth();
  const [filters, setFilters] = useState<Filters>({});
  const [modal, setModal] = useState<"request" | "approved" | "filter" | null>(null);
  const [form, setForm] = useState(EMPTY);
  const { data, isLoading } = useApi<Lists>("hrm/salary-advances", { ...filters });
  const { data: categories = [] } = useApi<Category[]>("hrm/staff-salary-advance-categories");

  const create = useAction<typeof EMPTY>("post", "hrm/salary-advances");

  const waiting = [...(data?.pending ?? []), ...(data?.approved ?? [])];

  return (
    <>
      <PageHeader crumbs={["HRM", "Salary Advance"]} />
      <Card
        title="Salary Advance"
        actions={
          <>
            {can("hrm.manage") && <HeaderButton icon="icon-pencil" title="Request" onClick={() => setModal("request")} />}
            <HeaderButton icon="icon-list" title="Approved List" onClick={() => setModal("approved")} />
            <HeaderButton title="filter" onClick={() => setModal("filter")} />
          </>
        }
      >
        <DataTable
          rows={waiting}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "branch", header: "Branch" },
            { key: "employee", header: "Staff name" },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "created_at", header: "Date" },
            { key: "status", header: "status", value: (row) => row.status_label, render: (row) => <StaffCreditStatus row={row} /> },
            { key: "trail", header: "Stages", sortable: false, render: (row) => <StaffCreditTrail row={row} /> },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => <StaffCreditActions row={row} resource="salary-advances" />,
            },
          ]}
          footer={<tr><td>TOTAL</td><td /><td /><td>{money(sum(waiting, (row) => row.amount))}</td><td /><td /><td /><td /></tr>}
        />
      </Card>

      <Modal open={modal === "request"} onClose={() => setModal(null)} title="Request Salary Advance" size="lg" submitLabel="Request" submitting={create.isPending} onSubmit={() => create.mutate(form, { onSuccess: () => { setModal(null); setForm(EMPTY); } })}>
        <div className="row clearfix">
          <BranchStaffFields branchId={form.blanch_id} employeeId={form.empl_id} onChange={(value) => setForm({ ...form, ...value })} errors={create.fieldError} />
          <Field label="Category:" className="col-lg-6 col-6" error={create.fieldError("fee")}>
            <select className="form-control" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} required>
              <option value="">Select category</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}/ {category.amount_from} - {category.amount_to}</option>)}
            </select>
          </Field>
          <Field label="Amount:" className="col-lg-6 col-6" error={create.fieldError("advance_amount")}>
            <input type="number" className="form-control" placeholder="Amount" value={form.advance_amount} onChange={(e) => setForm({ ...form, advance_amount: e.target.value })} required />
          </Field>
        </div>
      </Modal>

      <Modal open={modal === "approved"} onClose={() => setModal(null)} title="Approved Salary Advance" size="xl">
        <DataTable
          rows={data?.disbursed}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "branch", header: "Branch" },
            { key: "employee", header: "Staff name" },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "created_at", header: "Date" },
            { key: "status", header: "status", value: (row) => row.status_label, render: (row) => <StaffCreditStatus row={row} /> },
            { key: "trail", header: "Stages", sortable: false, render: (row) => <StaffCreditTrail row={row} /> },
            { key: "fee", header: "Fee", render: (row) => money(row.fee) },
            { key: "outstanding_amount", header: "Remain to recover", render: (row) => money(row.outstanding_amount) },
            { key: "source_account", header: "Paid from", render: (row) => (row.source_account === "company_cash" ? "COMPANY ACCOUNT" : "STAFF FUND A/C") },
          ]}
        />
        <h6 className="m-t-20">Rejected</h6>
        <DataTable
          rows={data?.rejected}
          rowKey={(row) => row.id}
          columns={[
            { key: "employee", header: "Staff name" },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "trail", header: "Stages", sortable: false, render: (row) => <StaffCreditTrail row={row} /> },
            { key: "created_at", header: "Date" },
          ]}
        />
      </Modal>

      <FilterModal open={modal === "filter"} onClose={() => setModal(null)} onApply={setFilters} />
    </>
  );
}
