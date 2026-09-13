"use client";

import { useState } from "react";

import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { SelectBox, type Option } from "@/components/ui/SelectBox";

export interface PaymentFilters {
  branch_id?: string;
  zone_id?: string;
  status?: string;
  from?: string;
  to?: string;
}

interface PaymentFilterModalProps {
  open: boolean;
  onClose: () => void;
  onApply: (filters: PaymentFilters) => void;
  withZone?: boolean;
  withDates?: boolean;
  statuses?: Option[];
}

/** Live filter modal (branch incl. ALL, From / To) extended with Zone and Status (handwritten note: filter by branch / date / zone). */
export function PaymentFilterModal({ open, onClose, onApply, withZone = false, withDates = true, statuses }: PaymentFilterModalProps) {
  const [form, setForm] = useState<PaymentFilters>({});

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
        <Field label="" className="col-md-12">
          <SelectBox placeholder="Select Branch" optionsUrl="options/branches" query={{ with_all: 1 }} value={form.branch_id} onChange={(value) => setForm({ ...form, branch_id: value ?? "" })} />
        </Field>
        {withZone && (
          <Field label="" className="col-md-12">
            <SelectBox placeholder="Select Zone" optionsUrl="payments/zone-options" value={form.zone_id} onChange={(value) => setForm({ ...form, zone_id: value ?? "" })} />
          </Field>
        )}
        {statuses && (
          <Field label="" className="col-md-12">
            <select className="form-control" value={form.status ?? ""} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="">Select status</option>
              {statuses.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </Field>
        )}
        {withDates && (
          <>
            <Field label="From:" className="col-md-6">
              <input type="date" className="form-control" value={form.from ?? ""} onChange={(e) => setForm({ ...form, from: e.target.value })} />
            </Field>
            <Field label="To:" className="col-md-6">
              <input type="date" className="form-control" value={form.to ?? ""} onChange={(e) => setForm({ ...form, to: e.target.value })} />
            </Field>
          </>
        )}
      </div>
    </Modal>
  );
}

export function SearchButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="btn btn-primary" onClick={onClick}>
      <i className="icon-magnifier" />
    </button>
  );
}

export function total<T>(rows: T[] | undefined, pick: (row: T) => number): number {
  return (rows ?? []).reduce((sum, row) => sum + (Number(pick(row)) || 0), 0);
}
