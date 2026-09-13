"use client";

import { useQuery } from "@tanstack/react-query";

import { Field } from "@/components/ui/Field";
import { SelectBox, type Option } from "@/components/ui/SelectBox";
import { api } from "@/lib/api";

import { SALARY_TYPES } from "./common";
import type { Staff } from "./types";

export interface StaffFormValues {
  empl_name: string;
  emp_mname: string;
  emp_lname: string;
  empl_no: string;
  date_birth: string;
  empl_email: string;
  blanch_id: string;
  position_id: string;
  username: string;
  empl_sex: string;
  role_id: string;
  zone_id: string;
  password?: string;
  salary?: string;
  salary_type?: string;
  commission_eligible?: boolean;
  payment_method?: string;
  account_name?: string;
  account_number?: string;
}

export const EMPTY_STAFF: StaffFormValues = {
  empl_name: "", emp_mname: "", emp_lname: "", empl_no: "", date_birth: "", empl_email: "", blanch_id: "", position_id: "",
  username: "", empl_sex: "", role_id: "", zone_id: "", password: "", salary: "", salary_type: "", commission_eligible: true, payment_method: "bank", account_name: "", account_number: "",
};

export function staffToForm(staff: Staff): StaffFormValues {
  return {
    empl_name: staff.first_name ?? "", emp_mname: staff.middle_name ?? "", emp_lname: staff.last_name ?? "", empl_no: staff.phone ?? "",
    date_birth: staff.date_of_birth ?? "", empl_email: staff.email ?? "", blanch_id: String(staff.branch_id ?? ""), position_id: staff.position ?? "",
    username: staff.username ?? "", empl_sex: staff.gender ? staff.gender.charAt(0).toUpperCase() + staff.gender.slice(1) : "", role_id: String(staff.role_id ?? ""), zone_id: String(staff.zone_id ?? ""),
  };
}

function age(dateOfBirth: string): string {
  if (!dateOfBirth) {
    return "";
  }
  return String(new Date().getFullYear() - new Date(dateOfBirth).getFullYear());
}

const POSITIONS = [
  { value: "employee", label: "Employee" },
  { value: "hq", label: "Hq" },
  { value: "zone", label: "Zone" },
  { value: "admin", label: "Admin" },
];

