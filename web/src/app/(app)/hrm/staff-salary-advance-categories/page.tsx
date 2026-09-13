"use client";

import { useState } from "react";

import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction } from "@/components/ui/notify";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface Category {
  id: number;
  name: string;
  amount_from: number;
  amount_to: number;
  fee: number;
}

const EMPTY = { cate_name: "", from_amount: "", to_amount: "", fee: "" };
type CategoryForm = typeof EMPTY;

function Fields({ form, setForm, fieldError, cls }: { form: CategoryForm; setForm: (form: CategoryForm) => void; fieldError: (field: string) => string | undefined; cls: string }) {
  return (
    <>
      <Field label="*Category name:" className={cls} error={fieldError("cate_name")}>
        <input className="form-control input-sm" placeholder="Loan Category product name" value={form.cate_name} onChange={(e) => setForm({ ...form, cate_name: e.target.value })} required />
      </Field>
      <Field label="*From Amount:" className={cls} error={fieldError("from_amount")}>
        <input type="number" className="form-control input-sm" placeholder="eg.0" value={form.from_amount} onChange={(e) => setForm({ ...form, from_amount: e.target.value })} required />
      </Field>
      <Field label="*To Amount:" className={cls} error={fieldError("to_amount")}>
        <input type="number" className="form-control input-sm" placeholder="eg.10000" value={form.to_amount} onChange={(e) => setForm({ ...form, to_amount: e.target.value })} required />
      </Field>
      <Field label="charger" className={cls} error={fieldError("fee")}>
        <input type="number" className="form-control" placeholder="Enter charger" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} required />
      </Field>
    </>
  );
}

export default function StaffSalaryAdvanceCategoryPage() {
  const { data: categories, isLoading } = useApi<Category[]>("hrm/staff-salary-advance-categories");
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<Category | null>(null);
  const [editForm, setEditForm] = useState(EMPTY);
  const create = useAction<CategoryForm>("post", "hrm/staff-salary-advance-categories");
  const update = useAction<CategoryForm & { id: number }>("put", (body) => `hrm/staff-salary-advance-categories/${body.id}`);
  const remove = useAction<{ id: number }>("delete", (body) => `hrm/staff-salary-advance-categories/${body.id}`);

  return (
    <>
      <PageHeader crumbs={["HRM", "Staff salary Advance Category"]} />
      <Card title="Staff salary Advance Category">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(form, { onSuccess: () => setForm(EMPTY) }); }} onReset={() => setForm(EMPTY)}>
          <div className="row"><Fields form={form} setForm={setForm} fieldError={create.fieldError} cls="col-lg-3 col-6" /></div>
          <div className="text-center mt-3">
            <button type="submit" className="btn btn-primary btn-sm mr-1" disabled={create.isPending}>Save</button>
            <button type="reset" className="btn btn-danger btn-sm">Cancel</button>
          </div>
        </form>
      </Card>

      <Card title="category list">
        <DataTable
          rows={categories}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "name", header: "Category name" },
            { key: "amount_from", header: "From Amount", render: (row) => money(row.amount_from) },
            { key: "amount_to", header: "To Amount", render: (row) => money(row.amount_to) },
            { key: "fee", header: "Chargers", render: (row) => money(row.fee) },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  <button type="button" className="btn btn-sm btn-icon btn-primary mr-1" title="Edit" onClick={() => { setEditing(row); setEditForm({ cate_name: row.name, from_amount: String(row.amount_from), to_amount: String(row.amount_to), fee: String(row.fee) }); }}><i className="icon-pencil" /></button>
                  <button type="button" className="btn btn-sm btn-icon btn-danger" onClick={async () => (await confirmAction("Are You Sure?")) && remove.mutate({ id: row.id })}><i className="icon-trash" /></button>
                </>
              ),
            },
          ]}
        />
      </Card>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Edit Category" submitLabel="Update" submitting={update.isPending} onSubmit={() => editing && update.mutate({ ...editForm, id: editing.id }, { onSuccess: () => setEditing(null) })}>
        <div className="row clearfix"><Fields form={editForm} setForm={setEditForm} fieldError={update.fieldError} cls="col-md-6 col-6" /></div>
      </Modal>
    </>
  );
}
