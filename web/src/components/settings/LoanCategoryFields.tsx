"use client";

import { Field } from "@/components/ui/Field";
import type { Option } from "@/components/ui/SelectBox";
import { useApi } from "@/lib/hooks";

export interface LoanCategory {
  id: number;
  name: string;
  main_category_id: number | null;
  main_category: string | null;
  amount_from: number;
  amount_to: number;
  level_label: string;
  interest_rate: number;
  formula: string;
  duration: string;
  duration_label: string;
  repayment_from: number;
  repayment_to: number;
  fee_deduct: boolean;
  has_penalty: boolean;
  approve_level: string;
  requires_mandate: boolean;
  topup_percent: number;
  take_home_percent: number;
  fee_type: "money" | "percentage";
  fee_value: number;
  insurance: number;
  branches?: { id: number; name: string }[];
  customer_categories?: { id: number; name: string }[];
}

export interface LoanCategoryForm {
  loan_name: string;
  loan_price: string;
  loan_perday: string;
  interest_formular: string;
  formular: string;
  duration: string;
  from_repayment: string;
  to_repayment: string;
  fee_deduct: string;
  penart: string;
  aprove_status: string;
  requires_mandate: string;
  topup_percent: string;
  take_home_percent: string;
  main_id: string;
  customer_category_ids: number[];
}

export const EMPTY_LOAN_CATEGORY: LoanCategoryForm = {
  loan_name: "", loan_price: "", loan_perday: "", interest_formular: "", formular: "", duration: "", from_repayment: "", to_repayment: "",
  fee_deduct: "", penart: "", aprove_status: "", requires_mandate: "", topup_percent: "", take_home_percent: "", main_id: "", customer_category_ids: [],
};

const yesNo = (value: boolean) => (value ? "YES" : "NO");

export function toLoanCategoryForm(category: LoanCategory): LoanCategoryForm {
  return {
    loan_name: category.name,
    loan_price: String(category.amount_from),
    loan_perday: String(category.amount_to),
    interest_formular: String(category.interest_rate),
    formular: category.formula,
    duration: category.duration,
    from_repayment: String(category.repayment_from),
    to_repayment: String(category.repayment_to),
    fee_deduct: yesNo(category.fee_deduct),
    penart: yesNo(category.has_penalty),
    aprove_status: category.approve_level,
    requires_mandate: yesNo(category.requires_mandate),
    topup_percent: String(category.topup_percent),
    take_home_percent: String(category.take_home_percent),
    main_id: String(category.main_category_id ?? ""),
    customer_category_ids: (category.customer_categories ?? []).map((item) => item.id),
  };
}

interface FieldsProps {
  form: LoanCategoryForm;
  setForm: (form: LoanCategoryForm) => void;
  fieldError: (field: string) => string | undefined;
  /** Create modal shows the "---Select ...---" placeholders like the live form. */
  creating?: boolean;
}

