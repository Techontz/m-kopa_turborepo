"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { notifyError, notifySuccess } from "@/components/ui/notify";
import { api, ApiError, type ValidationErrors } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const EMPTY = { current_password: "", password: "", password_confirmation: "" };

/**
 * Security: change my own password (POST auth/password). After a temporary password this page is the only one available
 * until the password is changed; other sessions are signed out by the API.
 */
export default function ShareholderSecurityPage() {
  const router = useRouter();
  const client = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [saving, setSaving] = useState(false);
  const forced = !!user?.must_change_password;

  const submit = async () => {
    setSaving(true);
    try {
      // No Idempotency-Key: the idempotency store keeps a hash of the request body, which must never be derived from passwords.
      await api.post("auth/password", form);
      setErrors({});
      setForm(EMPTY);
      notifySuccess("Password changed successfully");
      await client.invalidateQueries({ queryKey: ["auth", "me"] });
      if (forced) {
        router.replace(user?.account_type === "shareholder" ? "/shareholder" : "/dashboard");
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        setErrors(error.errors);
      }
      notifyError(error);
    } finally {
      setSaving(false);
    }
  };

  const set = (field: keyof typeof EMPTY) => (event: { target: { value: string } }) => setForm({ ...form, [field]: event.target.value });

  return (
    <>
      <PageHeader crumbs={["Shareholder", "Security"]} />
      <div className="row">
        <div className="col-lg-6">
          <Card title={forced ? "Change your temporary password" : "Change password"}>
            {forced && (
              <div className="alert alert-warning" data-testid="password-change-required">
                You signed in with a temporary password. Choose your own password to continue.
              </div>
            )}
            <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
              <Field label="Current password:" required className="" error={errors.current_password?.[0]}>
                <input type="password" className="form-control" autoComplete="current-password" value={form.current_password} onChange={set("current_password")} required />
              </Field>
              <Field label="New password:" required className="" error={errors.password?.[0]}>
                <input type="password" className="form-control" autoComplete="new-password" value={form.password} onChange={set("password")} minLength={8} required />
              </Field>
              <Field label="Confirm new password:" required className="" error={errors.password_confirmation?.[0]}>
                <input type="password" className="form-control" autoComplete="new-password" value={form.password_confirmation} onChange={set("password_confirmation")} minLength={8} required />
              </Field>
              <p className="small text-muted">At least 8 characters with upper and lower case letters and a number. Other signed-in devices will be signed out.</p>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Please wait..." : "Change password"}</button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
