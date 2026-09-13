"use client";

import { useState } from "react";
import Select from "react-select";

import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { SelectBox } from "@/components/ui/SelectBox";
import { useAction } from "@/lib/hooks";

import type { ContactsResponse } from "./types";

type Created = { message: string; data: { id: number } };

interface ModalProps {
  open: boolean;
  onClose: () => void;
  contacts: ContactsResponse | undefined;
  onCreated: (conversationId: number) => void;
}

/** Messages → New Message (only employees allowed by position / branch / zone are listed). */
export function NewMessageModal({ open, onClose, contacts, onCreated }: ModalProps) {
  const [form, setForm] = useState({ employee_id: "", body: "" });
  const send = useAction<typeof form, Created>("post", "messages/conversations");
  const options = (contacts?.data ?? []).map((contact) => ({ value: contact.value, label: contact.is_head ? `${contact.label} — HEAD` : contact.label }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Message"
      submitLabel="Send"
      submitting={send.isPending}
      onSubmit={() => send.mutate(form, { onSuccess: (result) => { setForm({ employee_id: "", body: "" }); onCreated(result.data.id); onClose(); } })}
    >
      <div className="row">
        <Field label="To:" required className="col-md-12" error={send.fieldError("employee_id")}>
          <SelectBox inputId="chat-to" placeholder="Select Staff" options={options} value={form.employee_id} onChange={(value) => setForm({ ...form, employee_id: value ?? "" })} />
          {contacts?.level === "staff" && <small className="text-muted">Your messages go to your specific head.</small>}
        </Field>
        <Field label="Message:" required className="col-md-12" error={send.fieldError("body")}>
          <textarea className="form-control" rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
        </Field>
      </div>
    </Modal>
  );
}

/** Messages → Create Group (heads only; members limited to the allowed branch / zone). */
export function GroupModal({ open, onClose, contacts, onCreated }: ModalProps) {
  const [form, setForm] = useState<{ name: string; employee_ids: string[]; body: string }>({ name: "", employee_ids: [], body: "" });
  const save = useAction<typeof form, Created>("post", "messages/groups");
  const options = contacts?.data ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Group"
      size="lg"
      submitLabel="Save"
      submitting={save.isPending}
      onSubmit={() => save.mutate(form, { onSuccess: (result) => { setForm({ name: "", employee_ids: [], body: "" }); onCreated(result.data.id); onClose(); } })}
    >
      <div className="row">
        <Field label="Group Name:" required className="col-md-12" error={save.fieldError("name")}>
          <input className="form-control" placeholder="Group name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <Field label="Members:" required className="col-md-12" error={save.fieldError("employee_ids") ?? save.fieldError("employee_ids.0")}>
          <Select
            instanceId="chat-group-members"
            isMulti
            className="mf-select"
            classNamePrefix="mf-select"
            options={options}
            value={options.filter((option) => form.employee_ids.includes(option.value))}
            onChange={(selected) => setForm({ ...form, employee_ids: selected.map((option) => option.value) })}
            placeholder="Select Staff"
          />
        </Field>
        <Field label="First Message:" className="col-md-12" error={save.fieldError("body")}>
          <textarea className="form-control" rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

/** Messages → Broadcast to a branch, zone or all staff. */
export function BroadcastModal({ open, onClose, contacts, onCreated }: ModalProps) {
  const [form, setForm] = useState({ audience: "", body: "" });
  const send = useAction<typeof form, Created>("post", "messages/broadcasts");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Broadcast"
      submitLabel="Send"
      submitting={send.isPending}
      onSubmit={() => send.mutate(form, { onSuccess: (result) => { setForm({ audience: "", body: "" }); onCreated(result.data.id); onClose(); } })}
    >
      <div className="row">
        <Field label="Send To:" required className="col-md-12" error={send.fieldError("audience")}>
          <SelectBox inputId="chat-audience" placeholder="Select branch / zone" options={contacts?.audiences ?? []} value={form.audience} onChange={(value) => setForm({ ...form, audience: value ?? "" })} />
        </Field>
        <Field label="Message:" required className="col-md-12" error={send.fieldError("body")}>
          <textarea className="form-control" rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
        </Field>
      </div>
    </Modal>
  );
}
