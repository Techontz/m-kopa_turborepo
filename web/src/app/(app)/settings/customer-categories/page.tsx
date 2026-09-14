"use client";

import { useState } from "react";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Option } from "@/components/ui/SelectBox";
import { confirmAction } from "@/components/ui/notify";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

type FieldType = "text" | "textarea" | "number" | "currency" | "date" | "select" | "boolean";

interface SchemaField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  dataSource?: string;
  dependsOn?: string | null;
  storesIn?: string | null;
  requiredWhen?: { field: string; equals: string[] } | null;
  fullWidth?: boolean;
  placeholder?: string | null;
  helpText?: string | null;
}

interface CustomerType {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  formTitle: string | null;
  isActive: boolean;
  sortOrder: number;
  riskTier: "low" | "medium" | "high" | null;
  sector: "employment" | "business" | "other";
  requiredDocuments: string[];
  optionalDocuments: string[];
  requiresSector: boolean;
  requiresEmployer: boolean;
  requiresContract: boolean;
  requiresSalary: boolean;
  dynamicFormSchema: SchemaField[];
  omittedStandardFields: string[];
  requiresExtraApproval: boolean;
  createdBy: number | null;
  deletedAt: string | null;
  customerCount: number;
  minLoanAmount: number;
  maxLoanAmount: number;
  loanCategories?: { id: number; name: string }[];
}

interface TypeForm {
  name: string;
  code: string;
  description: string;
  formTitle: string;
  isActive: boolean;
  sortOrder: string;
  riskTier: string;
  sector: string;
  requiresSector: boolean;
  requiresEmployer: boolean;
  requiresContract: boolean;
  requiresSalary: boolean;
  requiresExtraApproval: boolean;
  requiredDocuments: string;
  optionalDocuments: string;
  omittedStandardFields: string[];
  dynamicFormSchema: Array<SchemaField & { optionsText: string }>;
  minLoanAmount: string;
  maxLoanAmount: string;
  loanCategoryIds: number[];
}

const RISK_TONE: Record<string, BadgeTone> = { low: "success", medium: "warning", high: "danger" };
const FIELD_TYPES: FieldType[] = ["text", "textarea", "number", "currency", "date", "select", "boolean"];
const STANDARD_FIELDS: { key: string; label: string }[] = [
  { key: "place_of_employment", label: "Place of Employment" },
  { key: "check_number", label: "Check Number" },
  { key: "basic_salary", label: "Basic Salary" },
  { key: "take_home", label: "Take Home" },
  { key: "monthly_income", label: "Monthly Income" },
  { key: "retirement_date", label: "Date of Retirement" },
  { key: "business_name", label: "Business Name" },
  { key: "business_type", label: "Business Type" },
  { key: "business_address", label: "Business Address" },
  { key: "tin_number", label: "TIN Number (Optional)" },
];
const DATA_SOURCES = [
  "banks", "mobile-money-providers", "marital-statuses", "id-types", "document-types", "government-bodies", "government-departments",
  "government-cadres", "private-sectors", "private-employers", "private-departments", "private-cadres", "business-sectors", "business-types",
  "colleges", "courses", "pension-funds",
];
const FLAGS: { key: "requiresSector" | "requiresEmployer" | "requiresContract" | "requiresSalary" | "requiresExtraApproval"; label: string }[] = [
  { key: "requiresSector", label: "Requires sector" },
  { key: "requiresEmployer", label: "Requires employer" },
  { key: "requiresContract", label: "Requires contract" },
  { key: "requiresSalary", label: "Requires salary" },
  { key: "requiresExtraApproval", label: "Needs extra approval" },
];

const splitList = (text: string) => text.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);

function toForm(type: CustomerType | null): TypeForm {
  return {
    name: type?.name ?? "",
    code: type?.code ?? "",
    description: type?.description ?? "",
    formTitle: type?.formTitle ?? "",
    isActive: type?.isActive ?? true,
    sortOrder: String(type?.sortOrder ?? 0),
    riskTier: type?.riskTier ?? "",
    sector: type?.sector ?? "other",
    requiresSector: type?.requiresSector ?? false,
    requiresEmployer: type?.requiresEmployer ?? false,
    requiresContract: type?.requiresContract ?? false,
    requiresSalary: type?.requiresSalary ?? false,
    requiresExtraApproval: type?.requiresExtraApproval ?? false,
    requiredDocuments: (type?.requiredDocuments ?? []).join(", "),
    optionalDocuments: (type?.optionalDocuments ?? []).join(", "),
    omittedStandardFields: type?.omittedStandardFields ?? [],
    dynamicFormSchema: (type?.dynamicFormSchema ?? []).map((field) => ({ ...field, optionsText: (field.options ?? []).join("\n") })),
    minLoanAmount: String(type?.minLoanAmount ?? 0),
    maxLoanAmount: String(type?.maxLoanAmount ?? 0),
    loanCategoryIds: (type?.loanCategories ?? []).map((product) => product.id),
  };
}

