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

interface ShareHolder {
  id: number;
  name: string;
  mobile: string;
  email: string;
  gender: string | null;
  date_of_birth: string | null;
}

interface HolderForm {
  share_name: string;
  share_mobile: string;
  share_email: string;
  share_sex: string;
  share_dob: string;
}

const EMPTY: HolderForm = { share_name: "", share_mobile: "", share_email: "", share_sex: "", share_dob: "" };

function HolderFields({ form, setForm, fieldError, editing }: { form: HolderForm; setForm: (form: HolderForm) => void; fieldError: (field: string) => string | undefined; editing?: boolean }) {
  const set = (field: keyof HolderForm) => (event: { target: { value: string } }) => setForm({ ...form, [field]: event.target.value });

  return (
    <div className="row">
      <Field label=" Full name:" required className="col-md-4" error={fieldError("share_name")}>
        <input className="form-control" placeholder="Full name" autoComplete="off" value={form.share_name} onChange={set("share_name")} required />
      </Field>
      <Field label={editing ? " Mobile no:" : " Phone no:"} required className="col-md-4" error={fieldError("share_mobile")}>
        <input type="number" className="form-control" placeholder={editing ? "Mobile no" : "Phone no"} autoComplete="off" value={form.share_mobile} onChange={set("share_mobile")} required />
      </Field>
      <Field label=" Email:" required className="col-lg-4" error={fieldError("share_email")}>
        <input type="email" className="form-control" placeholder="Email" autoComplete="off" value={form.share_email} onChange={set("share_email")} required />
      </Field>
      <Field label="Gender:" required className="col-md-6" error={fieldError("share_sex")}>
        <select className="form-control input-sm" value={form.share_sex} onChange={set("share_sex")}>
          {!editing && <option value="">Select gender</option>}
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </Field>
      <Field label="Date of Birth:" required className="col-md-6" error={fieldError("share_dob")}>
        <input type="date" className="form-control" value={form.share_dob} onChange={set("share_dob")} required />
      </Field>
    </div>
  );
}

/** Live admin/shareHolder. */
export default function ShareHoldersPage() {
  const { can } = useAuth();
  const { data: holders, isLoading } = useApi<ShareHolder[]>("capital/share-holders");
  const [form, setForm] = useState<HolderForm>(EMPTY);
  const [editing, setEditing] = useState<ShareHolder | null>(null);
  const [editForm, setEditForm] = useState<HolderForm>(EMPTY);

  const create = useAction<HolderForm>("post", "capital/share-holders");
  const update = useAction<HolderForm & { id: number }>("put", (body) => `capital/share-holders/${body.id}`);
  const remove = useAction<{ id: number }>("delete", (body) => `capital/share-holders/${body.id}`);
  const canManage = can("capital.manage");

  return (
    <>
      <PageHeader crumbs={["Share Holder"]} />

      {canManage && (
        <Card title="Register Share Holder">
          <form onSubmit={(e) => { e.preventDefault(); create.mutate(form, { onSuccess: () => setForm(EMPTY) }); }}>
            <HolderFields form={form} setForm={setForm} fieldError={create.fieldError} />
            <div className="text-center m-t-20">
              <button type="submit" className="btn btn-primary" disabled={create.isPending}><i className="icon-drawer" />Save</button>
            </div>
          </form>
        </Card>
      )}

      <Card title="Share Holder List">
        <DataTable
          rows={holders}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "name", header: "Shareholder name" },
            { key: "mobile", header: "Phone number" },
            { key: "email", header: "Email" },
            { key: "gender", header: "Sex" },
            { key: "date_of_birth", header: "Date of Birth" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) =>
                canManage && (
                  <>
                    <button
                      type="button"
                      className="btn btn-sm btn-icon btn-primary mr-1"
                      onClick={() => {
                        setEditing(row);
                        setEditForm({ share_name: row.name, share_mobile: row.mobile, share_email: row.email, share_sex: row.gender ?? "male", share_dob: row.date_of_birth ?? "" });
                      }}
                    >
                      <i className="icon-pencil" />
                    </button>
                    <button type="button" className="btn btn-sm btn-icon btn-danger" onClick={async () => (await confirmAction("Are You Sure?")) && remove.mutate({ id: row.id })}><i className="icon-trash" /></button>
                  </>
                ),
            },
          ]}
        />
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit Share Holder"
        size="lg"
        submitLabel="Update"
        submitting={update.isPending}
        onSubmit={() => editing && update.mutate({ ...editForm, id: editing.id }, { onSuccess: () => setEditing(null) })}
      >
        <HolderFields form={editForm} setForm={setEditForm} fieldError={update.fieldError} editing />
      </Modal>
    </>
  );
}
