"use client";

import { useState } from "react";

import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { SelectBox } from "@/components/ui/SelectBox";
import { todayIso } from "@/lib/format";

export interface DateFilters {
  branch_id?: string;
  from: string;
  to: string;
}

interface DateFilterModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onApply: (filters: DateFilters) => void;
  withBranch?: boolean;
}

/** Live float filter modals ("Filter Transaction by" / "Filter By"): optional branch + From / To, Filter + CLOSE. */
export function DateFilterModal({ open, title, onClose, onApply, withBranch = false }: DateFilterModalProps) {
  const [form, setForm] = useState<DateFilters>({ branch_id: "", from: todayIso(), to: todayIso() });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      submitLabel="Filter"
      onSubmit={() => {
        onApply(form);
        onClose();
      }}
    >
      <div className="row">
        {withBranch && (
          <Field label="Select Branch" className="col-md-12">
            <SelectBox placeholder="---Select Branch---" optionsUrl="options/branches" value={form.branch_id} onChange={(value) => setForm({ ...form, branch_id: value ?? "" })} />
          </Field>
        )}
        <Field label="From" required className="col-md-6">
          <input type="date" className="form-control" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} required />
        </Field>
        <Field label="To" required className="col-md-6">
          <input type="date" className="form-control" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} required />
        </Field>
      </div>
    </Modal>
  );
}

export interface FloatTransfer {
  id: number;
  type: string;
  from_branch: string | null;
  to_branch: string | null;
  from_account: string | null;
  to_account: string | null;
  amount: number;
  status: "pending" | "approved";
  date: string;
}

/** Sum of transfer amounts (live table footer TOTAL). */
export function totalAmount(rows: FloatTransfer[] | undefined): number {
  return (rows ?? []).reduce((total, row) => total + Number(row.amount || 0), 0);
}
