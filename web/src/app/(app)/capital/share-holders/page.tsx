"use client";

import { useState } from "react";

import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { PassportPhotoField } from "@/components/ui/PassportPhotoField";
import { confirmAction } from "@/components/ui/notify";
import { backendUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useAction, useApi } from "@/lib/hooks";

interface ShareHolder {
  id: number;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  name: string;
  mobile: string;
  email: string;
  gender: string | null;
  date_of_birth: string | null;
  photo_endpoint: string | null;
}

interface HolderForm {
  first_name: string;
  middle_name: string;
  last_name: string;
  share_mobile: string;
  share_email: string;
  share_sex: string;
  share_dob: string;
  passport_photo: File | null;
}

const EMPTY: HolderForm = { first_name: "", middle_name: "", last_name: "", share_mobile: "", share_email: "", share_sex: "", share_dob: "", passport_photo: null };

/** Multipart body for the API (the photo is a file; editing spoofs PUT because PHP only parses multipart POST). */
function toFormData(form: HolderForm, method: "POST" | "PUT"): FormData {
  const body = new FormData();
  for (const [key, value] of Object.entries(form)) {
    if (value instanceof File) {
      body.append(key, value);
    } else if (value !== null) {
      body.append(key, value);
    }
  }
  if (method === "PUT") {
    body.append("_method", "PUT");
  }
  return body;
}

function HolderFields({ form, setForm, fieldError, editing, currentPhoto }: { form: HolderForm; setForm: (form: HolderForm) => void; fieldError: (field: string) => string | undefined; editing?: boolean; currentPhoto?: string | null }) {
  const set = (field: keyof HolderForm) => (event: { target: { value: string } }) => setForm({ ...form, [field]: event.target.value });

  return (
    <div className="row">
      <div className="col-lg-9">
        <div className="row">
          <Field label=" First Name:" required className="col-md-4" error={fieldError("first_name")}>
            <input className="form-control" placeholder="First Name" autoComplete="off" value={form.first_name} onChange={set("first_name")} required />
          </Field>
          <Field label="Middle Name:" className="col-md-4" error={fieldError("middle_name")}>
            <input className="form-control" placeholder="Middle Name" autoComplete="off" value={form.middle_name} onChange={set("middle_name")} />
          </Field>
          <Field label=" Last Name:" required className="col-md-4" error={fieldError("last_name")}>
            <input className="form-control" placeholder="Last Name" autoComplete="off" value={form.last_name} onChange={set("last_name")} required />
          </Field>
          <Field label={editing ? " Mobile no:" : " Phone no:"} required className="col-md-4" error={fieldError("share_mobile")}>
            <input type="number" className="form-control" placeholder={editing ? "Mobile no" : "Phone no"} autoComplete="off" value={form.share_mobile} onChange={set("share_mobile")} required />
          </Field>
          <Field label=" Email:" required className="col-md-4" error={fieldError("share_email")}>
            <input type="email" className="form-control" placeholder="Email" autoComplete="off" value={form.share_email} onChange={set("share_email")} required />
          </Field>
          <Field label="Gender:" required className="col-md-4" error={fieldError("share_sex")}>
            <select className="form-control input-sm" value={form.share_sex} onChange={set("share_sex")}>
              {!editing && <option value="">Select gender</option>}
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Field>
          <Field label="Date of Birth:" required className="col-md-4" error={fieldError("share_dob")}>
            <input type="date" className="form-control" value={form.share_dob} onChange={set("share_dob")} required />
          </Field>
        </div>
      </div>
      <Field label="Passport Size Image:" required={!editing} className="col-lg-3">
        <PassportPhotoField file={form.passport_photo} onChange={(file) => setForm({ ...form, passport_photo: file })} currentUrl={currentPhoto} error={fieldError("passport_photo")} required={!editing} />
      </Field>
    </div>
  );
}

/** Live admin/shareHolder, with the name split into first / middle / last and a passport-size photo. */
export default function ShareHoldersPage() {
  const { can } = useAuth();
  const { data: holders, isLoading } = useApi<ShareHolder[]>("capital/share-holders");
  const [form, setForm] = useState<HolderForm>(EMPTY);
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<ShareHolder | null>(null);
  const [editForm, setEditForm] = useState<HolderForm>(EMPTY);

  const create = useAction<FormData>("post", "capital/share-holders");
  const update = useAction<FormData>("post", () => `capital/share-holders/${editing?.id}`);
  const remove = useAction<{ id: number }>("delete", (body) => `capital/share-holders/${body.id}`);
  const canManage = can("capital.manage");

  return (
    <>
      <PageHeader crumbs={["Share Holder"]} />

      {canManage && (
        <Card title="Register Share Holder">
          <form
            key={formKey}
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate(toFormData(form, "POST"), { onSuccess: () => { setForm(EMPTY); setFormKey((key) => key + 1); } });
            }}
          >
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
            {
              key: "photo",
              header: "Photo",
              sortable: false,
              render: (row) => (
                // eslint-disable-next-line @next/next/no-img-element -- authorised API image stream
                <img src={row.photo_endpoint ? backendUrl(row.photo_endpoint) : "/assets/img/user.png"} alt={row.photo_endpoint ? row.name : "No photo"} className="img-thumbnail mf-passport-thumb" />
              ),
            },
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
                      title="Edit"
                      onClick={() => {
                        setEditing(row);
                        setEditForm({
                          first_name: row.first_name ?? "",
                          middle_name: row.middle_name ?? "",
                          last_name: row.last_name ?? "",
                          share_mobile: row.mobile,
                          share_email: row.email,
                          share_sex: row.gender ?? "male",
                          share_dob: row.date_of_birth ?? "",
                          passport_photo: null,
                        });
                      }}
                    >
                      <i className="icon-pencil" />
                    </button>
                    <button type="button" className="btn btn-sm btn-icon btn-danger" title="Delete" onClick={async () => (await confirmAction("Are You Sure?")) && remove.mutate({ id: row.id })}><i className="icon-trash" /></button>
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
        size="xl"
        submitLabel="Update"
        submitting={update.isPending}
        onSubmit={() => editing && update.mutate(toFormData(editForm, "PUT"), { onSuccess: () => setEditing(null) })}
      >
        <HolderFields
          key={editing?.id}
          form={editForm}
          setForm={setEditForm}
          fieldError={update.fieldError}
          editing
          currentPhoto={editing?.photo_endpoint ? backendUrl(editing.photo_endpoint) : null}
        />
      </Modal>
    </>
  );
}
