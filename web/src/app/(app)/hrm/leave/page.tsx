"use client";

import { useState } from "react";

import { statusTone } from "@/components/hrm/common";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { confirmAction } from "@/components/ui/notify";
import { useAction, useApi } from "@/lib/hooks";

interface Leave {
  id: number;
  employee: string;
  phone: string;
  branch: string | null;
  position: string;
  start_date: string;
  end_date: string;
  remarks: string;
  status: string;
}

const EMPTY = { empl_id: "", stat_date: "", end_date: "", remaks: "" };

export default function StaffLeavePage() {
  const { data: leaves, isLoading } = useApi<Leave[]>("hrm/leaves");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const create = useAction<typeof EMPTY>("post", "hrm/leaves");
  const decide = useAction<{ id: number; status: string }>("post", (body) => `hrm/leaves/${body.id}/decide`);

  return (
    <>
      <PageHeader crumbs={["Employee Leave"]} />
      <Card title="Employee Leave List" actions={<button type="button" className="btn btn-info btn-sm" onClick={() => setOpen(true)}><i className="icon-plus" /></button>}>
        <DataTable
          rows={leaves}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "employee", header: "Employee" },
            { key: "phone", header: "Phone number" },
            { key: "branch", header: "Branch" },
            { key: "position", header: "Position", className: "text-uppercase" },
            { key: "start_date", header: "Leave Start date" },
            { key: "end_date", header: "Leave End date" },
            { key: "remarks", header: "Remarks" },
            { key: "status", header: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => row.status === "pending" && (
                <>
                  <button type="button" className="btn btn-sm btn-icon btn-success mr-1" title="Approve" onClick={async () => (await confirmAction("Are You Sure?")) && decide.mutate({ id: row.id, status: "approved" })}><i className="icon-like" /></button>
                  <button type="button" className="btn btn-sm btn-icon btn-danger" title="Reject" onClick={async () => (await confirmAction("Are You Sure?")) && decide.mutate({ id: row.id, status: "rejected" })}><i className="icon-close" /></button>
                </>
              ),
            },
          ]}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Employee Leave" size="lg" submitLabel="Save" submitting={create.isPending} onSubmit={() => create.mutate(form, { onSuccess: () => { setOpen(false); setForm(EMPTY); } })}>
        <div className="row clearfix">
          <Field label="Employee:" className="col-lg-12 col-12" error={create.fieldError("empl_id")}>
            <SelectBox placeholder="Select Employee" optionsUrl="options/employees" value={form.empl_id} onChange={(value) => setForm({ ...form, empl_id: value ?? "" })} />
          </Field>
          <Field label="Leave Start date:" className="col-lg-6 col-6" error={create.fieldError("stat_date")}>
            <input type="date" className="form-control" value={form.stat_date} onChange={(e) => setForm({ ...form, stat_date: e.target.value })} required />
          </Field>
          <Field label="Leave End date:" className="col-lg-6 col-6" error={create.fieldError("end_date")}>
            <input type="date" className="form-control" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required />
          </Field>
          <Field label="Remarks:" className="col-lg-12 col-12" error={create.fieldError("remaks")}>
            <textarea className="form-control" rows={3} placeholder="Remarks" value={form.remaks} onChange={(e) => setForm({ ...form, remaks: e.target.value })} required />
          </Field>
        </div>
      </Modal>
    </>
  );
}
