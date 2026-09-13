"use client";

import { useState } from "react";

import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { SelectBox } from "@/components/ui/SelectBox";
import { todayIso } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

import type { CrmOptions, Ticket } from "./types";

interface BaseProps {
  open: boolean;
  onClose: () => void;
  customerId?: number | null;
}

function CustomerSelect({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return <SelectBox inputId="crm-customer" placeholder="Select customer" optionsUrl="options/customers" query={{ with_code: 1 }} value={value} onChange={(next) => onChange(next ?? "")} isDisabled={disabled} />;
}

export function useCrmOptions() {
  return useApi<CrmOptions>("crm/options");
}

interface CallForm {
  customer_id: string;
  direction: string;
  outcome: string;
  phone: string;
  follow_up_date: string;
  notes: string;
}

/** CRM → Record Call (incoming call received or outgoing call made). */
export function RecordCallModal(props: BaseProps) {
  return props.open ? <RecordCallModalBody {...props} /> : null;
}

function RecordCallModalBody({ open, onClose, customerId }: BaseProps) {
  const { data: options } = useCrmOptions();
  const empty: CallForm = { customer_id: customerId ? String(customerId) : "", direction: "outgoing", outcome: "", phone: "", follow_up_date: "", notes: "" };
  const [form, setForm] = useState<CallForm>(empty);
  const save = useAction<CallForm>("post", "crm/calls");


  return (
    <Modal open={open} onClose={onClose} title="Record Call" size="lg" submitLabel="Save" submitting={save.isPending} onSubmit={() => save.mutate(form, { onSuccess: onClose })}>
      <div className="row">
        <Field label="Customer:" required className="col-md-6" error={save.fieldError("customer_id")}>
          <CustomerSelect value={form.customer_id} onChange={(value) => setForm({ ...form, customer_id: value })} disabled={Boolean(customerId)} />
        </Field>
        <Field label="Call Type:" required className="col-md-3" error={save.fieldError("direction")}>
          <select className="form-control" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })} required>
            {options?.directions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Field>
        <Field label="Outcome:" required className="col-md-3" error={save.fieldError("outcome")}>
          <select className="form-control" value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} required>
            <option value="">select</option>
            {options?.outcomes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Field>
        <Field label="Phone Number:" className="col-md-6" error={save.fieldError("phone")}>
          <input className="form-control" placeholder="Customer phone (default)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Next Follow-up Date:" className="col-md-6" error={save.fieldError("follow_up_date")}>
          <input type="date" className="form-control" min={todayIso()} value={form.follow_up_date} onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })} />
        </Field>
        <Field label="Notes:" className="col-md-12" error={save.fieldError("notes")}>
          <textarea className="form-control" rows={3} placeholder="What was discussed" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

interface SmsForm {
  customer_id: string;
  message: string;
  follow_up_date: string;
}

/** CRM → Send SMS to one customer. */
export function SendSmsModal(props: BaseProps) {
  return props.open ? <SendSmsModalBody {...props} /> : null;
}

