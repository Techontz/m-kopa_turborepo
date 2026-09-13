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

interface Zone {
  id: number;
  name: string;
  branches: { id: number; name: string }[];
  managers: { id: number; name: string }[];
}

interface Branch {
  id: number;
  name: string;
  zone_id: number | null;
  zone: string | null;
}

interface ZoneForm {
  zone_name: string;
  branch_ids: number[];
}

const EMPTY: ZoneForm = { zone_name: "", branch_ids: [] };

/** Branch checkboxes; branches already in another zone show that zone's name. */
function BranchChecklist({ branches, form, setForm, zoneId }: { branches: Branch[]; form: ZoneForm; setForm: (form: ZoneForm) => void; zoneId: number | null }) {
  const toggle = (id: number) =>
    setForm({ ...form, branch_ids: form.branch_ids.includes(id) ? form.branch_ids.filter((item) => item !== id) : [...form.branch_ids, id] });

  return (
    <div className="row">
      {branches.map((branch) => (
        <div key={branch.id} className="col-md-4 mb-1">
          <label className="fancy-checkbox mb-0">
            <input type="checkbox" checked={form.branch_ids.includes(branch.id)} onChange={() => toggle(branch.id)} />{" "}
            <span>
              {branch.name}
              {branch.zone_id && branch.zone_id !== zoneId ? <small className="text-muted"> ({branch.zone})</small> : null}
            </span>
          </label>
        </div>
      ))}
    </div>
  );
}

export default function ZonesPage() {
  const { data: zones, isLoading } = useApi<Zone[]>("settings/zones");
  const { data: branches = [] } = useApi<Branch[]>("settings/branches");
  const [form, setForm] = useState<ZoneForm>(EMPTY);
  const [editing, setEditing] = useState<Zone | null>(null);
  const [editForm, setEditForm] = useState<ZoneForm>(EMPTY);

  const create = useAction<ZoneForm>("post", "settings/zones");
  const update = useAction<ZoneForm & { id: number }>("put", (body) => `settings/zones/${body.id}`);
  const remove = useAction<{ id: number }>("delete", (body) => `settings/zones/${body.id}`);

  const openEdit = (zone: Zone) => {
    setEditing(zone);
    setEditForm({ zone_name: zone.name, branch_ids: zone.branches.map((branch) => branch.id) });
  };

  return (
    <>
      <PageHeader crumbs={["Setting", "Zones"]} />

      <Card title="Register Zone">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(form, { onSuccess: () => setForm(EMPTY) }); }}>
          <div className="row">
            <Field label=" Zone name:" required className="col-md-4" error={create.fieldError("zone_name")}>
              <input className="form-control" placeholder="Zone name" value={form.zone_name} onChange={(e) => setForm({ ...form, zone_name: e.target.value })} required />
            </Field>
            <div className="col-md-8 mb-2">
              <span>Branches:</span>
              <BranchChecklist branches={branches} form={form} setForm={setForm} zoneId={null} />
            </div>
          </div>
          <div className="text-center m-t-20">
            <button type="submit" className="btn btn-primary" disabled={create.isPending}><i className="icon-plus" />Save</button>
          </div>
        </form>
      </Card>

      <Card title="Zone List">
        <DataTable
          rows={zones}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "name", header: "Zone Name" },
            {
              key: "branches",
              header: "Branches",
              value: (row) => row.branches.map((branch) => branch.name).join(", "),
              render: (row) => row.branches.length ? row.branches.map((branch) => <Badge key={branch.id} tone="info">{branch.name}</Badge>) : "-",
            },
            { key: "managers", header: "Zone Manager", value: (row) => row.managers.map((manager) => manager.name).join(", "), render: (row) => row.managers.map((manager) => manager.name).join(", ") || "-" },
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
        title="Edit Zone"
        size="lg"
        submitLabel="Update"
        submitting={update.isPending}
        onSubmit={() => editing && update.mutate({ ...editForm, id: editing.id }, { onSuccess: () => setEditing(null) })}
      >
        <div className="row">
          <Field label=" Zone name:" required className="col-md-12" error={update.fieldError("zone_name")}>
            <input className="form-control" value={editForm.zone_name} onChange={(e) => setEditForm({ ...editForm, zone_name: e.target.value })} required />
          </Field>
          <div className="col-md-12">
            <span>Branches:</span>
            <BranchChecklist branches={branches} form={editForm} setForm={setEditForm} zoneId={editing?.id ?? null} />
          </div>
        </div>
      </Modal>
    </>
  );
}
