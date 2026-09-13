"use client";

import { useState } from "react";

import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { SelectBox } from "@/components/ui/SelectBox";
import { todayIso } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface TransactionForm {
  blanch_id: string;
  mode_id: string;
  agent: string;
  amount: string;
  date: string;
  time: string;
}

/** Live admin/create_miamala "Record Transaction" modal. */
export function AgentTransactionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const empty: TransactionForm = { blanch_id: "", mode_id: "", agent: "", amount: "", date: todayIso(), time: "" };
  const [form, setForm] = useState<TransactionForm>(empty);
  const { data: modes } = useApi<Array<{ id: number; name: string }>>(open ? "agent/payment-modes" : null);
  const create = useAction<TransactionForm>("post", "agent/transactions");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record Transaction"
      submitLabel="save"
      submitting={create.isPending}
      onSubmit={() => create.mutate(form, { onSuccess: () => { setForm(empty); onClose(); } })}
    >
      <div className="row clearfix">
        <Field label="Branch" className="col-md-6" error={create.fieldError("blanch_id")}>
          <SelectBox placeholder="select" optionsUrl="options/branches" value={form.blanch_id} onChange={(value) => setForm({ ...form, blanch_id: value ?? "" })} />
        </Field>
        <Field label="Mode of payment" className="col-md-6" error={create.fieldError("mode_id")}>
          <select className="form-control" value={form.mode_id} onChange={(e) => setForm({ ...form, mode_id: e.target.value })} required>
            <option value="">select</option>
            {(modes ?? []).map((mode) => (
              <option key={mode.id} value={mode.id}>{mode.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Agent Name" className="col-md-6" error={create.fieldError("agent")}>
          <input type="text" className="form-control" placeholder="Enter agent" autoComplete="off" value={form.agent} onChange={(e) => setForm({ ...form, agent: e.target.value })} required />
        </Field>
        <Field label="Amount" className="col-md-6" error={create.fieldError("amount")}>
          <input type="number" className="form-control" placeholder="Enter Amount" autoComplete="off" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
        </Field>
        <Field label="Date" className="col-md-6" error={create.fieldError("date")}>
          <input type="date" className="form-control" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
        </Field>
        <Field label="Time" className="col-md-6" error={create.fieldError("time")}>
          <input type="time" className="form-control" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required />
        </Field>
      </div>
    </Modal>
  );
}
