"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { confirmAction } from "@/components/ui/notify";
import { useAction, useApi } from "@/lib/hooks";

interface Branch {
  id: number;
  name: string;
  phone: string;
  type: "main" | "sub";
  status: string;
  region_id: number | null;
  region: string | null;
  zone_id: number | null;
  zone: string | null;
  customer_counts: { active: number; pending: number; default: number; done: number; all: number };
}

interface BranchForm {
  blanch_name: string;
  region_id: string;
  blanch_no: string;
  branch_type: string;
  zone_id: string;
}

const EMPTY: BranchForm = { blanch_name: "", region_id: "", blanch_no: "", branch_type: "", zone_id: "" };

function BranchFields({ form, setForm, fieldError }: { form: BranchForm; setForm: (form: BranchForm) => void; fieldError: (field: string) => string | undefined }) {
  return (
    <>
      <Field label=" Branch name:" required className="col-md-3" error={fieldError("blanch_name")}>
        <input className="form-control" placeholder="Branch name" value={form.blanch_name} onChange={(e) => setForm({ ...form, blanch_name: e.target.value })} required />
      </Field>
      <Field label=" Branch region:" required className="col-md-3" error={fieldError("region_id")}>
        <SelectBox placeholder="Select Region" optionsUrl="options/regions" value={form.region_id} onChange={(value) => setForm({ ...form, region_id: value ?? "" })} />
      </Field>
      <Field label=" Branch Phone Number:" required className="col-md-3" error={fieldError("blanch_no")}>
        <input type="number" className="form-control" placeholder="Branch phone number" value={form.blanch_no} onChange={(e) => setForm({ ...form, blanch_no: e.target.value })} required />
      </Field>
      <Field label=" Branch Type:" required className="col-md-3" error={fieldError("branch_type")}>
        <select className="form-control" value={form.branch_type} onChange={(e) => setForm({ ...form, branch_type: e.target.value })} required>
          <option value="">select</option>
          <option value="main">Main Branch</option>
          <option value="sub">Sub Branch</option>
        </select>
      </Field>
    </>
  );
}

export default function BranchesPage() {
  const { data: branches, isLoading } = useApi<Branch[]>("settings/branches");
  const [form, setForm] = useState<BranchForm>(EMPTY);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [editForm, setEditForm] = useState<BranchForm>(EMPTY);

  const create = useAction<BranchForm>("post", "settings/branches");
  const update = useAction<BranchForm & { id: number }>("put", (body) => `settings/branches/${body.id}`);
  const remove = useAction<{ id: number }>("delete", (body) => `settings/branches/${body.id}`);

  const openEdit = (branch: Branch) => {
    setEditing(branch);
    setEditForm({ blanch_name: branch.name, region_id: String(branch.region_id ?? ""), blanch_no: branch.phone, branch_type: branch.type, zone_id: String(branch.zone_id ?? "") });
  };

  return (
    <>
      <PageHeader crumbs={["Branch"]} />

      <Card title="Register Branch">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(form, { onSuccess: () => setForm(EMPTY) }); }}>
          <div className="row">
            <BranchFields form={form} setForm={setForm} fieldError={create.fieldError} />
          </div>
          <div className="text-center m-t-20">
            <button type="submit" className="btn btn-primary" disabled={create.isPending}><i className="icon-plus" />Save</button>
          </div>
        </form>
      </Card>

      <Card title="Branch List">
        <DataTable
          rows={branches}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "name", header: "Branch Name" },
            { key: "phone", header: "Branch Phone Number" },
            { key: "region", header: "Branch region" },
            {
              key: "customers",
              header: "Customer Status",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  Active: <Badge tone="success">{row.customer_counts.active}</Badge> Pending: <Badge tone="warning">{row.customer_counts.pending}</Badge>{" "}
                  Default: <Badge tone="danger">{row.customer_counts.default}</Badge> Done: <Badge tone="info">{row.customer_counts.done}</Badge> All:: <Badge tone="dark">{row.customer_counts.all}</Badge>
                </>
              ),
            },
            { key: "type", header: "Branch type", render: (row) => (row.type === "main" ? "MAIN BRANCH" : "SUB-BRANCH") },
            { key: "status", header: "status", render: (row) => <Badge tone="success">{row.status.toUpperCase()}</Badge> },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  <button type="button" className="btn btn-sm btn-icon btn-primary mr-1" onClick={() => openEdit(row)}><i className="icon-pencil" /></button>
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
        title="Edit Branch"
        size="lg"
        submitLabel="Update"
        submitting={update.isPending}
        onSubmit={() => editing && update.mutate({ ...editForm, id: editing.id }, { onSuccess: () => setEditing(null) })}
      >
        <div className="row">
          <BranchFields form={editForm} setForm={setEditForm} fieldError={update.fieldError} />
        </div>
      </Modal>
    </>
  );
}
