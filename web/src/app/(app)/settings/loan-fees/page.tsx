"use client";

import { useState } from "react";

import type { LoanCategory } from "@/components/settings/LoanCategoryFields";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { money, percent } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface FeeForm {
  loan_name: string;
  loan_price: string;
  loan_perday: string;
  interest_formular: string;
  fee_category_type: string;
  fee_value: string;
}

const MODE_LABEL: Record<string, string> = { "LOAN PRODUCT": "LOAN FEE BY LOAN PRODUCT", GENERAL: "LOAN FEE BY GENERAL" };

function FeeModal({ category, onClose }: { category: LoanCategory; onClose: () => void }) {
  const [form, setForm] = useState<FeeForm>({
    loan_name: category.name,
    loan_price: String(category.amount_from),
    loan_perday: String(category.amount_to),
    interest_formular: String(category.interest_rate),
    fee_category_type: category.fee_type === "percentage" ? "PERCENTAGE" : "MONEY",
    fee_value: String(category.fee_value),
  });
  const update = useAction<FeeForm>("put", `settings/loan-fees/${category.id}`);
  const set = (field: keyof FeeForm) => (event: { target: { value: string } }) => setForm({ ...form, [field]: event.target.value });

  return (
    <Modal open onClose={onClose} title="Edit Loan Fee Category" size="lg" submitLabel="Update" submitting={update.isPending} onSubmit={() => update.mutate(form, { onSuccess: onClose })}>
      <div className="row clearfix">
        <Field label="Loan Category Name:" required className="col-lg-3" error={update.fieldError("loan_name")}>
          <input className="form-control" value={form.loan_name} onChange={set("loan_name")} required />
        </Field>
        <Field label="From:" required className="col-lg-3" error={update.fieldError("loan_price")}>
          <input type="number" className="form-control" value={form.loan_price} onChange={set("loan_price")} required />
        </Field>
        <Field label="To:" required className="col-lg-3" error={update.fieldError("loan_perday")}>
          <input className="form-control" value={form.loan_perday} onChange={set("loan_perday")} required />
        </Field>
        <Field label="Loan Interest(%):" required className="col-lg-3" error={update.fieldError("interest_formular")}>
          <input type="number" step="any" className="form-control" value={form.interest_formular} onChange={set("interest_formular")} required />
        </Field>
        <Field label="Loan Fee Type:" required className="col-lg-6" error={update.fieldError("fee_category_type")}>
          <select className="form-control" value={form.fee_category_type} onChange={set("fee_category_type")}>
            <option value="MONEY">MONEY VALUE</option>
            <option value="PERCENTAGE">PERCENTAGE VALUE</option>
          </select>
        </Field>
        <Field label="Loan Fee:" required className="col-lg-6" error={update.fieldError("fee_value")}>
          <input type="number" step="any" className="form-control" value={form.fee_value} onChange={set("fee_value")} required />
        </Field>
      </div>
    </Modal>
  );
}

function ModeModal({ mode, onClose }: { mode: string; onClose: () => void }) {
  const [value, setValue] = useState(mode);
  const update = useAction<{ fee_category: string }>("put", "settings/loan-fees/mode");

  return (
    <Modal open onClose={onClose} title="Edit Loan Fee Category" submitLabel="Update" submitting={update.isPending} onSubmit={() => update.mutate({ fee_category: value }, { onSuccess: onClose })}>
      <label>Loan Fee Category</label>
      <select className="form-control" value={value} onChange={(e) => setValue(e.target.value)} required>
        <option value="">---Select Loan fee Category---</option>
        <option value="LOAN PRODUCT">Loan Fee By Loan Product</option>
        <option value="GENERAL">Loan Fee By General</option>
      </select>
    </Modal>
  );
}

/** Live admin/loan_fee (Loan Fee Setup). */
export default function LoanFeesPage() {
  const { data, isLoading } = useApi<{ mode: string; categories: LoanCategory[] }>("settings/loan-fees");
  const [editing, setEditing] = useState<LoanCategory | null>(null);
  const [modeOpen, setModeOpen] = useState(false);
  const saveMode = useAction<{ fee_category: string }>("put", "settings/loan-fees/mode");

  return (
    <>
      <PageHeader crumbs={["Loan Fee Setup"]} />
      <div className="row clearfix">
        <div className="col-md-6">
          <Card title="Add Loan Fee Category">
            <div className="form-group">
              <label className="font-weight-bold">Loan Fee Category</label>
              <select className="form-control" value="" onChange={(e) => e.target.value && saveMode.mutate({ fee_category: e.target.value })} required>
                <option value="">---Select Loan fee Category---</option>
                <option value="LOAN PRODUCT">Loan Fee By Loan Product</option>
                <option value="GENERAL">Loan Fee By General</option>
              </select>
            </div>
          </Card>
        </div>
        <div className="col-lg-6">
          <Card title="Loan Fee Category">
            <div className="table-responsive">
              <table className="table table-hover dataTable table-custom">
                <thead className="thead-info">
                  <tr><th>Loan Fee Category</th><th>Action</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{data ? MODE_LABEL[data.mode] : ""}</td>
                    <td><button type="button" className="btn btn-sm btn-icon btn-primary" onClick={() => setModeOpen(true)}><i className="icon-pencil" /></button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
        <div className="col-lg-12">
          <Card title="Loan Fee Category">
            <DataTable
              rows={data?.categories}
              loading={isLoading}
              rowKey={(row) => row.id}
              columns={[
                { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
                { key: "name", header: "Loan Category Name" },
                { key: "level_label", header: "Loan level", value: (row) => row.amount_from, render: (row) => row.level_label },
                { key: "interest_rate", header: "Loan Interest", render: (row) => percent(row.interest_rate) },
                { key: "fee_type", header: "Loan Fee Type", value: (row) => (row.fee_type === "percentage" ? "PERCENTAGE VALUE" : "MONEY VALUE") },
                { key: "fee_value", header: "Loan Fee", render: (row) => (row.fee_type === "percentage" ? `${row.fee_value} / %` : `${money(row.fee_value)} / Tsh`) },
                {
                  key: "action",
                  header: "Action",
                  sortable: false,
                  render: (row) => <button type="button" className="btn btn-sm btn-icon btn-primary" onClick={() => setEditing(row)}><i className="icon-pencil" /></button>,
                },
              ]}
            />
          </Card>
        </div>
      </div>
      {editing && <FeeModal key={editing.id} category={editing} onClose={() => setEditing(null)} />}
      {modeOpen && data && <ModeModal mode={data.mode} onClose={() => setModeOpen(false)} />}
    </>
  );
}
