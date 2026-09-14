"use client";

import { Field } from "@/components/ui/Field";
import { SelectBox } from "@/components/ui/SelectBox";
import { todayIso } from "@/lib/format";

import { computeTotal, formatDecimal, formLayout, type AssetConfig, type AssetFieldConfig, type AssetForm, type AssetTypeConfig } from "./assets";

interface Props {
  config: AssetConfig | undefined;
  form: AssetForm;
  onChange: (form: AssetForm) => void;
  fieldError: (field: string) => string | undefined;
}

/** Input control for one configured type-specific field. */
export function SpecificationInput({ field, value, onChange, id }: { field: AssetFieldConfig; value: string; onChange: (value: string) => void; id: string }) {
  if (field.type === "select") {
    return (
      <select id={id} className="form-control input-sm" value={value} onChange={(event) => onChange(event.target.value)} required={field.required}>
        <option value="">Select</option>
        {(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    );
  }
  if (field.type === "textarea") {
    return <textarea id={id} className="form-control input-sm" rows={2} value={value} onChange={(event) => onChange(event.target.value)} required={field.required} />;
  }
  const numeric = field.type === "number" || field.type === "integer";
  return (
    <input
      id={id}
      type={numeric ? "number" : "text"}
      step={field.type === "integer" ? 1 : numeric ? "any" : undefined}
      min={field.min ?? undefined}
      max={field.max ?? undefined}
      className="form-control input-sm"
      placeholder={field.label}
      autoComplete="off"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required={field.required}
    />
  );
}

/**
 * "Asset Contribution Details" of the Add Capital form (Pay Method ASSET). Common fields plus the selected type's own
 * fields, rendered from the API configuration. The total is display only; the API recomputes quantity × unit value.
 */
export function AssetContributionFields({ config, form, onChange, fieldError }: Props) {
  const type: AssetTypeConfig | undefined = config?.types.find((item) => item.value === form.asset_type);
  const layout = formLayout(type);
  const quantity = layout.quantityEditable ? form.quantity : "1";
  const total = computeTotal(quantity, form.unit_value);
  const set = (key: keyof AssetForm) => (event: { target: { value: string } }) => onChange({ ...form, [key]: event.target.value });

  return (
    <fieldset className="mf-asset-fields">
      <h6 className="m-t-10 mb-2">Asset Contribution Details</h6>
      <div className="row">
        <Field label="Asset Type:" required className="col-lg-4 col-md-6" error={fieldError("asset_type")}>
          <select id="asset-type" className="form-control input-sm" value={form.asset_type} onChange={(event) => onChange({ ...form, asset_type: event.target.value, specifications: {}, quantity: "1", condition: "" })} required>
            <option value="">Select asset type</option>
            {(config?.types ?? []).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </Field>
        <Field label="Asset Name / Title:" required className="col-lg-4 col-md-6" error={fieldError("name")}>
          <input id="asset-name" className="form-control input-sm" placeholder="e.g. Toyota Hilux" value={form.name} onChange={set("name")} required maxLength={191} />
        </Field>
        <Field label="Allocated Branch:" required className="col-lg-4 col-md-6" error={fieldError("branch_id")}>
          <SelectBox inputId="asset-branch" placeholder="Select Branch" optionsUrl="options/branches" value={form.branch_id} onChange={(value) => onChange({ ...form, branch_id: value ?? "" })} />
        </Field>
        <Field label="Description:" required className="col-lg-12" error={fieldError("description")}>
          <textarea id="asset-description" className="form-control input-sm" rows={2} value={form.description} onChange={set("description")} required maxLength={2000} />
        </Field>
      </div>

      {type && layout.fields.length > 0 && (
        <>
          <h6 className="m-t-10 mb-2">{type.label} Details</h6>
          <div className="row">
            {layout.fields.map((field) => (
              <Field key={field.key} label={`${field.label}:`} required={field.required} className={field.type === "textarea" ? "col-lg-12" : "col-lg-3 col-md-6"} error={fieldError(`specifications.${field.key}`)}>
                <SpecificationInput id={`asset-spec-${field.key}`} field={field} value={form.specifications[field.key] ?? ""} onChange={(value) => onChange({ ...form, specifications: { ...form.specifications, [field.key]: value } })} />
              </Field>
            ))}
          </div>
        </>
      )}

      <h6 className="m-t-10 mb-2">Value &amp; Condition</h6>
      <div className="row">
        <Field label="Quantity:" required className="col-lg-3 col-md-6" error={fieldError("quantity")}>
          <input id="asset-quantity" type="number" min={1} step={1} className="form-control input-sm" value={quantity} onChange={set("quantity")} readOnly={!layout.quantityEditable} required />
        </Field>
        <Field label="Unit Value (TZS):" required className="col-lg-3 col-md-6" error={fieldError("unit_value")}>
          <input id="asset-unit-value" type="number" min={0.01} step="0.01" className="form-control input-sm" placeholder="Unit value" value={form.unit_value} onChange={set("unit_value")} required />
        </Field>
        <Field label="Total Contribution Value (TZS):" className="col-lg-3 col-md-6" error={fieldError("total_value")}>
          <input id="asset-total" className="form-control input-sm" readOnly value={total === null ? "" : formatDecimal(total)} placeholder="Quantity × unit value" />
        </Field>
        {layout.showCondition && (
          <Field label="Condition:" required className="col-lg-3 col-md-6" error={fieldError("condition")}>
            <select id="asset-condition" className="form-control input-sm" value={form.condition} onChange={set("condition")} required>
              <option value="">Select</option>
              {(config?.conditions ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
        )}
        <Field label="Contribution Date:" required className="col-lg-3 col-md-6" error={fieldError("contribution_date")}>
          <input id="asset-contribution-date" type="date" max={todayIso()} className="form-control input-sm" value={form.contribution_date} onChange={set("contribution_date")} required />
        </Field>
        <Field label="Location:" required={layout.locationRequired} className="col-lg-3 col-md-6" error={fieldError("location")}>
          <input id="asset-location" className="form-control input-sm" placeholder="Where the asset is kept" value={form.location} onChange={set("location")} required={layout.locationRequired} maxLength={191} />
        </Field>
        <Field label="Notes:" className="col-lg-6" error={fieldError("notes")}>
          <input id="asset-notes" className="form-control input-sm" value={form.notes} onChange={set("notes")} maxLength={2000} />
        </Field>
      </div>

      <h6 className="m-t-10 mb-2">Valuation</h6>
      <div className="row">
        <Field label="Valuation Method:" required className="col-lg-3 col-md-6" error={fieldError("valuation_method")}>
          <select id="asset-valuation-method" className="form-control input-sm" value={form.valuation_method} onChange={set("valuation_method")} required>
            <option value="">Select</option>
            {(config?.valuation_methods ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Field>
        <Field label="Valuation Date:" required className="col-lg-3 col-md-6" error={fieldError("valuation_date")}>
          <input id="asset-valuation-date" type="date" max={todayIso()} className="form-control input-sm" value={form.valuation_date} onChange={set("valuation_date")} required />
        </Field>
        <Field label="Valued By / Valuation Reference:" className="col-lg-3 col-md-6" error={fieldError("valued_by") ?? fieldError("valuation_reference")}>
          <div className="d-flex">
            <input id="asset-valued-by" className="form-control input-sm mr-1" placeholder="Valued by" value={form.valued_by} onChange={set("valued_by")} maxLength={191} />
            <input id="asset-valuation-reference" className="form-control input-sm" placeholder="Reference" value={form.valuation_reference} onChange={set("valuation_reference")} maxLength={191} />
          </div>
        </Field>
        <Field label="Valuation Notes:" className="col-lg-3 col-md-6" error={fieldError("valuation_notes")}>
          <input id="asset-valuation-notes" className="form-control input-sm" value={form.valuation_notes} onChange={set("valuation_notes")} maxLength={2000} />
        </Field>
      </div>
      <p className="mb-0">
        <small className="text-muted">
          Posting: Dr {layout.account ?? "fixed-asset account for the type"} / Cr CAPITAL ACCOUNT — no cash or bank movement. The contribution value is fixed at contribution; ownership still comes only from shares (Shares → Issue Shares can link this contribution).
        </small>
      </p>
    </fieldset>
  );
}
