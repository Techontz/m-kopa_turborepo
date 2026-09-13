"use client";

import { useState } from "react";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Option } from "@/components/ui/SelectBox";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface CustomerCategory {
  id: number;
  key: string;
  name: string;
  icon: string | null;
  section_title: string | null;
  risk_level: "low" | "medium" | "high";
  min_loan_amount: number;
  max_loan_amount: number;
  required_documents: string[];
  is_active: boolean;
  fields_count: number;
  loan_categories: { id: number; name: string }[];
}

interface SchemaField {
  key: string;
  label: string;
  control: string;
  inputType: string | null;
  required: boolean;
  dependsOn: string | null;
  requiredWhen: unknown;
  optionSource?: { kind: string; tree?: string; values?: string[] } | null;
  options?: string[];
}

interface RuleForm {
  name: string;
  risk_level: string;
  min_loan_amount: string;
  max_loan_amount: string;
  required_documents: string[];
  loan_category_ids: number[];
  is_active: boolean;
}

const RISK_TONE: Record<string, BadgeTone> = { low: "success", medium: "warning", high: "danger" };

function RuleEditor({ category, onDone }: { category: CustomerCategory; onDone: () => void }) {
  const { data: products = [] } = useApi<Option[]>("settings/options/loan-categories");
  const [form, setForm] = useState<RuleForm>({
    name: category.name,
    risk_level: category.risk_level,
    min_loan_amount: String(category.min_loan_amount),
    max_loan_amount: String(category.max_loan_amount),
    required_documents: category.required_documents.length ? category.required_documents : [""],
    loan_category_ids: category.loan_categories.map((product) => product.id),
    is_active: category.is_active,
  });
  const update = useAction<RuleForm>("put", `settings/customer-categories/${category.id}`);

  const setDocument = (index: number, value: string) => setForm({ ...form, required_documents: form.required_documents.map((item, i) => (i === index ? value : item)) });
  const toggleProduct = (id: number) =>
    setForm({ ...form, loan_category_ids: form.loan_category_ids.includes(id) ? form.loan_category_ids.filter((item) => item !== id) : [...form.loan_category_ids, id] });

  return (
    <Modal open onClose={onDone} title={`Edit Customer Category / ${category.name}`} size="lg" submitLabel="Update" submitting={update.isPending} onSubmit={() => update.mutate(form, { onSuccess: onDone })}>
      <div className="row">
        <Field label="Category name:" required className="col-md-6" error={update.fieldError("name")}>
          <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <Field label="Risk level (approval logic):" required className="col-md-3" error={update.fieldError("risk_level")}>
          <select className="form-control" value={form.risk_level} onChange={(e) => setForm({ ...form, risk_level: e.target.value })} required>
            <option value="low">LOW</option>
            <option value="medium">MEDIUM</option>
            <option value="high">HIGH</option>
          </select>
        </Field>
        <Field label="Status:" required className="col-md-3" error={update.fieldError("is_active")}>
          <select className="form-control" value={form.is_active ? "1" : "0"} onChange={(e) => setForm({ ...form, is_active: e.target.value === "1" })}>
            <option value="1">ACTIVE</option>
            <option value="0">INACTIVE</option>
          </select>
        </Field>
        <Field label="Minimum loan amount:" required className="col-md-6" error={update.fieldError("min_loan_amount")}>
          <input type="number" min={0} className="form-control" value={form.min_loan_amount} onChange={(e) => setForm({ ...form, min_loan_amount: e.target.value })} required />
        </Field>
        <Field label="Maximum loan amount:" required className="col-md-6" error={update.fieldError("max_loan_amount")}>
          <input type="number" min={0} className="form-control" value={form.max_loan_amount} onChange={(e) => setForm({ ...form, max_loan_amount: e.target.value })} required />
        </Field>
        <div className="col-md-6 mb-2">
          <span>Required documents:</span>
          {form.required_documents.map((document, index) => (
            <div className="input-group mb-1" key={index}>
              <input className="form-control" value={document} placeholder="Document name" onChange={(e) => setDocument(index, e.target.value)} />
              <div className="input-group-append">
                <button type="button" className="btn btn-danger btn-sm" onClick={() => setForm({ ...form, required_documents: form.required_documents.filter((_, i) => i !== index) })}><i className="icon-trash" /></button>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setForm({ ...form, required_documents: [...form.required_documents, ""] })}><i className="icon-plus" /> Add document</button>
          {update.fieldError("required_documents") && <div className="field-error">{update.fieldError("required_documents")}</div>}
        </div>
        <div className="col-md-6 mb-2">
          <span>Allowed loan products:</span>
          {products.map((product) => (
            <div key={product.value}>
              <label className="fancy-checkbox mb-0">
                <input type="checkbox" checked={form.loan_category_ids.includes(Number(product.value))} onChange={() => toggleProduct(Number(product.value))} /> <span>{product.label}</span>
              </label>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function SchemaViewer({ category, onClose }: { category: CustomerCategory; onClose: () => void }) {
  const { data, isLoading } = useApi<CustomerCategory & { form_schema: SchemaField[] }>(`settings/customer-categories/${category.id}`);

  return (
    <Modal open onClose={onClose} title={`${category.icon ?? ""} ${category.section_title ?? category.name} — Dynamic Form`} size="lg">
      {isLoading ? (
        <div className="mf-loading">Loading...</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover table-custom">
            <thead className="thead-info">
              <tr><th>S/No.</th><th>Field</th><th>Control</th><th>Required</th><th>Depends On</th><th>Options</th></tr>
            </thead>
            <tbody>
              {(data?.form_schema ?? []).map((field, index) => (
                <tr key={field.key}>
                  <td>{index + 1}.</td>
                  <td>{field.label}<br /><small className="text-muted">{field.key}</small></td>
                  <td>{field.control}{field.inputType ? ` (${field.inputType})` : ""}</td>
                  <td>{field.required ? <Badge tone="danger">YES</Badge> : field.requiredWhen ? <Badge tone="warning">CONDITIONAL</Badge> : "NO"}</td>
                  <td>{field.dependsOn ?? "-"}</td>
                  <td>{field.optionSource ? (field.optionSource.tree ? `${field.optionSource.kind}: ${field.optionSource.tree}` : field.optionSource.kind) : field.options?.join(", ") ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

/** Documents: CUSTOMER REGISTRATION OVERVIEW — "Category = Rule Engine". */
export default function CustomerCategoriesPage() {
  const { data: categories, isLoading } = useApi<CustomerCategory[]>("settings/customer-categories");
  const [editing, setEditing] = useState<CustomerCategory | null>(null);
  const [viewing, setViewing] = useState<CustomerCategory | null>(null);

  return (
    <>
      <PageHeader crumbs={["Setting", "Customer Categories"]} />
      <Card title="Customer Category List">
        <DataTable
          rows={categories}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "name", header: "Category Name", className: "text-nowrap", render: (row) => `${row.icon ?? ""} ${row.name}` },
            { key: "risk_level", header: "Risk Level", render: (row) => <Badge tone={RISK_TONE[row.risk_level]}>{row.risk_level.toUpperCase()}</Badge> },
            { key: "limits", header: "Loan Limit", className: "text-nowrap", value: (row) => row.max_loan_amount, render: (row) => `${money(row.min_loan_amount)} - ${money(row.max_loan_amount)}` },
            { key: "products", header: "Allowed Loan Products", value: (row) => row.loan_categories.map((product) => product.name).join(", ") },
            { key: "documents", header: "Required Documents", value: (row) => row.required_documents.join(", ") },
            { key: "fields_count", header: "Form Fields" },
            { key: "is_active", header: "Status", value: (row) => (row.is_active ? "ACTIVE" : "INACTIVE"), render: (row) => <Badge tone={row.is_active ? "success" : "danger"}>{row.is_active ? "ACTIVE" : "INACTIVE"}</Badge> },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  <button type="button" className="btn btn-sm btn-icon btn-info mr-1" title="View form" onClick={() => setViewing(row)}><i className="icon-eye" /></button>
                  <button type="button" className="btn btn-sm btn-icon btn-primary" onClick={() => setEditing(row)}><i className="icon-pencil" /></button>
                </>
              ),
            },
          ]}
        />
      </Card>
      {editing && <RuleEditor key={editing.id} category={editing} onDone={() => setEditing(null)} />}
      {viewing && <SchemaViewer category={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
