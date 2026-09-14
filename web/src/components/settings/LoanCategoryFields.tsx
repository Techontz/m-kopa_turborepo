"use client";

import { Field } from "@/components/ui/Field";
import type { Option } from "@/components/ui/SelectBox";
import { useApi } from "@/lib/hooks";

import { CUSTOMER_TYPE_SELECT_LABEL, MAIN_CATEGORY_OPTIONS_ENDPOINT } from "./loanHierarchy";

export interface LoanCategory {
  id: number;
  name: string;
  main_category_id: number;
  /** Main loan category name = its customer type's name. */
  main_category: string | null;
  customer_type?: { id: number; code: string | null; name: string } | null;
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
  /** Re-borrowing freeze length in days (0 = no freeze). */
  freeze_time_days: number;
  take_home_percent: number;
  fee_type: "money" | "percentage";
  fee_value: number;
  insurance: number;
  branches?: { id: number; name: string }[];
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
  freeze_time_days: string;
  take_home_percent: string;
  /** The main loan category, chosen by customer type. */
  main_category_id: string;
}

export const EMPTY_LOAN_CATEGORY: LoanCategoryForm = {
  loan_name: "", loan_price: "", loan_perday: "", interest_formular: "", formular: "", duration: "", from_repayment: "", to_repayment: "",
  fee_deduct: "", penart: "", aprove_status: "", requires_mandate: "", topup_percent: "", freeze_time_days: "", take_home_percent: "", main_category_id: "",
};

const yesNo = (value: boolean) => (value ? "YES" : "NO");

export const FREEZE_TIME_HELP =
  "Number of days, counted from the loan's disbursement date, during which a customer who fully settles the loan before its scheduled completion date cannot take another loan. 0 = no freeze.";

/** "Freeze Time: 30 Days" / "No freeze". */
export function freezeTimeLabel(days: number | null | undefined): string {
  const value = Number(days ?? 0);
  return value > 0 ? `Freeze Time: ${value} ${value === 1 ? "Day" : "Days"}` : "No freeze";
}

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
    freeze_time_days: String(category.freeze_time_days ?? 0),
    take_home_percent: String(category.take_home_percent),
    main_category_id: String(category.main_category_id ?? ""),
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
  const { data: mains = [] } = useApi<Option[]>(MAIN_CATEGORY_OPTIONS_ENDPOINT);

  const set = (field: keyof LoanCategoryForm) => (event: { target: { value: string } }) => setForm({ ...form, [field]: event.target.value });
  const select = (field: keyof LoanCategoryForm, placeholder: string, options: Option[]) => (
    <select className="form-control" value={form[field] as string} onChange={set(field)} required>
      {(creating || form[field] === "") && <option value="">{placeholder}</option>}
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
  const yesNoOptions: Option[] = [{ value: "YES", label: "YES" }, { value: "NO", label: "NO" }];

  return (
    <div className="row">
      <Field label={CUSTOMER_TYPE_SELECT_LABEL} required className="col-lg-3" error={fieldError("main_category_id")}>
        {select("main_category_id", "Select Customer Type", mains)}
      </Field>
      <Field label="Loan Category Name:" required className="col-lg-3" error={fieldError("loan_name")}>
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
      <Field label="Interest Formula" required className="col-lg-3" error={fieldError("formular")}>
        {select("formular", "---Select Interest Formula---", formulas)}
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
      <Field label="You Allow Penalty?" className="col-lg-4 col-6" error={fieldError("penart")}>
        {select("penart", "Select", yesNoOptions)}
      </Field>
      <Field label="Approve status" className="col-lg-4 col-6" error={fieldError("aprove_status")}>
        {select("aprove_status", "Select", levels)}
      </Field>
      <Field label="Top-up percent(%)" className="col-lg-4 col-6" error={fieldError("topup_percent")}>
        <input className="form-control" placeholder="top-up percent" value={form.topup_percent} onChange={set("topup_percent")} required />
      </Field>
      <Field label="Freeze Time (Days)" required className="col-lg-4 col-6" error={fieldError("freeze_time_days")}>
        <input
          type="number"
          min={0}
          max={365}
          step={1}
          className="form-control"
          placeholder="0"
          value={form.freeze_time_days}
          onChange={set("freeze_time_days")}
          aria-describedby="freeze-time-help"
          required
        />
        <small id="freeze-time-help" className="form-text text-muted">
          {FREEZE_TIME_HELP}
        </small>
      </Field>
      <Field label="Take home Percent(%)" className="col-lg-4 col-6" error={fieldError("take_home_percent")}>
        <input className="form-control" placeholder="Take home percent" value={form.take_home_percent} onChange={set("take_home_percent")} required />
      </Field>
      <Field label="Requires E-Mandate? (Bank deduction)" required className="col-lg-4 col-6" error={fieldError("requires_mandate")}>
        {select("requires_mandate", "Select", yesNoOptions)}
      </Field>
    </div>
  );
}
