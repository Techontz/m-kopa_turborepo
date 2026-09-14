"use client";

import { useState } from "react";

import { DURATIONS } from "@/components/hrm/common";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction } from "@/components/ui/notify";
import { money, percent } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface Category {
  id: number;
  name: string;
  amount_from: number;
  amount_to: number;
  interest_rate: number;
  duration: string;
  repayment_from: number;
  repayment_to: number;
  fee: number;
}

interface CategoryForm {
  category_name: string;
  from_amount: string;
  to_amount: string;
  interest: string;
  duration: string;
  from_repayment: string;
  to_repayment: string;
  fee: string;
}

const EMPTY: CategoryForm = { category_name: "", from_amount: "", to_amount: "", interest: "", duration: "", from_repayment: "", to_repayment: "", fee: "" };

function Fields({ form, setForm, fieldError, compact }: { form: CategoryForm; setForm: (form: CategoryForm) => void; fieldError: (field: string) => string | undefined; compact?: boolean }) {
  const cls = compact ? "col-md-4 col-6" : "col-lg-3 col-6";
  return (
    <>
      <Field label="*Loan Product name:" className={cls} error={fieldError("category_name")}>
        <input className="form-control input-sm" placeholder="Loan Category product name" value={form.category_name} onChange={(e) => setForm({ ...form, category_name: e.target.value })} required />
      </Field>
      <Field label="*From:" className={cls} error={fieldError("from_amount")}>
        <input type="number" className="form-control input-sm" placeholder="eg.1000" value={form.from_amount} onChange={(e) => setForm({ ...form, from_amount: e.target.value })} required />
      </Field>
      <Field label="*To:" className={cls} error={fieldError("to_amount")}>
        <input type="number" className="form-control input-sm" placeholder="eg.10000" value={form.to_amount} onChange={(e) => setForm({ ...form, to_amount: e.target.value })} required />
      </Field>
      <Field label="*Loan Interest(%)" className={cls} error={fieldError("interest")}>
        <input className="form-control input-sm" placeholder="Loan Interest(%)" value={form.interest} onChange={(e) => setForm({ ...form, interest: e.target.value })} required />
      </Field>
      <Field label="*Select Loan Duration" className={cls} error={fieldError("duration")}>
        <select className="form-control" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} required>
          <option value="">---Select Loan Duration---</option>
          {DURATIONS.map((duration) => <option key={duration.value} value={duration.value}>{duration.label}</option>)}
        </select>
      </Field>
      <Field label="*Repayment Level" className={cls} error={fieldError("from_repayment")}>
        <input type="number" className="form-control" placeholder="From" value={form.from_repayment} onChange={(e) => setForm({ ...form, from_repayment: e.target.value })} required />
      </Field>
      <Field label="." className={cls} error={fieldError("to_repayment")}>
        <input type="number" className="form-control" placeholder="To" value={form.to_repayment} onChange={(e) => setForm({ ...form, to_repayment: e.target.value })} required />
      </Field>
      <Field label="." className={cls} error={fieldError("fee")}>
        <input type="number" className="form-control" placeholder="Enter charger" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} required />
      </Field>
    </>
  );
}

export default function StaffLoanCategoryPage() {
  const { data: categories, isLoading } = useApi<Category[]>("hrm/staff-loan-categories");
  const [form, setForm] = useState<CategoryForm>(EMPTY);
  const [editing, setEditing] = useState<Category | null>(null);
  const [editForm, setEditForm] = useState<CategoryForm>(EMPTY);
  const create = useAction<CategoryForm>("post", "hrm/staff-loan-categories");
  const update = useAction<CategoryForm & { id: number }>("put", (body) => `hrm/staff-loan-categories/${body.id}`);
  const remove = useAction<{ id: number }>("delete", (body) => `hrm/staff-loan-categories/${body.id}`);

  return (
    <>
      <PageHeader crumbs={["HRM", "Staff Loan Category"]} />
      <Card title="Staff Loan Category">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(form, { onSuccess: () => setForm(EMPTY) }); }} onReset={() => setForm(EMPTY)}>
          <div className="row"><Fields form={form} setForm={setForm} fieldError={create.fieldError} /></div>
          <div className="text-center mt-3">
            <button type="submit" className="btn btn-primary btn-sm mr-1" disabled={create.isPending}>Save</button>
            <button type="reset" className="btn btn-danger btn-sm">Cancel</button>
          </div>
        </form>
      </Card>

      <Card title="Loan Category">
        <DataTable
          rows={categories}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "name", header: "Loan Category Name" },
            { key: "level", header: "Loan level", render: (row) => `${money(row.amount_from)} - ${money(row.amount_to)}` },
            { key: "interest_rate", header: "Loan Interest", render: (row) => percent(row.interest_rate) },
            { key: "duration", header: "Duration", className: "text-capitalize" },
            { key: "repayment", header: "Repayment Level", render: (row) => `${row.repayment_from} - ${row.repayment_to}` },
            { key: "fee", header: "Charger", render: (row) => money(row.fee) },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  <button type="button" className="btn btn-sm btn-icon btn-primary mr-1" title="Edit" onClick={() => { setEditing(row); setEditForm({ category_name: row.name, from_amount: String(row.amount_from), to_amount: String(row.amount_to), interest: String(row.interest_rate), duration: row.duration, from_repayment: String(row.repayment_from), to_repayment: String(row.repayment_to), fee: String(row.fee) }); }}><i className="icon-pencil" /></button>
                  <button type="button" className="btn btn-sm btn-icon btn-danger" onClick={async () => (await confirmAction("Are You Sure?")) && remove.mutate({ id: row.id })}><i className="icon-trash" /></button>
                </>
              ),
            },
          ]}
        />
      </Card>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Edit Staff Loan Category" size="lg" submitLabel="Update" submitting={update.isPending} onSubmit={() => editing && update.mutate({ ...editForm, id: editing.id }, { onSuccess: () => setEditing(null) })}>
        <div className="row clearfix"><Fields form={editForm} setForm={setEditForm} fieldError={update.fieldError} compact /></div>
      </Modal>
    </>
  );
}
