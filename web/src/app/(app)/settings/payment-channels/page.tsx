"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction } from "@/components/ui/notify";
import { useAction, useApi } from "@/lib/hooks";

interface PaymentProvider {
  id: number;
  channel: "BANK" | "MNO";
  name: string;
  is_active: boolean;
}

interface ProviderForm {
  channel: "BANK" | "MNO";
  name: string;
  is_active: boolean;
}

const EMPTY: ProviderForm = { channel: "BANK", name: "", is_active: true };

/**
 * Settings → Payment Channels: the few banks and mobile networks the company receives customer payments through. Names only —
 * not the company's fund bank accounts (Bank → Register Account) and not the Master Data bank list used for customers.
 */
export default function PaymentChannelsPage() {
  const { data: providers, isLoading } = useApi<PaymentProvider[]>("settings/payment-providers");
  const [form, setForm] = useState<ProviderForm>(EMPTY);
  const [editing, setEditing] = useState<PaymentProvider | null>(null);
  const [editForm, setEditForm] = useState<ProviderForm>(EMPTY);

  const create = useAction<ProviderForm>("post", "settings/payment-providers");
  const update = useAction<ProviderForm & { id: number }>("put", (body) => `settings/payment-providers/${body.id}`);
  const remove = useAction<{ id: number }>("delete", (body) => `settings/payment-providers/${body.id}`);

  return (
    <>
      <PageHeader crumbs={["Setting", "Payment Channels"]} />

      <Card title="Register Payment Channel">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(form, { onSuccess: () => setForm({ ...EMPTY, channel: form.channel }) }); }}>
          <div className="row">
            <Field label="Channel:" required className="col-md-4" error={create.fieldError("channel")}>
              <select className="form-control" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as ProviderForm["channel"] })}>
                <option value="BANK">BANK</option>
                <option value="MNO">MNO</option>
              </select>
            </Field>
            <Field label={form.channel === "BANK" ? "Bank name:" : "Network name:"} required className="col-md-8" error={create.fieldError("name")}>
              <input className="form-control" placeholder={form.channel === "BANK" ? "e.g. CRDB Bank" : "e.g. M-Pesa"} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
          </div>
          <small className="text-muted d-block">
            Only the banks and networks the company receives customer payments through. These are names for recording payments — not the company&apos;s own bank accounts.
          </small>
          <div className="text-center m-t-20">
            <button type="submit" className="btn btn-primary" disabled={create.isPending}><i className="icon-plus" /> Save</button>
          </div>
        </form>
      </Card>

      <Card title="Payment Channel List">
        <DataTable
          rows={providers}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "channel", header: "Channel" },
            { key: "name", header: "Bank / Network" },
            { key: "is_active", header: "Status", value: (row) => (row.is_active ? "ACTIVE" : "INACTIVE"), render: (row) => <Badge tone={row.is_active ? "success" : "default"}>{row.is_active ? "Active" : "Inactive"}</Badge> },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  <button type="button" className="btn btn-sm btn-icon btn-primary mr-1" onClick={() => { setEditing(row); setEditForm({ channel: row.channel, name: row.name, is_active: row.is_active }); }}><i className="icon-pencil" /></button>
                  <button type="button" className="btn btn-sm btn-icon btn-danger" onClick={async () => (await confirmAction()) && remove.mutate({ id: row.id })}><i className="icon-trash" /></button>
                </>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit Payment Channel"
        submitLabel="Update"
        submitting={update.isPending}
        onSubmit={() => editing && update.mutate({ ...editForm, id: editing.id }, { onSuccess: () => setEditing(null) })}
      >
        <div className="row">
          <Field label="Channel:" required className="col-md-4" error={update.fieldError("channel")}>
            <select className="form-control" value={editForm.channel} onChange={(e) => setEditForm({ ...editForm, channel: e.target.value as ProviderForm["channel"] })}>
              <option value="BANK">BANK</option>
              <option value="MNO">MNO</option>
            </select>
          </Field>
          <Field label="Name:" required className="col-md-8" error={update.fieldError("name")}>
            <input className="form-control" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
          </Field>
          <div className="col-md-12">
            <label className="fancy-checkbox mb-0">
              <input type="checkbox" checked={editForm.is_active} onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })} /> <span>Active (shown when recording payments)</span>
            </label>
          </div>
        </div>
      </Modal>
    </>
  );
}