/** Request body: camelCase, schema rows cleaned of empty optional keys. */
function toPayload(form: TypeForm) {
  return {
    ...form,
    sortOrder: Number(form.sortOrder || 0),
    riskTier: form.riskTier || null,
    requiredDocuments: splitList(form.requiredDocuments),
    optionalDocuments: splitList(form.optionalDocuments),
    minLoanAmount: Number(form.minLoanAmount || 0),
    maxLoanAmount: Number(form.maxLoanAmount || 0),
    dynamicFormSchema: form.dynamicFormSchema.map((row) => {
      const { optionsText, ...field } = row;
      const options = splitList(optionsText.replace(/,/g, "\n"));
      const clean: SchemaField = { key: field.key, label: field.label, type: field.type, required: Boolean(field.required) };
      if (field.type === "select" && field.dataSource) clean.dataSource = field.dataSource;
      if (field.type === "select" && !field.dataSource && options.length) clean.options = options;
      if (field.dependsOn) clean.dependsOn = field.dependsOn;
      if (field.storesIn) clean.storesIn = field.storesIn;
      if (field.requiredWhen) clean.requiredWhen = field.requiredWhen;
      if (field.fullWidth) clean.fullWidth = true;
      if (field.placeholder) clean.placeholder = field.placeholder;
      if (field.helpText) clean.helpText = field.helpText;
      return clean;
    }),
  };
}

