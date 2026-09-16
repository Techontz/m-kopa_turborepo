"use client";

import Link from "next/link";
import { useState } from "react";

import { BranchStaffFields, DURATIONS, FilterModal, HeaderButton, sum, type Filters } from "@/components/hrm/common";
import { StaffCreditActions, StaffCreditStatus, StaffCreditTrail } from "@/components/hrm/StaffCreditActions";
import type { StaffLoan } from "@/components/hrm/types";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface Lists {
  pending: StaffLoan[];
  approved: StaffLoan[];
  disbursed: StaffLoan[];
  rejected: StaffLoan[];
}

interface Category {
  id: number;
  name: string;
  duration: string;
}

const EMPTY = { blanch_id: "", empl_id: "", category_id: "", loan_amount: "", day: "", session: "", reason: "" };

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const loanColumns: Column<StaffLoan>[] = [
  { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
  { key: "branch", header: "Branch" },
  { key: "employee", header: "Staff name" },
  { key: "amount_applied", header: "How loan", render: (row) => money(row.amount_applied) },
  { key: "amount_approved", header: "Loan Approved", render: (row) => money(row.amount_approved) },
  { key: "sessions", header: "No.Repayment", render: (row) => `${capitalize(row.duration)} / ${row.sessions}` },
  { key: "total_payable", header: "Loan + interest", render: (row) => money(row.total_payable) },
];

export default function StaffLoanPage() {
  const { can } = useAuth();
  const [filters, setFilters] = useState<Filters>({});
  const [modal, setModal] = useState<"apply" | "approved" | "filter" | null>(null);
  const [form, setForm] = useState(EMPTY);
  const { data, isLoading } = useApi<Lists>("hrm/staff-loans", { ...filters });
  const { data: categories = [] } = useApi<Category[]>("hrm/staff-loan-categories");

  const create = useAction<typeof EMPTY>("post", "hrm/staff-loans");
  const waiting = [...(data?.pending ?? []), ...(data?.approved ?? [])];
  const category = categories.find((item) => String(item.id) === form.category_id);

  return (
    <>
      <PageHeader crumbs={["HRM", "Staff Loan"]} />
      <Card
        title="Staff Loan"
        actions={
          <>
            <HeaderButton title="filter loan" onClick={() => setModal("filter")} />
            <HeaderButton icon="icon-list" title="Approved List" onClick={() => setModal("approved")} />
            <Link href="/hrm/staff-loans/active" className="btn btn-warning btn-sm ml-1" title="Active loan"><i className="icon-arrow-right" /></Link>
            {can("hrm.manage") && <HeaderButton icon="icon-plus" title="Apply loan" onClick={() => setModal("apply")} />}
          </>
        }
      >
        <DataTable
          rows={waiting}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            ...loanColumns,
            { key: "status", header: "Status", value: (row) => row.status_label, render: (row) => <StaffCreditStatus row={row} /> },
            { key: "trail", header: "Stages", sortable: false, render: (row) => <StaffCreditTrail row={row} /> },
            { key: "created_at", header: "Date" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => <StaffCreditActions row={row} resource="staff-loans" />,
            },
          ]}
          footer={<tr><td>TOTAL</td><td /><td /><td>{money(sum(waiting, (row) => row.amount_applied))}</td><td /><td /><td /><td /><td /><td /><td /></tr>}
        />
      </Card>

      <Modal open={modal === "apply"} onClose={() => setModal(null)} title="Apply Staff Loan" size="lg" submitLabel="Submit" submitting={create.isPending} onSubmit={() => create.mutate(form, { onSuccess: () => { setModal(null); setForm(EMPTY); } })}>
        <div className="row clearfix">
          <BranchStaffFields branchId={form.blanch_id} employeeId={form.empl_id} onChange={(value) => setForm({ ...form, ...value })} errors={create.fieldError} />
          <Field label="Loan Category:" className="col-lg-6 col-6" error={create.fieldError("category_id")}>
            <select className="form-control" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value, day: "" })} required>
              <option value="">Select Category</option>
              {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="Loan Amount:" className="col-lg-6 col-6" error={create.fieldError("loan_amount")}>
            <input type="number" className="form-control" placeholder="Enter Loan Amount" value={form.loan_amount} onChange={(e) => setForm({ ...form, loan_amount: e.target.value })} required />
          </Field>
          <Field label="Loan Duration:" className="col-lg-6 col-6" error={create.fieldError("day")}>
            <select className="form-control" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} required>
              <option value="">Select Loan Duration</option>
              {DURATIONS.filter((duration) => !category || duration.value === category.duration).map((duration) => <option key={duration.value} value={duration.value}>{duration.label}</option>)}
            </select>
          </Field>
          <Field label="Number of Repayments:" className="col-lg-6 col-6" error={create.fieldError("session")}>
            <input type="number" className="form-control" placeholder="Enter Number of Repayments" value={form.session} onChange={(e) => setForm({ ...form, session: e.target.value })} required />
          </Field>
          <Field label="Reason:" className="col-lg-12 col-12" error={create.fieldError("reason")}>
            <textarea className="form-control" rows={3} placeholder="Enter Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
          </Field>
        </div>
      </Modal>

      <Modal open={modal === "approved"} onClose={() => setModal(null)} title="Approved Staff Loan" size="xl">
        <DataTable
          rows={data?.disbursed}
          rowKey={(row) => row.id}
          columns={[
            ...loanColumns,
            { key: "status", header: "Status", value: (row) => row.status_label, render: (row) => <StaffCreditStatus row={row} /> },
            { key: "trail", header: "Stages", sortable: false, render: (row) => <StaffCreditTrail row={row} /> },
            { key: "fee", header: "charger", render: (row) => money(row.fee) },
            { key: "created_at", header: "Date" },
          ]}
        />
        <h6 className="m-t-20">Rejected</h6>
        <DataTable
          rows={data?.rejected}
          rowKey={(row) => row.id}
          columns={[
            ...loanColumns,
            { key: "trail", header: "Stages", sortable: false, render: (row) => <StaffCreditTrail row={row} /> },
            { key: "created_at", header: "Date" },
          ]}
        />
      </Modal>

      <FilterModal open={modal === "filter"} onClose={() => setModal(null)} onApply={setFilters} />
    </>
  );
}
