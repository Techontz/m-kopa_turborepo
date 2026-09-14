"use client";

import Link from "next/link";
import { useState } from "react";

import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction } from "@/components/ui/notify";
import { useAuth } from "@/lib/auth";
import { useAction, useApi } from "@/lib/hooks";

interface GroupRow {
  id: number;
  name: string;
  customers_count: number;
}

/** Group → All groups (live admin/group). */
export default function GroupsPage() {
  const { can } = useAuth();
  const { data: groups, isLoading } = useApi<GroupRow[]>("groups");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<GroupRow | null>(null);
  const [name, setName] = useState("");

  const create = useAction<{ group_name: string }>("post", "groups");
  const update = useAction<{ group_name: string; id: number }>("put", (body) => `groups/${body.id}`);
  const remove = useAction<{ id: number }>("delete", (body) => `groups/${body.id}`);
  const canManage = can("groups.manage");

  return (
    <>
      <PageHeader crumbs={["Group", "Group List"]} />

      <Card
        title="Group List"
        actions={canManage && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { setName(""); setCreateOpen(true); }}><i className="icon-plus" /></button>
        )}
      >
        <DataTable
          rows={groups}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/NO.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "name", header: "Group Name", render: (row) => row.name.toUpperCase() },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  {canManage && (
                    <button type="button" className="btn btn-sm btn-icon btn-primary mr-1" onClick={() => { setEditing(row); setName(row.name); }}><i className="icon-pencil" /></button>
                  )}
                  <Link href={`/groups/${row.id}`} className="btn btn-sm btn-icon btn-info mr-1"><i className="icon-eye" /></Link>
                  {can("groups.manage") && (
                    <button type="button" className="btn btn-sm btn-icon btn-danger" onClick={async () => (await confirmAction()) && remove.mutate({ id: row.id })}><i className="icon-trash" /></button>
                  )}
                </>
              ),
            },
          ]}
        />
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Register Group" submitLabel="Save" submitting={create.isPending} onSubmit={() => create.mutate({ group_name: name }, { onSuccess: () => setCreateOpen(false) })}>
        <Field label="Group Name" required className="col-md-12 px-0" error={create.fieldError("group_name")}>
          <input className="form-control" placeholder="Enter Group Name" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Edit Group" submitLabel="Update" submitting={update.isPending} onSubmit={() => editing && update.mutate({ group_name: name, id: editing.id }, { onSuccess: () => setEditing(null) })}>
        <Field label="Group Name" required className="col-md-12 px-0" error={update.fieldError("group_name")}>
          <input className="form-control" placeholder="Enter Group Name" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
      </Modal>
    </>
  );
}
