"use client";

import { useState, type ReactNode } from "react";

import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { SelectBox } from "@/components/ui/SelectBox";

export interface Filters {
  branch_id?: string;
  from?: string;
  to?: string;
}

/** Live "Filter" modal: branch (incl. ALL) + From / To dates. */
export function FilterModal({ open, onClose, onApply, withBranch = true }: { open: boolean; onClose: () => void; onApply: (filters: Filters) => void; withBranch?: boolean }) {
  const [form, setForm] = useState<Filters>({ branch_id: "", from: "", to: "" });

  return (
    <Modal open={open} onClose={onClose} submitLabel="Filter" onSubmit={() => { onApply(form); onClose(); }}>
      <div className="row">
        {withBranch && (
          <Field label="" className="col-md-12">
            <SelectBox placeholder="Select Branch" optionsUrl="options/branches" query={{ with_all: 1 }} value={form.branch_id} onChange={(value) => setForm({ ...form, branch_id: value ?? "" })} />
          </Field>
        )}
        <Field label="From:" className="col-md-6">
          <input type="date" className="form-control" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} required />
        </Field>
        <Field label="To:" className="col-md-6">
          <input type="date" className="form-control" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} required />
        </Field>
      </div>
    </Modal>
  );
}

/** Small header icon button (live `a.btn.btn-sm.btn-primary`). */
export function HeaderButton({ icon = "icon-magnifier", onClick, title, tone = "primary" }: { icon?: string; onClick: () => void; title?: string; tone?: string }) {
  return (
    <button type="button" className={`btn btn-sm btn-${tone} ml-1`} onClick={onClick} title={title}>
      <i className={icon} />
    </button>
  );
}

/** Branch select + dependent staff select (live "Brach:" / "Staff:" pair). */
export function BranchStaffFields({ branchId, employeeId, onChange, errors, className = "col-lg-6 col-6", branchPlaceholder = "Select Branch" }: {
  branchId: string;
  employeeId: string;
  onChange: (value: { blanch_id: string; empl_id: string }) => void;
  errors: (field: string) => string | undefined;
  className?: string;
  branchPlaceholder?: string;
}) {
  return (
    <>
      <Field label="Branch:" className={className} error={errors("blanch_id")}>
        <SelectBox placeholder={branchPlaceholder} optionsUrl="options/branches" value={branchId} onChange={(value) => onChange({ blanch_id: value ?? "", empl_id: "" })} />
      </Field>
      <Field label="Staff:" className={className} error={errors("empl_id")}>
        <SelectBox placeholder="Select Staff" optionsUrl={branchId ? "options/employees" : undefined} options={branchId ? undefined : []} query={{ branch_id: branchId }} value={employeeId} onChange={(value) => onChange({ blanch_id: branchId, empl_id: value ?? "" })} />
      </Field>
    </>
  );
}

export function sum<T>(rows: T[] | undefined, pick: (row: T) => number): number {
  return (rows ?? []).reduce((total, row) => total + (Number(pick(row)) || 0), 0);
}

export function statusTone(status: string): "success" | "warning" | "danger" | "info" | "primary" {
  switch (status) {
    case "pending":
      return "warning";
    case "approved":
      return "info";
    case "rejected":
    case "blocked":
      return "danger";
    case "done":
    case "paid":
      return "primary";
    default:
      return "success";
  }
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="col-lg-3 col-md-6 col-6">
      <div className="card">
        <div className="body text-center">
          <h5 className="mb-1">{value}</h5>
          <small className="text-muted">{label}</small>
        </div>
      </div>
    </div>
  );
}

export const DURATIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export const SALARY_TYPES = [
  { value: "branch", label: "Branch Staff (Base + Commission)" },
  { value: "zone_manager", label: "Zone Manager (Base + Override)" },
  { value: "hq", label: "HQ Staff (Fixed)" },
];

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}
