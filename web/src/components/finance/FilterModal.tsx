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
  /** Show the "Select Branch" dropdown (with ALL). */
  withBranch?: boolean;
  withDates?: boolean;
  branchPlaceholder?: string;
}

/** Live "Filter" modal: branch (incl. ALL) + From / To dates, Filter + CLOSE buttons. */
export function FilterModal({ open, onClose, onApply, withBranch = false, withDates = true, branchPlaceholder = "Select Branch" }: FilterModalProps) {
  const [form, setForm] = useState<Filters>({ branch_id: "", from: "", to: "" });

  return (
    <Modal
      open={open}
      onClose={onClose}
      submitLabel="Filter"
      onSubmit={() => {
        onApply(form);
        onClose();
      }}
    >
      <div className="row">
        {withBranch && (
          <Field label="" className="col-md-12">
            <SelectBox placeholder={branchPlaceholder} optionsUrl="options/branches" query={{ with_all: 1 }} value={form.branch_id} onChange={(value) => setForm({ ...form, branch_id: value ?? "" })} />
          </Field>
        )}
        {withDates && (
          <>
            <Field label="From:" className="col-md-6">
              <input type="date" className="form-control" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} required />
            </Field>
            <Field label="To:" className="col-md-6">
              <input type="date" className="form-control" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} required />
            </Field>
          </>
        )}
      </div>
    </Modal>
  );
}

/** Round blue header button that opens a modal (live `a.btn.btn-primary` with an icon). */
export function HeaderButton({ icon = "icon-magnifier", onClick, title }: { icon?: string; onClick: () => void; title?: string }) {
  return (
    <button type="button" className="btn btn-primary" onClick={onClick} title={title}>
      <i className={icon} />
    </button>
  );
}

/** Sum a numeric field of the rows. */
export function sum<T>(rows: T[] | undefined, pick: (row: T) => number): number {
  return (rows ?? []).reduce((total, row) => total + (Number(pick(row)) || 0), 0);
}