/** Register Employee / Basic Information fields (live), plus role, zone and — on registration — login and salary structure. */
export function StaffForm({ form, setForm, fieldError, registering }: { form: StaffFormValues; setForm: (form: StaffFormValues) => void; fieldError: (field: string) => string | undefined; registering?: boolean }) {
  const { data: roles = [] } = useQuery({
    queryKey: ["options", "hrm/options/roles"],
    queryFn: () => api.get<{ data: (Option & { scope: string })[] }>("hrm/options/roles").then((response) => response.data),
  });
  const scope = roles.find((role) => role.value === form.role_id)?.scope;
  const set = (patch: Partial<StaffFormValues>) => setForm({ ...form, ...patch });

  return (
    <div className="row clearfix">
      <Field label="First name:" className="col-lg-4 col-6" error={fieldError("empl_name")}>
        <input className="form-control input-sm" placeholder="Enter first name" value={form.empl_name} onChange={(e) => set({ empl_name: e.target.value })} required />
      </Field>
      <Field label="Middle name:" className="col-lg-4 col-6" error={fieldError("emp_mname")}>
        <input className="form-control input-sm" placeholder="Enter middle name" value={form.emp_mname} onChange={(e) => set({ emp_mname: e.target.value })} required />
      </Field>
      <Field label="Last name:" className="col-lg-4 col-6" error={fieldError("emp_lname")}>
        <input className="form-control input-sm" placeholder="Enter Last name" value={form.emp_lname} onChange={(e) => set({ emp_lname: e.target.value })} required />
      </Field>
      <Field label="Phone Number:" className="col-lg-3 col-6" error={fieldError("empl_no")}>
        <input className="form-control input-sm" placeholder="Phone Number" value={form.empl_no} onChange={(e) => set({ empl_no: e.target.value })} required />
      </Field>
      <Field label="Date of Birth:" className="col-lg-3 col-6" error={fieldError("date_birth")}>
        <input type="date" className="form-control input-sm" value={form.date_birth} onChange={(e) => set({ date_birth: e.target.value })} required />
      </Field>
      <Field label="Year:" className="col-lg-3 col-6">
        <input className="form-control input-sm" placeholder="Year" value={age(form.date_birth)} readOnly />
      </Field>
      <Field label="*Email:" className="col-lg-3 col-6" error={fieldError("empl_email")}>
        <input type="email" className="form-control input-sm" placeholder="Email" value={form.empl_email} onChange={(e) => set({ empl_email: e.target.value })} required />
      </Field>
      <Field label="Role:" className="col-lg-4 col-6" error={fieldError("role_id")}>
        <SelectBox placeholder="Select Role" options={roles} value={form.role_id} onChange={(value) => set({ role_id: value ?? "" })} />
      </Field>
      <Field label="Branch:" className="col-lg-4 col-6" error={fieldError("blanch_id")}>
        <SelectBox placeholder={scope === "branch" || !scope ? "Select Branch" : "Select Branch (optional)"} optionsUrl="options/branches" value={form.blanch_id} onChange={(value) => set({ blanch_id: value ?? "" })} isClearable />
      </Field>
      <Field label="Zone:" className="col-lg-4 col-6" error={fieldError("zone_id")}>
        <SelectBox placeholder="Select Zone" optionsUrl="hrm/options/zones" value={form.zone_id} onChange={(value) => set({ zone_id: value ?? "" })} isDisabled={scope !== "zone"} isClearable />
      </Field>
      <Field label="Position:" className="col-lg-4 col-6" error={fieldError("position_id")}>
        <select className="form-control" value={form.position_id} onChange={(e) => set({ position_id: e.target.value })} required>
          <option value="">Select Position</option>
          {POSITIONS.map((position) => <option key={position.value} value={position.value}>{position.label}</option>)}
        </select>
      </Field>
      <Field label="*Username:" className="col-lg-4 col-6" error={fieldError("username")}>
        <input className="form-control input-sm" placeholder="Enter Username" value={form.username} onChange={(e) => set({ username: e.target.value })} />
      </Field>
      <Field label="*Gender:" className="col-lg-4 col-12" error={fieldError("empl_sex")}>
        <select className="form-control" value={form.empl_sex} onChange={(e) => set({ empl_sex: e.target.value })}>
          <option value="">Select Gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
      </Field>
      {registering && (
        <>
          <div className="col-12"><hr /><h6>Login &amp; Salary</h6></div>
          <Field label="Password:" className="col-lg-4 col-6" error={fieldError("password")}>
            <input type="password" className="form-control input-sm" placeholder="Default: phone number" value={form.password} onChange={(e) => set({ password: e.target.value })} autoComplete="new-password" />
          </Field>
          <Field label="Base Salary:" className="col-lg-4 col-6" error={fieldError("salary")}>
            <input type="number" className="form-control input-sm" placeholder="Enter Amount" value={form.salary} onChange={(e) => set({ salary: e.target.value })} />
          </Field>
          <Field label="Salary Structure:" className="col-lg-4 col-12" error={fieldError("salary_type")}>
            <select className="form-control" value={form.salary_type} onChange={(e) => set({ salary_type: e.target.value, commission_eligible: e.target.value !== "hq" })}>
              <option value="">By role</option>
              {SALARY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </Field>
          <Field label="Commission Eligibility:" className="col-lg-3 col-6">
            <select className="form-control" value={form.commission_eligible ? "1" : "0"} onChange={(e) => set({ commission_eligible: e.target.value === "1" })}>
              <option value="1">Yes</option>
              <option value="0">No</option>
            </select>
          </Field>
          <Field label="Payment Method:" className="col-lg-3 col-6" error={fieldError("payment_method")}>
            <select className="form-control" value={form.payment_method} onChange={(e) => set({ payment_method: e.target.value })}>
              <option value="bank">Bank</option>
              <option value="mobile">Mobile</option>
            </select>
          </Field>
          <Field label="Account Name:" className="col-lg-3 col-6" error={fieldError("account_name")}>
            <input className="form-control input-sm" placeholder="Enter Account Name" value={form.account_name} onChange={(e) => set({ account_name: e.target.value })} />
          </Field>
          <Field label="Account Number:" className="col-lg-3 col-6" error={fieldError("account_number")}>
            <input className="form-control input-sm" placeholder="Enter Account Number" value={form.account_number} onChange={(e) => set({ account_number: e.target.value })} />
          </Field>
        </>
      )}
    </div>
  );
}
