"use client";

import { useState } from "react";

import { ContributionHistoryModal } from "@/components/capital/ContributionHistoryModal";
import Link from "next/link";

import { ownershipLabel } from "@/components/capital/contributions";
import { CredentialsModal } from "@/components/shareholders/CredentialsModal";
import { credentialsFrom, type CredentialEntry } from "@/components/shareholders/credentials";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { PassportPhotoField } from "@/components/ui/PassportPhotoField";
import { confirmAction, notifySuccess } from "@/components/ui/notify";
import { backendUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
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
  total_contributed: number;
  cash_contributed: number;
  bank_contributed: number;
  asset_contributed: number;
  shares: number;
  ownership_percent: number;
  holding_value: number;
  contributions_count: number;
  login?: HolderLogin;
}

interface HolderLogin {
  linked: boolean;
  account_id: number | null;
  account_type: "staff" | "shareholder" | null;
  status: string | null;
  must_change_password: boolean;
  login: string | null;
}

interface AccountsOverview {
  totals: { total: number; linked: number; not_linked: number; missing_phone: number; invalid_phone: number; missing_email: number; phone_conflicts: number; must_change_password: number; eligible: number };
  share_holders: Array<{ id: number; name: string; mobile: string | null; linked: boolean; conflict: string | null; will: string | null; eligible: boolean }>;
}

