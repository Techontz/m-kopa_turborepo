"use client";

import { useState } from "react";

import type { PortalProfile } from "@/components/shareholders/portal";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PassportPhotoField } from "@/components/ui/PassportPhotoField";
import { backendUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useAction, useApi } from "@/lib/hooks";

/**
 * My profile: names, date of birth and identity are read-only (changed by the company); e-mail, phone (also the login) and
 * photo can be updated.
 */
export default function ShareholderProfilePage() {
  const { can } = useAuth();
  const { data } = useApi<PortalProfile>(can("shareholder.profile") ? "portal/shareholder/profile" : null);
  const [edit, setEdit] = useState<{ email: string; mobile: string; photo: File | null } | null>(null);
  const update = useAction<FormData>("post", "portal/shareholder/profile");

  if (!data) {
    return <div className="mf-loading">Loading...</div>;
  }

  const form = edit ?? { email: data.email, mobile: data.mobile, photo: null };
  const save = () => {
    const body = new FormData();
    body.append("_method", "PUT");
    body.append("email", form.email);
    body.append("mobile", form.mobile);
    if (form.photo) {
      body.append("passport_photo", form.photo);
    }
    update.mutate(body, { onSuccess: () => setEdit(null) });
  };

  return (
    <>
      <PageHeader crumbs={["Shareholder", "Profile"]} />
      <div className="row">
        <div className="col-lg-6">
          <Card title="My details">
            <div className="d-flex flex-wrap" style={{ gap: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- authorised API image stream */}
              <img src={data.photo_endpoint ? backendUrl(data.photo_endpoint) : "/assets/img/user.png"} alt={data.name} className="sh-photo" />
              <dl className="sh-kv" style={{ flex: 1, minWidth: 220 }}>
                <dt>Shareholder No.</dt><dd>{data.holder_number}</dd>
                <dt>Name</dt><dd>{data.name}</dd>
                <dt>Gender</dt><dd>{data.gender ?? "-"}</dd>
                <dt>Date of birth</dt><dd>{data.date_of_birth ?? "-"}</dd>
                <dt>Phone (login)</dt><dd>{data.mobile}</dd>
                <dt>Email</dt><dd>{data.email}</dd>
                <dt>Registered</dt><dd>{data.registered_at ?? "-"}</dd>
              </dl>
            </div>
            <p className="small text-muted mt-3 mb-0">Names, date of birth and identity details can only be changed by the company.</p>
          </Card>
        </div>
        <div className="col-lg-6">
          <Card title="Update contact details">
            <form onSubmit={(event) => { event.preventDefault(); save(); }}>
              <div className="row">
                <Field label="Email:" required className="col-md-6" error={update.fieldError("email")}>
                  <input type="email" className="form-control" value={form.email} onChange={(event) => setEdit({ ...form, email: event.target.value })} required />
                </Field>
                <Field label="Phone (login):" required className="col-md-6" error={update.fieldError("mobile") ?? update.fieldError("share_mobile")}>
                  <input type="tel" className="form-control" value={form.mobile} onChange={(event) => setEdit({ ...form, mobile: event.target.value })} required />
                </Field>
                <Field label="Passport photo:" className="col-md-12">
                  <PassportPhotoField file={form.photo} onChange={(file) => setEdit({ ...form, photo: file })} currentUrl={data.photo_endpoint ? backendUrl(data.photo_endpoint) : null} error={update.fieldError("passport_photo")} />
                </Field>
              </div>
              <p className="small text-muted">Changing your phone number also changes the number you log in with.</p>
              <button type="submit" className="btn btn-primary" disabled={update.isPending}>{update.isPending ? "Please wait..." : "Save changes"}</button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
