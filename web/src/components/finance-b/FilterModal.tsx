"use client";

import { useState } from "react";

import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { SelectBox } from "@/components/ui/SelectBox";

export interface Filters {
  branch_id?: string;
  from?: string;
  to?: string;
}

interface FilterModalProps {
  open: boolean;
  onClose: () => void;
  onApply: (filters: Filters) => void;
  title?: string;
  submitLabel?: string;
  branchLabel?: string;
  branchPlaceholder?: string;
  /** false = branch only; "optional" = dates not required (live active salary advance filter). */
  dates?: boolean | "optional";
}

/** Live filter modal: branch (with ALL) + optional From / To dates. */
export function FilterModal({ open, onClose, onApply, title = "Filter", submitLabel = "Filter", branchLabel = "Select Branch:", branchPlaceholder = "select", dates = true }: FilterModalProps) {
  const [form, setForm] = useState<Filters>({ branch_id: "", from: "", to: "" });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      submitLabel={submitLabel}
      onSubmit={() => {
        onApply(form);
        onClose();
      }}
    >
      <div className="row clearfix">
        <Field label={branchLabel} className="col-md-12">
          <SelectBox placeholder={branchPlaceholder} optionsUrl="options/branches" query={{ with_all: 1 }} value={form.branch_id} onChange={(value) => setForm({ ...form, branch_id: value ?? "" })} />
        </Field>
        {dates !== false && (
          <>
            <Field label="From" className="col-md-6">
              <input type="date" className="form-control" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} required={dates === true} />
            </Field>
            <Field label="To" className="col-md-6">
              <input type="date" className="form-control" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} required={dates === true} />
            </Field>
          </>
        )}
      </div>
    </Modal>
  );
}

/** Square icon button in a card header (live `btn btn-sm btn-icon btn-pure btn-*`). */
export function HeaderButton({ icon = "icon-magnifier", tone = "primary", onClick, title }: { icon?: string; tone?: "primary" | "info" | "success"; onClick: () => void; title?: string }) {
  return (
    <button type="button" className={`btn btn-sm btn-icon btn-${tone} m-r-5 ml-1`} onClick={onClick} title={title}>
      <i className={icon} />
    </button>
  );
}

export function sum<T>(rows: T[] | undefined, pick: (row: T) => number): number {
  return (rows ?? []).reduce((total, row) => total + (Number(pick(row)) || 0), 0);
}
