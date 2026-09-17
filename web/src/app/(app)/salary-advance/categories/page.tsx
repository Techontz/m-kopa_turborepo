"use client";

import { useState } from "react";

import type { SalaryAdvanceCategory } from "@/components/finance-b/types";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction } from "@/components/ui/notify";
import { money, percent } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface CategoryForm {
  perferal_name: string;
  interest_name: string;
  from_amount: string;
  to_amount: string;
  fee_charger: string;
}

const EMPTY: CategoryForm = { perferal_name: "", interest_name: "", from_amount: "", to_amount: "", fee_charger: "" };

function CategoryFields({ form, setForm, fieldError, edit }: { form: CategoryForm; setForm: (form: CategoryForm) => void; fieldError: (field: string) => string | undefined; edit?: boolean }) {
  const input = (field: keyof CategoryForm, label: string, placeholder: string, type = "number") => (
    <Field label={label} className="col-md-12" error={fieldError(field)}>
      <input type={type} className="form-control" placeholder={placeholder} value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} required />
    </Field>
  );

  return (
    <div className="row clearfix">
      {input("perferal_name", "Loan Product name:", "Enter Category", "text")}
      {input("interest_name", "Loan Interest(%):", "Enter Interest", "text")}
      {input("from_amount", edit ? "From Amount:" : "From Amount", edit ? "Enter Interest" : "Enter Amount", edit ? "text" : "number")}
      {input("to_amount", edit ? "To Amount:" : "To Amount", edit ? "Enter Interest" : "Enter Amount", edit ? "text" : "number")}
      {input("fee_charger", "charger Fee:", edit ? "Enter chargers" : "Enter charger Fee")}
    </div>
  );
}

export default function SalaryAdvanceCategoriesPage() {
  const { data: categories, isLoading } = useApi<SalaryAdvanceCategory[]>("salary-advance/categories");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CategoryForm>(EMPTY);
  const [editing, setEditing] = useState<SalaryAdvanceCategory | null>(null);
  const [editForm, setEditForm] = useState<CategoryForm>(EMPTY);

  const create = useAction<CategoryForm>("post", "salary-advance/categories");
  const update = useAction<CategoryForm & { id: number }>("put", (body) => `salary-advance/categories/${body.id}`);
  const remove = useAction<{ id: number }>("delete", (body) => `salary-advance/categories/${body.id}`);

  const openEdit = (category: SalaryAdvanceCategory) => {
    setEditing(category);
    setEditForm({
      perferal_name: category.name,
      interest_name: String(category.interest_rate),
      from_amount: String(category.amount_from),
      to_amount: String(category.amount_to),
      fee_charger: String(category.fee),
    });
  };

  return (
    <>
      <PageHeader crumbs={["Salary Advance", "Salary advance Category"]} />

      <Card title="Salary advance Category List" actions={
          <button type="button" className="btn btn-primary btn-sm d-inline-flex align-items-center" onClick={() => setCreating(true)}>
            <i className="icon-plus mr-2" /> Add Category
          </button>
        }>
        <DataTable
          rows={categories}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, value: (row) => row.id },
            { key: "name", header: "Category name" },
            { key: "interest_rate", header: "Interest", render: (row) => percent(row.interest_rate) },
            { key: "amount_from", header: "From Amount", render: (row) => money(row.amount_from) },
            { key: "amount_to", header: "To Amount", render: (row) => money(row.amount_to) },
            { key: "fee", header: "charger Fee", render: (row) => money(row.fee) },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  <button type="button" className="btn btn-sm btn-icon btn-info mr-1" title="Edit" onClick={() => openEdit(row)}><i className="icon-pencil" /></button>
                  <button type="button" className="btn btn-sm btn-icon btn-danger" title="Delete" onClick={async () => (await confirmAction()) && remove.mutate({ id: row.id })}><i className="icon-trash" /></button>
                </>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Pending Debit Category"
        submitLabel="Save"
        submitting={create.isPending}
        onSubmit={() => create.mutate(form, { onSuccess: () => { setForm(EMPTY); setCreating(false); } })}
      >
        <CategoryFields form={form} setForm={setForm} fieldError={create.fieldError} />
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit Pending Debit Category"
        submitLabel="Update"
        submitting={update.isPending}
        onSubmit={() => editing && update.mutate({ ...editForm, id: editing.id }, { onSuccess: () => setEditing(null) })}
      >
        <CategoryFields form={editForm} setForm={setEditForm} fieldError={update.fieldError} edit />
      </Modal>
    </>
  );
}