/** Live loan category form (admin/create_loanCategory, update_loanCategory) + Documents additions. */
export function LoanCategoryFields({ form, setForm, fieldError, creating = false }: FieldsProps) {
  const { data: formulas = [] } = useApi<Option[]>("settings/options/formulas");
  const { data: durations = [] } = useApi<Option[]>("settings/options/durations");
  const { data: levels = [] } = useApi<Option[]>("settings/options/approve-levels");
  const { data: mains = [] } = useApi<Option[]>("settings/options/main-categories");
  const { data: customerCategories = [] } = useApi<Option[]>("settings/options/customer-categories");

  const set = (field: keyof LoanCategoryForm) => (event: { target: { value: string } }) => setForm({ ...form, [field]: event.target.value });
  const select = (field: keyof LoanCategoryForm, placeholder: string, options: Option[]) => (
    <select className="form-control" value={form[field] as string} onChange={set(field)} required>
      {(creating || form[field] === "") && <option value="">{placeholder}</option>}
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
  const yesNoOptions: Option[] = [{ value: "YES", label: "YES" }, { value: "NO", label: "NO" }];
  const toggleCategory = (id: number) =>
    setForm({ ...form, customer_category_ids: form.customer_category_ids.includes(id) ? form.customer_category_ids.filter((item) => item !== id) : [...form.customer_category_ids, id] });

  return (
    <div className="row">
      <Field label="Loan Product name:" required className="col-lg-3" error={fieldError("loan_name")}>
        <input className="form-control input-sm" placeholder="Loan Category product name" value={form.loan_name} onChange={set("loan_name")} required />
      </Field>
      <Field label="From:" required className="col-lg-3 col-6" error={fieldError("loan_price")}>
        <input type={creating ? "text" : "number"} className="form-control input-sm" placeholder="eg.1000" value={form.loan_price} onChange={set("loan_price")} required />
      </Field>
      <Field label="To:" required className="col-lg-3 col-6" error={fieldError("loan_perday")}>
        <input type={creating ? "text" : "number"} className="form-control input-sm" placeholder="eg.10000" value={form.loan_perday} onChange={set("loan_perday")} required />
      </Field>
      <Field label="Loan Interest(%)" required className="col-lg-3" error={fieldError("interest_formular")}>
        <input className="form-control input-sm" placeholder="Loan Interest(%)" value={form.interest_formular} onChange={set("interest_formular")} required />
      </Field>
      <Field label="Interest Formular" required className="col-lg-3" error={fieldError("formular")}>
        {select("formular", "---Select Interest Formular---", formulas)}
      </Field>
      <Field label="Select Loan Duration" required className="col-lg-3" error={fieldError("duration")}>
        {select("duration", "---Select Loan Duration---", durations)}
      </Field>
      <Field label="Repayment Level" required className="col-lg-3 col-6" error={fieldError("from_repayment")}>
        <input type="number" className="form-control" placeholder="From" value={form.from_repayment} onChange={set("from_repayment")} required />
      </Field>
      <Field label="." className="col-lg-3 col-6" error={fieldError("to_repayment")}>
        <input type="number" className="form-control" placeholder="To" value={form.to_repayment} onChange={set("to_repayment")} required />
      </Field>
      <Field label="You Allow Deduction?" className="col-lg-4 col-6" error={fieldError("fee_deduct")}>
        {select("fee_deduct", "Select", yesNoOptions)}
      </Field>
      <Field label="You Allow Penarty?" className="col-lg-4 col-6" error={fieldError("penart")}>
        {select("penart", "Select", yesNoOptions)}
      </Field>
      <Field label="Aprove status" className="col-lg-4 col-6" error={fieldError("aprove_status")}>
        {select("aprove_status", "Select", levels)}
      </Field>
      <Field label="Topup percent(%)" className="col-lg-4 col-6" error={fieldError("topup_percent")}>
        <input className="form-control" placeholder="topup percent" value={form.topup_percent} onChange={set("topup_percent")} required />
      </Field>
      <Field label="Take home Percent(%)" className="col-lg-4 col-6" error={fieldError("take_home_percent")}>
        <input className="form-control" placeholder="Take home percent" value={form.take_home_percent} onChange={set("take_home_percent")} required />
      </Field>
      <Field label="Types of loans" className="col-lg-4 col-6" error={fieldError("main_id")}>
        {select("main_id", "Select", mains)}
      </Field>
      <Field label="Requires E-Mandate? (Bank deduction)" required className="col-lg-4 col-6" error={fieldError("requires_mandate")}>
        {select("requires_mandate", "Select", yesNoOptions)}
      </Field>
      <div className="col-lg-8 mb-2">
        <span>Allowed Customer Categories:</span>
        <div className="d-flex flex-wrap">
          {customerCategories.map((option) => (
            <label key={option.value} className="fancy-checkbox mr-3 mb-0">
              <input type="checkbox" checked={form.customer_category_ids.includes(Number(option.value))} onChange={() => toggleCategory(Number(option.value))} /> <span>{option.label}</span>
            </label>
          ))}
        </div>
        {fieldError("customer_category_ids.0") && <div className="field-error">{fieldError("customer_category_ids.0")}</div>}
      </div>
    </div>
  );
}