function SendSmsModalBody({ open, onClose, customerId }: BaseProps) {
  const empty: SmsForm = { customer_id: customerId ? String(customerId) : "", message: "", follow_up_date: "" };
  const [form, setForm] = useState<SmsForm>(empty);
  const send = useAction<SmsForm>("post", "crm/sms");


  return (
    <Modal open={open} onClose={onClose} title="Send SMS" submitLabel="Send" submitting={send.isPending} onSubmit={() => send.mutate(form, { onSuccess: onClose })}>
      <div className="row">
        <Field label="Customer:" required className="col-md-12" error={send.fieldError("customer_id")}>
          <CustomerSelect value={form.customer_id} onChange={(value) => setForm({ ...form, customer_id: value })} disabled={Boolean(customerId)} />
        </Field>
        <Field label="Message:" required className="col-md-12" error={send.fieldError("message")}>
          <textarea className="form-control" rows={4} maxLength={480} placeholder="Write message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
          <small className="text-muted">{form.message.length}/480</small>
        </Field>
        <Field label="Next Follow-up Date:" className="col-md-12" error={send.fieldError("follow_up_date")}>
          <input type="date" className="form-control" min={todayIso()} value={form.follow_up_date} onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

interface BulkForm {
  branch_id: string;
  customer_status: string;
  message: string;
}

/** CRM → Bulk SMS to the customers of a branch filtered by status. */
export function BulkSmsModal({ open, onClose }: Omit<BaseProps, "customerId">) {
  const { data: options } = useCrmOptions();
  const [form, setForm] = useState<BulkForm>({ branch_id: "", customer_status: "all", message: "" });
  const send = useAction<BulkForm>("post", "crm/sms/bulk");

  return (
    <Modal open={open} onClose={onClose} title="Bulk SMS" submitLabel="Send" submitting={send.isPending} onSubmit={() => send.mutate(form, { onSuccess: () => { setForm({ branch_id: "", customer_status: "all", message: "" }); onClose(); } })}>
      <div className="row">
        <Field label="Branch:" required className="col-md-6" error={send.fieldError("branch_id")}>
          <SelectBox inputId="bulk-branch" placeholder="Select Branch" optionsUrl="options/branches" query={{ with_all: 1 }} value={form.branch_id} onChange={(value) => setForm({ ...form, branch_id: value ?? "" })} />
        </Field>
        <Field label="Customer Status:" required className="col-md-6" error={send.fieldError("customer_status")}>
          <select className="form-control" value={form.customer_status} onChange={(e) => setForm({ ...form, customer_status: e.target.value })}>
            {options?.customer_statuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Field>
        <Field label="Message:" required className="col-md-12" error={send.fieldError("message")}>
          <textarea className="form-control" rows={4} maxLength={480} placeholder="Write message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
          <small className="text-muted">{form.message.length}/480</small>
        </Field>
      </div>
    </Modal>
  );
}

interface TicketForm {
  customer_id: string;
  category: string;
  channel: string;
  priority: string;
  subject: string;
  description: string;
  assigned_to: string;
}

/** CRM → register a customer report / complaint. */
export function TicketModal(props: BaseProps) {
  return props.open ? <TicketModalBody {...props} /> : null;
}

function TicketModalBody({ open, onClose, customerId }: BaseProps) {
  const { data: options } = useCrmOptions();
  const empty: TicketForm = { customer_id: customerId ? String(customerId) : "", category: "", channel: "call", priority: "normal", subject: "", description: "", assigned_to: "" };
  const [form, setForm] = useState<TicketForm>(empty);
  const save = useAction<TicketForm>("post", "crm/tickets");


  return (
    <Modal open={open} onClose={onClose} title="Customer Report" size="lg" submitLabel="Save" submitting={save.isPending} onSubmit={() => save.mutate(form, { onSuccess: onClose })}>
      <div className="row">
        <Field label="Customer:" required className="col-md-6" error={save.fieldError("customer_id")}>
          <CustomerSelect value={form.customer_id} onChange={(value) => setForm({ ...form, customer_id: value })} disabled={Boolean(customerId)} />
        </Field>
        <Field label="Category:" required className="col-md-3" error={save.fieldError("category")}>
          <select className="form-control" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
            <option value="">select</option>
            {options?.categories.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Field>
        <Field label="Received Through:" required className="col-md-3" error={save.fieldError("channel")}>
          <select className="form-control" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
            {options?.channels.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Field>
        <Field label="Subject:" required className="col-md-6" error={save.fieldError("subject")}>
          <input className="form-control" placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
        </Field>
        <Field label="Priority:" required className="col-md-3" error={save.fieldError("priority")}>
          <select className="form-control" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            {options?.priorities.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Field>
        <Field label="Assign To:" className="col-md-3" error={save.fieldError("assigned_to")}>
          <SelectBox inputId="ticket-assignee" placeholder="Select Staff" optionsUrl="options/employees" value={form.assigned_to} onChange={(value) => setForm({ ...form, assigned_to: value ?? "" })} isClearable />
        </Field>
        <Field label="Description:" required className="col-md-12" error={save.fieldError("description")}>
          <textarea className="form-control" rows={4} placeholder="Describe the customer's report" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
        </Field>
      </div>
    </Modal>
  );
}

interface UpdateTicketForm {
  id: number;
  status: string;
  priority: string;
  assigned_to: string;
  resolution: string;
}

/** CRM → update a customer report (status, assignee, resolution). */
export function UpdateTicketModal({ ticket, onClose }: { ticket: Ticket | null; onClose: () => void }) {
  return ticket ? <UpdateTicketBody key={ticket.id} ticket={ticket} onClose={onClose} /> : null;
}

function UpdateTicketBody({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const { data: options } = useCrmOptions();
  const [form, setForm] = useState<UpdateTicketForm>({ id: ticket.id, status: ticket.status, priority: ticket.priority, assigned_to: ticket.assigned_to ? String(ticket.assigned_to) : "", resolution: ticket.resolution ?? "" });
  const update = useAction<UpdateTicketForm>("put", (body) => `crm/tickets/${body.id}`);


  return (
    <Modal open={ticket !== null} onClose={onClose} title={`Customer Report ${ticket?.ticket_number ?? ""}`} size="lg" submitLabel="Update" submitting={update.isPending} onSubmit={() => update.mutate(form, { onSuccess: onClose })}>
      {ticket && (
        <div className="row">
          <div className="col-md-12 mb-3">
            <p className="mb-1"><b>Customer:</b> {ticket.customer?.name} ({ticket.customer?.phone})</p>
            <p className="mb-1"><b>Category:</b> {ticket.category_label} &nbsp; <b>Received Through:</b> {ticket.channel_label}</p>
            <p className="mb-1"><b>Subject:</b> {ticket.subject}</p>
            <p className="mb-0" style={{ whiteSpace: "pre-wrap" }}>{ticket.description}</p>
          </div>
          <Field label="Status:" required className="col-md-4" error={update.fieldError("status")}>
            <select className="form-control" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {options?.statuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="Priority:" required className="col-md-4" error={update.fieldError("priority")}>
            <select className="form-control" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {options?.priorities.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="Assign To:" className="col-md-4" error={update.fieldError("assigned_to")}>
            <SelectBox inputId="ticket-update-assignee" placeholder="Select Staff" optionsUrl="options/employees" value={form.assigned_to} onChange={(value) => setForm({ ...form, assigned_to: value ?? "" })} isClearable />
          </Field>
          <Field label="Resolution:" required={form.status === "resolved" || form.status === "closed"} className="col-md-12" error={update.fieldError("resolution")}>
            <textarea className="form-control" rows={3} placeholder="How the report was handled" value={form.resolution} onChange={(e) => setForm({ ...form, resolution: e.target.value })} />
          </Field>
        </div>
      )}
    </Modal>
  );
}

/** CRM → mark a follow-up reminder as done. */
export function CompleteFollowUpModal({ interactionId, onClose }: { interactionId: number | null; onClose: () => void }) {
  const [notes, setNotes] = useState("");
  const complete = useAction<{ id: number; follow_up_notes: string }>("post", (body) => `crm/follow-ups/${body.id}/complete`);

  return (
    <Modal
      open={interactionId !== null}
      onClose={onClose}
      title="Complete Follow-up"
      submitLabel="Save"
      submitting={complete.isPending}
      onSubmit={() => interactionId && complete.mutate({ id: interactionId, follow_up_notes: notes }, { onSuccess: () => { setNotes(""); onClose(); } })}
    >
      <Field label="Notes:" className="col-md-12 px-0" error={complete.fieldError("follow_up_notes")}>
        <textarea className="form-control" rows={3} placeholder="Result of the follow-up" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
    </Modal>
  );
}

/** Live filter modal: branch (incl. ALL) + From / To. */
export function CrmFilterModal({ open, onClose, onApply }: { open: boolean; onClose: () => void; onApply: (filters: { branch_id: string; from: string; to: string }) => void }) {
  const [form, setForm] = useState({ branch_id: "", from: "", to: "" });

  return (
    <Modal open={open} onClose={onClose} submitLabel="Filter" onSubmit={() => { onApply(form); onClose(); }}>
      <div className="row">
        <Field label="" className="col-md-12">
          <SelectBox inputId="crm-filter-branch" placeholder="Select Branch" optionsUrl="options/branches" query={{ with_all: 1 }} value={form.branch_id} onChange={(value) => setForm({ ...form, branch_id: value ?? "" })} />
        </Field>
        <Field label="From:" className="col-md-6">
          <input type="date" className="form-control" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
        </Field>
        <Field label="To:" className="col-md-6">
          <input type="date" className="form-control" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
