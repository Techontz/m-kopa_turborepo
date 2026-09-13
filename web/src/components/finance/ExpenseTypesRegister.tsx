"use client";

import { useState } from "react";

import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction } from "@/components/ui/notify";
import { useAuth } from "@/lib/auth";
import { useAction, useApi } from "@/lib/hooks";

import { HeaderButton } from "./FilterModal";
import type { ExpenseScope, ExpenseType } from "./types";

interface Props {
  scope: ExpenseScope;
  crumbs: string[];
  title: string;
  /** Live input name of the expense name field (ex_name / exp_desc / expenses_name). */
  field: "ex_name" | "exp_desc" | "expenses_name";
  managePermission: string | string[];
  children?: React.ReactNode;
}

/** Expense category register shared by Register Branch Expenses, HQ Register Expenses and Register Bank Expenses. */
export function ExpenseTypesRegister({ scope, crumbs, title, field, managePermission, children }: Props) {
  const { can } = useAuth();
  const { data: types, isLoading } = useApi<ExpenseType[]>("expenses/types", { scope });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ExpenseType | null>(null);
  const [name, setName] = useState("");

  const create = useAction<Record<string, string>>("post", "expenses/types");
  const update = useAction<{ id: number; [key: string]: string | number }>("put", (body) => `expenses/types/${body.id}`);
  const remove = useAction<{ id: number }>("delete", (body) => `expenses/types/${body.id}`);
  const canManage = can(managePermission);

  return (
    <>
      <PageHeader crumbs={crumbs} />
      {children}
      <Card title={title} actions={canManage && <HeaderButton icon="icon-plus" onClick={() => { setName(""); setCreating(true); }} />}>
        <DataTable
          rows={types}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "name", header: "Expenses" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) =>
                canManage && (
                  <>
                    <button type="button" className="btn btn-sm btn-icon btn-primary mr-1" onClick={() => { setName(row.name); setEditing(row); }}><i className="icon-pencil" /></button>
                    <button type="button" className="btn btn-sm btn-icon btn-danger" onClick={async () => (await confirmAction()) && remove.mutate({ id: row.id })}><i className="icon-trash" /></button>
                  </>
                ),
            },
          ]}
        />
      </Card>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Register Expenses"
        submitLabel="Save"
        submitting={create.isPending}
        onSubmit={() => create.mutate({ scope, [field]: name }, { onSuccess: () => setCreating(false) })}
      >
        <Field label="Expenses:" required className="col-md-12" error={create.fieldError(field)}>
          <input className="form-control" placeholder="Enter Expenses" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Update Expenses"
        submitLabel="Update"
        submitting={update.isPending}
        onSubmit={() => editing && update.mutate({ id: editing.id, [field]: name }, { onSuccess: () => setEditing(null) })}
      >
        <Field label="Expenses:" required className="col-md-12" error={update.fieldError(field)}>
          <input className="form-control" placeholder="Enter Expenses" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
      </Modal>
    </>
  );
}
