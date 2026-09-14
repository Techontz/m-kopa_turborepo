"use client";

import { Field } from "@/components/ui/Field";
import { SelectBox, type Option } from "@/components/ui/SelectBox";

import { applicationCategoryOptions } from "@/components/settings/loanHierarchy";

import type { CategoryOption, LoanForm } from "./types";

interface Props {
  form: LoanForm;
  setForm: (form: LoanForm) => void;
  categories: CategoryOption[];
  groups: Option[];
  fieldError: (field: string) => string | undefined;
  showInstalment?: boolean;
  /** Shown instead of the placeholder when the customer has no loan category to choose (no customer type / none active). */
  emptyMessage?: string | null;
}

/** Live "Loan Application Form" fields (4 columns): category, group, amount, duration, repayments, formula, fee, reason. */
export function LoanFormFields({ form, setForm, categories: apiCategories, groups, fieldError, showInstalment, emptyMessage }: Props) {
  const categories = applicationCategoryOptions(apiCategories);
  const category = categories.find((item) => item.value === form.category_id);
  const col = "col-lg-3 col-md-6";

  return (
    <div className="row">
      <Field label="Loan category:" required className={col} error={fieldError("category_id")}>
        <select
          className="form-control"
          value={form.category_id}
          onChange={(e) => {
            const next = categories.find((item) => item.value === e.target.value);
            setForm({ ...form, category_id: e.target.value, day: next?.duration ?? "", rate: next?.formula ?? form.rate, fee_status: next ? (next.fee_deduct ? "YES" : "NO") : form.fee_status });
          }}
          required
        >
          <option value="">{categories.length === 0 && emptyMessage ? emptyMessage : "Select Loan Category"}</option>
          {categories.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Group:" className={col} error={fieldError("group_id")}>
        <SelectBox placeholder="Select Group" options={groups} value={form.group_id} isClearable onChange={(value) => setForm({ ...form, group_id: value ?? "" })} />
      </Field>
      <Field label="Loan Amount Applied:" required className={col} error={fieldError("how_loan")}>
        <input type="number" className="form-control" placeholder="Loan Amount Applied" value={form.how_loan} onChange={(e) => setForm({ ...form, how_loan: e.target.value })} required />
      </Field>
      <Field label="Loan Duration:" required className={col} error={fieldError("day")}>
        <select className="form-control" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} required>
          <option value="">Select Duration</option>
          {category?.duration && <option value={category.duration}>{category.duration_label}</option>}
        </select>
      </Field>
      <Field label="Number of Repayments:" required className={col} error={fieldError("session")}>
        <input
          type="number"
          className="form-control"
          placeholder="Enter Number of Repayments"
          min={category?.repayment_from}
          max={category?.repayment_to}
          value={form.session}
          onChange={(e) => setForm({ ...form, session: e.target.value })}
          required
        />
      </Field>
      <Field label={<b>Interest Formula:</b>} required className={col} error={fieldError("rate")}>
        <select className="form-control" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} required>
          <option value="">Interest Formula</option>
          <option value="SIMPLE">SIMPLE</option>
          <option value="FLATRATE">FLAT RATE</option>
          <option value="REDUCING">REDUCING</option>
        </select>
      </Field>
      <Field label={<b>Deducted Fee:</b>} required className={col} error={fieldError("fee_status")}>
        <select className="form-control" value={form.fee_status} onChange={(e) => setForm({ ...form, fee_status: e.target.value })} required>
          <option value="">Select</option>
          <option value="YES">YES</option>
          <option value="NO">NO</option>
        </select>
      </Field>
      <Field label="Reason of Applying Loan:" required className={col} error={fieldError("reason")}>
        <input className="form-control" placeholder="Reason of Applying Loan:" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
      </Field>
      {showInstalment && (
        <Field label="Instalment:" className={col} error={fieldError("instalment")}>
          <input type="number" className="form-control" placeholder="Enter Instalment" value={form.instalment ?? ""} onChange={(e) => setForm({ ...form, instalment: e.target.value })} />
        </Field>
      )}
      {category && (
        <div className="col-12 text-muted small">
          {category.label} · {category.interest_rate}% · {category.duration_label} · repayments {category.repayment_from} - {category.repayment_to}
          {category.requires_mandate ? " · E-MANDATE LOAN" : ""}
        </div>
      )}
    </div>
  );
}
