"use client";

import { useState } from "react";

import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { useAction, useApi } from "@/lib/hooks";

interface Company {
  id: number;
  name: string;
  registration_number: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  region_id: number | null;
  logo_url: string | null;
}

interface ProfileForm {
  comp_name: string;
  comp_number: string;
  adress: string;
  comp_phone: string;
  comp_email: string;
  region_id: string;
}

function ProfileCard({ company }: { company: Company }) {
  const [form, setForm] = useState<ProfileForm>({
    comp_name: company.name,
    comp_number: company.registration_number ?? "",
    adress: company.address ?? "",
    comp_phone: company.phone ?? "",
    comp_email: company.email ?? "",
    region_id: String(company.region_id ?? ""),
  });
  const update = useAction<ProfileForm>("put", "settings/company");
  const set = (field: keyof ProfileForm) => (event: { target: { value: string } }) => setForm({ ...form, [field]: event.target.value });

  return (
    <Card title="Company Profile">
      <form onSubmit={(e) => { e.preventDefault(); update.mutate(form); }}>
        <div className="row">
          <Field label="Company name:" required className="col-md-4" error={update.fieldError("comp_name")}>
            <input className="form-control" placeholder="First name" value={form.comp_name} onChange={set("comp_name")} required />
          </Field>
          <Field label="Registration number:" required className="col-md-4" error={update.fieldError("comp_number")}>
            <input className="form-control" placeholder="Middle name" value={form.comp_number} onChange={set("comp_number")} required />
          </Field>
          <Field label="Address:" required className="col-md-4" error={update.fieldError("adress")}>
            <input className="form-control" value={form.adress} onChange={set("adress")} required />
          </Field>
          <Field label="Phone number:" required className="col-md-4" error={update.fieldError("comp_phone")}>
            <input type="number" className="form-control" value={form.comp_phone} onChange={set("comp_phone")} required />
          </Field>
          <Field label="Email:" required className="col-md-4" error={update.fieldError("comp_email")}>
            <input type="email" className="form-control" value={form.comp_email} onChange={set("comp_email")} required />
          </Field>
          <Field label="Region:" required className="col-md-4" error={update.fieldError("region_id")}>
            <SelectBox placeholder="Select Region" optionsUrl="options/regions" value={form.region_id} onChange={(value) => setForm({ ...form, region_id: value ?? "" })} />
          </Field>
        </div>
        <div className="text-center m-t-20">
          <button type="submit" className="btn btn-primary" disabled={update.isPending}><i className="icon-drawer" />Update</button>
        </div>
      </form>
    </Card>
  );
}

function PasswordCard() {
  const empty = { oldpass: "", newpass: "", passconf: "" };
  const [form, setForm] = useState(empty);
  const change = useAction<typeof empty>("put", "settings/company/password");

  return (
    <Card title="Change Password">
      <form onSubmit={(e) => { e.preventDefault(); change.mutate(form, { onSuccess: () => setForm(empty) }); }}>
        {(["oldpass", "newpass", "passconf"] as const).map((field) => (
          <Field key={field} label={{ oldpass: "Old Password:", newpass: "New Password:", passconf: "Confirm Password:" }[field]} required className="col-12 px-0" error={change.fieldError(field)}>
            <input type="password" className="form-control" placeholder="******" value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} required />
          </Field>
        ))}
        <div className="text-center m-t-20">
          <button type="submit" className="btn btn-primary" disabled={change.isPending}>Change password</button>
        </div>
      </form>
    </Card>
  );
}

function LogoCard({ company }: { company: Company }) {
  const [file, setFile] = useState<File | null>(null);
  const upload = useAction<FormData>("post", "settings/company/logo");

  return (
    <Card title="Company Logo">
      {company.logo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={company.logo_url} alt="logo" style={{ maxHeight: 80 }} className="mb-2" />
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (file) {
            const body = new FormData();
            body.append("comp_logo", file);
            upload.mutate(body);
          }
        }}
      >
        <input type="file" accept="image/*" className="form-control" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
        {upload.fieldError("comp_logo") && <div className="field-error">{upload.fieldError("comp_logo")}</div>}
        <div className="text-center m-t-20">
          <button type="submit" className="btn btn-primary" disabled={upload.isPending}>Update</button>
        </div>
      </form>
    </Card>
  );
}

/** Live admin/setting (Company Profile, Change Password, Company Logo). */
export default function CompanySettingPage() {
  const { data: company } = useApi<Company>("settings/company");

  if (!company) {
    return <div className="mf-loading">Loading...</div>;
  }

  return (
    <>
      <PageHeader crumbs={["Setting", "Company Profile"]} />
      <ProfileCard key={company.id} company={company} />
      <div className="row clearfix">
        <div className="col-lg-6"><PasswordCard /></div>
        <div className="col-lg-6"><LogoCard company={company} /></div>
      </div>
    </>
  );
}