/** Login status badge of a shareholder (Shareholder Portal account). */
function LoginBadge({ login }: { login?: HolderLogin }) {
  if (!login?.linked) {
    return <Badge tone="default">NOT LINKED</Badge>;
  }
  if (login.account_type === "staff") {
    return <Badge tone="info">STAFF LOGIN</Badge>;
  }
  if (login.status !== "active") {
    return <Badge tone="danger">DEACTIVATED</Badge>;
  }
  return login.must_change_password ? <Badge tone="warning">MUST CHANGE PASSWORD</Badge> : <Badge tone="success">ACTIVE</Badge>;
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

/**
 * Live admin/shareHolder, with the name split into first / middle / last and a passport-size photo. A shareholder
 * record alone owns nothing: Total Contributed Capital comes from their capital contributions, while Shares and
 * Ownership % come only from the share register (Shares module).
 */
export default function ShareHoldersPage() {
  const { can } = useAuth();
  const { data: holders, isLoading } = useApi<ShareHolder[]>("capital/share-holders");
  const [form, setForm] = useState<HolderForm>(EMPTY);
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<ShareHolder | null>(null);
  const [editForm, setEditForm] = useState<HolderForm>(EMPTY);
  const [historyOf, setHistoryOf] = useState<number | null>(null);

  const [credentials, setCredentials] = useState<CredentialEntry[] | null>(null);
  const { data: accounts } = useApi<AccountsOverview>(can(["users.manage", "capital.manage"]) ? "capital/share-holders/accounts" : null);
  const noNotice = () => "";
  const create = useAction<FormData, { message: string; account?: { outcome: string; message: string }; credentials?: unknown; data: ShareHolder }>("post", "capital/share-holders", noNotice);
  const provision = useAction<{ id: number; name: string }>("post", (body) => `capital/share-holders/${body.id}/account`, noNotice);
  const resetPassword = useAction<{ id: number; name: string }>("post", (body) => `capital/share-holders/${body.id}/account/reset-password`, noNotice);
  const loginStatus = useAction<{ id: number; active: boolean }>("post", (body) => `capital/share-holders/${body.id}/account/status`);
  const generate = useAction<{ all: boolean }>("post", "capital/share-holders/accounts/generate", noNotice);
  const canUsers = can("users.manage");
  const canAccounts = can(["users.manage", "capital.manage"]);
  const showCredentials = (result: unknown, name: string, fallback: string) => {
    const entries = credentialsFrom(result, name);
    if (entries) {
      setCredentials(entries);
    } else {
      notifySuccess((result as { message?: string })?.message ?? fallback);
    }
  };
  const update = useAction<FormData>("post", () => `capital/share-holders/${editing?.id}`);
  const remove = useAction<{ id: number }>("delete", (body) => `capital/share-holders/${body.id}`);
  const canManage = can("capital.manage");

  return (
    <>
      <PageHeader crumbs={["Shareholders"]} />

      {canManage && (
        <Card title="Register Shareholder">
          <form
            key={formKey}
            onSubmit={(e) => {
              e.preventDefault();
              const name = [form.first_name, form.middle_name, form.last_name].filter(Boolean).join(" ");
              create.mutate(toFormData(form, "POST"), {
                onSuccess: (result) => {
                  setForm(EMPTY);
                  setFormKey((key) => key + 1);
                  showCredentials(result, name, `${result.message} — ${result.account?.message ?? ""}`);
                },
              });
            }}
          >
            <HolderFields form={form} setForm={setForm} fieldError={create.fieldError} />
            <div className="text-center m-t-20">
              <button type="submit" className="btn btn-primary" disabled={create.isPending}><i className="icon-drawer" />Save</button>
            </div>
          </form>
        </Card>
      )}

      {canAccounts && accounts && (
        <Card
          title="Shareholder login accounts"
          actions={
            accounts.totals.eligible > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={generate.isPending}
                onClick={async () =>
                  (await confirmAction("Generate login accounts?", `${accounts.totals.eligible} shareholder(s) with a valid phone get a login (staff phones are linked). Temporary passwords are shown once.`)) &&
                  generate.mutate({ all: true }, { onSuccess: (result) => showCredentials(result, "", (result as { message?: string }).message ?? "Done") })
                }
              >
                <i className="icon-key" /> Generate accounts ({accounts.totals.eligible})
              </button>
            )
          }
        >
          <div className="d-flex flex-wrap" style={{ gap: 8 }} data-testid="accounts-totals">
            <Badge tone="primary">Shareholders: {accounts.totals.total}</Badge>
            <Badge tone="success">Linked: {accounts.totals.linked}</Badge>
            <Badge tone="default">Not linked: {accounts.totals.not_linked}</Badge>
            <Badge tone="warning">Missing phone: {accounts.totals.missing_phone}</Badge>
            <Badge tone="warning">Invalid phone: {accounts.totals.invalid_phone}</Badge>
            <Badge tone="warning">Missing email: {accounts.totals.missing_email}</Badge>
            <Badge tone="danger">Phone matches staff / conflicts: {accounts.totals.phone_conflicts}</Badge>
            <Badge tone="info">Must change password: {accounts.totals.must_change_password}</Badge>
          </div>
          {accounts.share_holders.some((row) => !row.linked && row.conflict) && (
            <ul className="small text-muted mt-2 mb-0">
              {accounts.share_holders.filter((row) => !row.linked && row.conflict).map((row) => <li key={row.id}>{row.name}: {row.conflict}</li>)}
            </ul>
          )}
        </Card>
      )}

      <Card title="Shareholder List">
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
            { key: "first_name", header: "First Name", render: (row) => row.first_name ?? row.name },
            { key: "middle_name", header: "Middle Name", render: (row) => row.middle_name ?? "" },
            { key: "last_name", header: "Last Name", render: (row) => row.last_name ?? "" },
            { key: "mobile", header: "Phone number" },
            { key: "email", header: "Email" },
            { key: "gender", header: "Sex" },
            { key: "date_of_birth", header: "Date of Birth" },
            { key: "cash_contributed", header: "Cash", className: "text-right", render: (row) => money(row.cash_contributed) },
            { key: "bank_contributed", header: "Bank", className: "text-right", render: (row) => money(row.bank_contributed) },
            { key: "asset_contributed", header: "Asset", className: "text-right", render: (row) => money(row.asset_contributed) },
            { key: "total_contributed", header: "Total Contributed Capital", className: "text-right", render: (row) => <b>{money(row.total_contributed)}</b> },
            { key: "shares", header: "Shares", render: (row) => row.shares.toLocaleString("en-US") },
            { key: "ownership_percent", header: "Ownership % (share register)", render: (row) => ownershipLabel(row.ownership_percent) },
            {
              key: "login",
              header: "Login",
              value: (row) => (row.login?.linked ? `${row.login.status} ${row.login.login}` : "not linked"),
              render: (row) => (
                <>
                  <LoginBadge login={row.login} />
                  {canAccounts && !row.login?.linked && (
                    <button type="button" className="btn btn-sm btn-link p-0 ml-1" disabled={provision.isPending} onClick={async () => (await confirmAction("Generate a login for this shareholder?")) && provision.mutate({ id: row.id, name: row.name }, { onSuccess: (result) => showCredentials(result, row.name, "Linked to the existing staff login") })}>
                      Generate
                    </button>
                  )}
                  {canUsers && row.login?.account_type === "shareholder" && (
                    <div className="text-nowrap">
                      <button type="button" className="btn btn-sm btn-link p-0 mr-2" disabled={resetPassword.isPending} onClick={async () => (await confirmAction("Reset the login password?", "A new temporary password is shown once and all sessions are signed out.")) && resetPassword.mutate({ id: row.id, name: row.name }, { onSuccess: (result) => showCredentials(result, row.name, "Password reset") })}>
                        Reset password
                      </button>
                      <button type="button" className="btn btn-sm btn-link p-0" disabled={loginStatus.isPending} onClick={async () => (await confirmAction(row.login?.status === "active" ? "Deactivate this login?" : "Activate this login?")) && loginStatus.mutate({ id: row.id, active: row.login?.status !== "active" })}>
                        {row.login?.status === "active" ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  )}
                </>
              ),
            },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  <button type="button" className="btn btn-sm btn-icon btn-info mr-1" title={`Contribution history (${row.contributions_count})`} onClick={() => setHistoryOf(row.id)}>
                    <i className="icon-list" />
                  </button>
                  {can("shares.view") && (
                    <Link href={`/shares/share-holders/${row.id}`} className="btn btn-sm btn-icon btn-success mr-1" title="Share profile">
                      <i className="icon-pie-chart" />
                    </Link>
                  )}
                  {canManage && (
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
                  )}
                </>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit Shareholder"
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

      <ContributionHistoryModal shareHolderId={historyOf} onClose={() => setHistoryOf(null)} />
      <CredentialsModal entries={credentials} onClose={() => setCredentials(null)} />
    </>
  );
}