function SchemaEditor({ rows, onChange, errorFor }: { rows: TypeForm["dynamicFormSchema"]; onChange: (rows: TypeForm["dynamicFormSchema"]) => void; errorFor: (field: string) => string | undefined }) {
  const update = (index: number, patch: Partial<TypeForm["dynamicFormSchema"][number]>) => onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const move = (index: number, offset: number) => {
    const next = [...rows];
    const [row] = next.splice(index, 1);
    next.splice(index + offset, 0, row);
    onChange(next);
  };

  return (
    <div className="table-responsive">
      <table className="table table-sm table-custom mb-2">
        <thead className="thead-info">
          <tr><th>#</th><th>Label</th><th>Key</th><th>Type</th><th>Required</th><th>Data source / options</th><th>Depends on</th><th>Stores in</th><th /></tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td>{index + 1}.</td>
              <td style={{ minWidth: 180 }}>
                <input className="form-control form-control-sm" value={row.label} onChange={(e) => update(index, { label: e.target.value })} />
                {errorFor(`dynamicFormSchema.${index}.label`) && <div className="field-error">{errorFor(`dynamicFormSchema.${index}.label`)}</div>}
              </td>
              <td style={{ minWidth: 130 }}>
                <input className="form-control form-control-sm" value={row.key} onChange={(e) => update(index, { key: e.target.value })} />
                {errorFor(`dynamicFormSchema.${index}.key`) && <div className="field-error">{errorFor(`dynamicFormSchema.${index}.key`)}</div>}
              </td>
              <td style={{ minWidth: 110 }}>
                <select className="form-control form-control-sm" value={row.type} onChange={(e) => update(index, { type: e.target.value as FieldType })}>
                  {FIELD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </td>
              <td className="text-center"><input type="checkbox" checked={Boolean(row.required)} onChange={(e) => update(index, { required: e.target.checked })} /></td>
              <td style={{ minWidth: 190 }}>
                {row.type === "select" ? (
                  <>
                    <select className="form-control form-control-sm mb-1" value={row.dataSource ?? ""} onChange={(e) => update(index, { dataSource: e.target.value || undefined })}>
                      <option value="">Fixed options</option>
                      {DATA_SOURCES.map((source) => <option key={source} value={source}>{source}</option>)}
                    </select>
                    {!row.dataSource && <textarea className="form-control form-control-sm" rows={2} placeholder="One option per line" value={row.optionsText} onChange={(e) => update(index, { optionsText: e.target.value })} />}
                    {errorFor(`dynamicFormSchema.${index}.options`) && <div className="field-error">{errorFor(`dynamicFormSchema.${index}.options`)}</div>}
                  </>
                ) : "-"}
              </td>
              <td style={{ minWidth: 120 }}>
                <select className="form-control form-control-sm" value={row.dependsOn ?? ""} onChange={(e) => update(index, { dependsOn: e.target.value || null })}>
                  <option value="">—</option>
                  {rows.slice(0, index).map((previous) => <option key={previous.key} value={previous.key}>{previous.key}</option>)}
                </select>
                {errorFor(`dynamicFormSchema.${index}.dependsOn`) && <div className="field-error">{errorFor(`dynamicFormSchema.${index}.dependsOn`)}</div>}
              </td>
              <td style={{ minWidth: 120 }}><input className="form-control form-control-sm" value={row.storesIn ?? ""} placeholder="—" onChange={(e) => update(index, { storesIn: e.target.value || null })} /></td>
              <td className="text-nowrap">
                <button type="button" className="btn btn-sm btn-outline-secondary mr-1" title="Move up" disabled={index === 0} onClick={() => move(index, -1)}><i className="fa fa-arrow-up" /></button>
                <button type="button" className="btn btn-sm btn-outline-secondary mr-1" title="Move down" disabled={index === rows.length - 1} onClick={() => move(index, 1)}><i className="fa fa-arrow-down" /></button>
                <button type="button" className="btn btn-sm btn-danger" title="Remove field" onClick={() => onChange(rows.filter((_, i) => i !== index))}><i className="icon-trash" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn btn-sm btn-primary" onClick={() => onChange([...rows, { key: "", label: "", type: "text", required: false, optionsText: "" }])}>
        <i className="icon-plus" /> Add field
      </button>
    </div>
  );
}

function TypeEditor({ type, onDone }: { type: CustomerType | null; onDone: () => void }) {
  const { data: products = [] } = useApi<Option[]>("settings/options/loan-categories");
  const [form, setForm] = useState<TypeForm>(() => toForm(type));
  const save = useAction<ReturnType<typeof toPayload>>(type ? "put" : "post", type ? `customer-categories/${type.id}` : "customer-categories");
  const set = (patch: Partial<TypeForm>) => setForm({ ...form, ...patch });

  return (
    <Modal open onClose={onDone} title={type ? `Edit Customer Type / ${type.name}` : "Add Customer Type"} size="xl" submitLabel={type ? "Update" : "Save"} submitting={save.isPending} onSubmit={() => save.mutate(toPayload(form), { onSuccess: onDone })}>
      <div className="row">
        <Field label="Name:" required className="col-md-4" error={save.fieldError("name")}>
          <input className="form-control" value={form.name} onChange={(e) => set({ name: e.target.value })} required />
        </Field>
        <Field label="Code:" required className="col-md-3" error={save.fieldError("code")}>
          <input className="form-control" value={form.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} placeholder="CUSTOMER_TYPE_CODE" required />
        </Field>
        <Field label="Step 2 card title:" className="col-md-5" error={save.fieldError("formTitle")}>
          <input className="form-control" value={form.formTitle} onChange={(e) => set({ formTitle: e.target.value })} />
        </Field>
        <Field label="Sector:" required className="col-md-3" error={save.fieldError("sector")}>
          <select className="form-control" value={form.sector} onChange={(e) => set({ sector: e.target.value })}>
            <option value="employment">Employment</option>
            <option value="business">Business</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Risk tier:" className="col-md-3" error={save.fieldError("riskTier")}>
          <select className="form-control" value={form.riskTier} onChange={(e) => set({ riskTier: e.target.value })}>
            <option value="">—</option>
            <option value="low">LOW</option>
            <option value="medium">MEDIUM</option>
            <option value="high">HIGH</option>
          </select>
        </Field>
        <Field label="Sort order:" className="col-md-3" error={save.fieldError("sortOrder")}>
          <input type="number" min={0} className="form-control" value={form.sortOrder} onChange={(e) => set({ sortOrder: e.target.value })} />
        </Field>
        <Field label="Status:" required className="col-md-3" error={save.fieldError("isActive")}>
          <select className="form-control" value={form.isActive ? "1" : "0"} onChange={(e) => set({ isActive: e.target.value === "1" })}>
            <option value="1">ACTIVE</option>
            <option value="0">INACTIVE</option>
          </select>
        </Field>
        <Field label="Description:" className="col-md-12" error={save.fieldError("description")}>
          <textarea className="form-control" rows={2} value={form.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <div className="col-md-12 mb-2">
          {FLAGS.map((flag) => (
            <label key={flag.key} className="fancy-checkbox mr-3 mb-0">
              <input type="checkbox" checked={form[flag.key]} onChange={(e) => set({ [flag.key]: e.target.checked } as Partial<TypeForm>)} /> <span>{flag.label}</span>
            </label>
          ))}
        </div>
        <Field label="Required documents (comma separated):" className="col-md-6" error={save.fieldError("requiredDocuments")}>
          <input className="form-control" value={form.requiredDocuments} onChange={(e) => set({ requiredDocuments: e.target.value })} placeholder="national_id, salary_slip" />
        </Field>
        <Field label="Optional documents (comma separated):" className="col-md-6" error={save.fieldError("optionalDocuments")}>
          <input className="form-control" value={form.optionalDocuments} onChange={(e) => set({ optionalDocuments: e.target.value })} />
        </Field>
        <div className="col-md-12 mb-2">
          <span>Omitted standard fields:</span>
          <div>
            {STANDARD_FIELDS.map((field) => (
              <label key={field.key} className="fancy-checkbox mr-3 mb-0">
                <input
                  type="checkbox"
                  checked={form.omittedStandardFields.includes(field.key)}
                  onChange={(e) => set({ omittedStandardFields: e.target.checked ? [...form.omittedStandardFields, field.key] : form.omittedStandardFields.filter((key) => key !== field.key) })}
                />{" "}
                <span>{field.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="col-md-12 mb-3">
          <span>Step 2 questions (dynamic form schema):</span>
          <SchemaEditor rows={form.dynamicFormSchema} onChange={(rows) => set({ dynamicFormSchema: rows })} errorFor={save.fieldError} />
        </div>
        <Field label="Minimum loan amount:" className="col-md-3" error={save.fieldError("minLoanAmount")}>
          <input type="number" min={0} className="form-control" value={form.minLoanAmount} onChange={(e) => set({ minLoanAmount: e.target.value })} />
        </Field>
        <Field label="Maximum loan amount:" className="col-md-3" error={save.fieldError("maxLoanAmount")}>
          <input type="number" min={0} className="form-control" value={form.maxLoanAmount} onChange={(e) => set({ maxLoanAmount: e.target.value })} />
        </Field>
        <div className="col-md-6 mb-2">
          <span>Allowed loan products:</span>
          <div>
            {products.map((product) => (
              <label key={product.value} className="fancy-checkbox mr-3 mb-0">
                <input
                  type="checkbox"
                  checked={form.loanCategoryIds.includes(Number(product.value))}
                  onChange={() => set({ loanCategoryIds: form.loanCategoryIds.includes(Number(product.value)) ? form.loanCategoryIds.filter((id) => id !== Number(product.value)) : [...form.loanCategoryIds, Number(product.value)] })}
                />{" "}
                <span>{product.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function TypeViewer({ type, onClose }: { type: CustomerType; onClose: () => void }) {
  const flags = FLAGS.filter((flag) => type[flag.key]).map((flag) => flag.label);

  return (
    <Modal open onClose={onClose} title={`${(type.formTitle ?? type.name).toUpperCase()} — Step 2 questions`} size="xl">
      <p className="mb-2">
        <strong>{type.name}</strong> <small className="text-muted">{type.code}</small> · Sector: {type.sector} · Risk tier: {type.riskTier ?? "-"}
        {flags.length > 0 && <> · {flags.join(", ")}</>}
      </p>
      <div className="table-responsive">
        <table className="table table-hover table-custom">
          <thead className="thead-info">
            <tr><th>S/No.</th><th>Label</th><th>Type</th><th>Required</th><th>Data source / options</th><th>Depends on</th><th>Stores in</th></tr>
          </thead>
          <tbody>
            {type.dynamicFormSchema.length === 0 && <tr><td colSpan={7} className="text-center text-muted">This type asks nothing beyond Step 1 and the payment block.</td></tr>}
            {type.dynamicFormSchema.map((field, index) => (
              <tr key={field.key}>
                <td>{index + 1}.</td>
                <td>{field.label}<br /><small className="text-muted">{field.key}</small></td>
                <td>{field.type}</td>
                <td>{field.required ? <Badge tone="danger">YES</Badge> : field.requiredWhen ? <Badge tone="warning">CONDITIONAL</Badge> : "NO"}</td>
                <td>{field.dataSource ?? field.options?.join(", ") ?? "-"}</td>
                <td>{field.dependsOn ?? "-"}</td>
                <td>{field.storesIn ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-1"><strong>Omitted standard fields:</strong> {type.omittedStandardFields.length ? type.omittedStandardFields.join(", ") : "none"}</p>
      <p className="mb-1"><strong>Required documents:</strong> {type.requiredDocuments.length ? type.requiredDocuments.join(", ") : "none"}</p>
      <p className="mb-0"><strong>Allowed loan products:</strong> {type.loanCategories?.length ? type.loanCategories.map((product) => product.name).join(", ") : "none"}</p>
    </Modal>
  );
}

/** Settings → Customer Types (also served at the older /settings/customer-categories path). Everyone may look; only the Super Administrator may change them. */
export default function CustomerTypesPage() {
  const { user } = useAuth();
  const canEdit = user?.role?.key === "super_admin";
  const { data: types, isLoading } = useApi<CustomerType[]>("customer-categories");
  const [editing, setEditing] = useState<CustomerType | "new" | null>(null);
  const [viewing, setViewing] = useState<CustomerType | null>(null);
  const remove = useAction<{ id: number }>("delete", (body) => `customer-categories/${body.id}`);

  return (
    <>
      <PageHeader crumbs={["Setting", "Customer Types"]} />
      <Card
        title="Customer Type List"
        actions={canEdit ? <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing("new")}><i className="icon-plus" /> Add Customer Type</button> : undefined}
      >
        {!canEdit && <p className="text-muted mb-2">Only the Super Administrator can create, edit or delete customer types.</p>}
        <DataTable
          rows={types}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sortOrder", header: "Order" },
            { key: "name", header: "Customer Type", className: "text-nowrap", render: (row) => <>{row.name}<br /><small className="text-muted">{row.code}</small></>, value: (row) => `${row.name} ${row.code ?? ""} ${row.formTitle ?? ""}` },
            { key: "sector", header: "Sector", render: (row) => row.sector.toUpperCase() },
            { key: "riskTier", header: "Risk Tier", value: (row) => row.riskTier ?? "", render: (row) => (row.riskTier ? <Badge tone={RISK_TONE[row.riskTier]}>{row.riskTier.toUpperCase()}</Badge> : "-") },
            { key: "questions", header: "Step 2 Questions", value: (row) => row.dynamicFormSchema.length },
            { key: "limits", header: "Loan Limit", className: "text-nowrap", value: (row) => row.maxLoanAmount, render: (row) => `${money(row.minLoanAmount)} - ${money(row.maxLoanAmount)}` },
            { key: "customerCount", header: "Customers" },
            {
              key: "isActive",
              header: "Status",
              value: (row) => (row.isActive ? "ACTIVE" : "INACTIVE"),
              render: (row) => (
                <>
                  <Badge tone={row.isActive ? "success" : "danger"}>{row.isActive ? "ACTIVE" : "INACTIVE"}</Badge>
                  {row.requiresExtraApproval && <> <Badge tone="warning">EXTRA APPROVAL</Badge></>}
                </>
              ),
            },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  <button type="button" className="btn btn-sm btn-icon btn-info mr-1" title="View questions" onClick={() => setViewing(row)}><i className="icon-eye" /></button>
                  {canEdit && (
                    <>
                      <button type="button" className="btn btn-sm btn-icon btn-primary mr-1" title="Edit" onClick={() => setEditing(row)}><i className="icon-pencil" /></button>
                      <button
                        type="button"
                        className="btn btn-sm btn-icon btn-danger"
                        title="Delete"
                        onClick={async () => (await confirmAction("Delete this customer type?", row.customerCount ? `${row.customerCount} customer(s) keep it on their record.` : undefined)) && remove.mutate({ id: row.id })}
                      >
                        <i className="icon-trash" />
                      </button>
                    </>
                  )}
                </>
              ),
            },
          ]}
        />
      </Card>
      {editing && canEdit && <TypeEditor key={editing === "new" ? "new" : editing.id} type={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      {viewing && <TypeViewer type={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
