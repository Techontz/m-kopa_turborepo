"use client";

import { useState } from "react";

import { HeaderButton } from "@/components/finance/FilterModal";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction } from "@/components/ui/notify";
import { useAction, useApi } from "@/lib/hooks";

interface BankAccount {
  id: number;
  name: string;
}

interface AccountForm {
  id?: number;
  ac_name: string;
  opening_balance?: string;
}

export default function BankAccountsPage() {
  const { data: accounts, isLoading } = useApi<BankAccount[]>("bank/accounts");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [form, setForm] = useState<AccountForm>({ ac_name: "", opening_balance: "" });

  const create = useAction<AccountForm>("post", "bank/accounts");
  const update = useAction<AccountForm>("put", (body) => `bank/accounts/${body.id}`);
  const remove = useAction<{ id: number }>("delete", (body) => `bank/accounts/${body.id}`);

  return (
    <>
      <PageHeader crumbs={["Bank", "Register Account"]} />
      <Card title="Account List" actions={<HeaderButton icon="icon-plus" onClick={() => { setForm({ ac_name: "", opening_balance: "" }); setCreating(true); }} />}>
        <DataTable
          rows={accounts}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "name", header: "Account Name" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  <button type="button" className="btn btn-sm btn-icon btn-primary mr-1" onClick={() => { setForm({ id: row.id, ac_name: row.name }); setEditing(row); }}><i className="icon-pencil" /></button>
                  <button type="button" className="btn btn-sm btn-icon btn-danger" onClick={async () => (await confirmAction()) && remove.mutate({ id: row.id })}><i className="icon-trash" /></button>
                </>
              ),
            },
          ]}
        />
      </Card>

      <Modal open={creating} onClose={() => setCreating(false)} title="Register Account" submitLabel="Save" submitting={create.isPending} onSubmit={() => create.mutate(form, { onSuccess: () => setCreating(false) })}>
        <div className="row">
          <Field label="Account Name:" required className="col-md-12" error={create.fieldError("ac_name")}>
            <input className="form-control" placeholder="Enter Account name" value={form.ac_name} onChange={(e) => setForm({ ...form, ac_name: e.target.value })} required />
          </Field>
          <Field label="Opening Balance:" className="col-md-12" error={create.fieldError("opening_balance")}>
            <input type="number" min={0} className="form-control" placeholder="Enter Opening Balance" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Update Account" submitLabel="Update" submitting={update.isPending} onSubmit={() => update.mutate(form, { onSuccess: () => setEditing(null) })}>
        <Field label="Account Name:" required className="col-md-12" error={update.fieldError("ac_name")}>
          <input className="form-control" placeholder="Enter Account name" value={form.ac_name} onChange={(e) => setForm({ ...form, ac_name: e.target.value })} required />
        </Field>
      </Modal>
    </>
  );
}
