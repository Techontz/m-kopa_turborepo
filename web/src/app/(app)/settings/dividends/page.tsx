"use client";

import Link from "next/link";
import { useState } from "react";

import { settingsTotal } from "@/components/dividends/dividends";
import type { DividendSettings } from "@/components/dividends/types";
import { styles } from "@/components/financial-reports/ReportShell";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import { useAction, useApi } from "@/lib/hooks";

interface SettingsForm {
  dividend_percent: string;
  reinvest_percent: string;
}

function DividendSettingsForm({ settings }: { settings: DividendSettings }) {
  const [form, setForm] = useState<SettingsForm>({ dividend_percent: String(settings.dividend_percent), reinvest_percent: String(settings.reinvest_percent) });
  const update = useAction<SettingsForm>("put", "settings/dividend");
  const check = settingsTotal(form.dividend_percent, form.reinvest_percent);

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (check.valid) { update.mutate(form); } }}>
      <div className="row">
        <Field label="Shareholders Dividend %" required className="col-md-4" error={update.fieldError("dividend_percent")}>
          <input className="form-control" inputMode="decimal" value={form.dividend_percent} onChange={(e) => setForm({ ...form, dividend_percent: e.target.value })} required autoComplete="off" aria-label="Shareholders Dividend %" />
        </Field>
        <Field label="Principal Reinvestment %" required className="col-md-4" error={update.fieldError("reinvest_percent")}>
          <input className="form-control" inputMode="decimal" value={form.reinvest_percent} onChange={(e) => setForm({ ...form, reinvest_percent: e.target.value })} required autoComplete="off" aria-label="Principal Reinvestment %" />
        </Field>
        <Field label="Total Allocation" className="col-md-4">
          <input className={`form-control ${check.valid ? "is-valid" : "is-invalid"}`} value={Number.isFinite(check.total) ? `${check.total.toFixed(2)}%` : "-"} readOnly aria-label="Total Allocation" />
          {check.message && <div className="field-error">{check.message}</div>}
        </Field>
      </div>
      <p className={styles.note}>
        When a dividend is declared, the period&apos;s Profit Available is split into the <b>Shareholder Dividend Pool</b> (Shareholders Dividend %),
        which is shared by share-register ownership, and <b>Principal Reinvestment</b> (Principal Reinvestment %), which is credited to the Capital account.
        The two percentages must total exactly 100%. Changes apply to future declarations only; declared dividends keep their percentages.
        {" "}<Link href="/capital/dividends">Go to Dividends</Link>
      </p>
      <div className="text-center m-t-20">
        <button type="submit" className="btn btn-primary" disabled={!check.valid || update.isPending}><i className="icon-drawer" /> Update</button>
      </div>
    </form>
  );
}

/** Settings → Dividend Settings (Documents: ACCOUNT OVERVIEW "Dividend Account": 70% → Principal, 30% → Shareholders). */
export default function DividendSettingsPage() {
  const { can } = useAuth();
  const { data, error } = useApi<DividendSettings>(can("settings.manage") ? "settings/dividend" : null);

  return (
    <>
      <PageHeader crumbs={["Settings", "Dividend Settings"]} />
      <Card title="Dividend Settings">
        {!can("settings.manage") ? (
          <div className="alert alert-warning mb-0">You do not have permission to manage settings.</div>
        ) : error ? (
          <div className="alert alert-danger mb-0">{error instanceof Error ? error.message : "The settings could not be loaded."}</div>
        ) : data ? (
          <DividendSettingsForm key={`${data.dividend_percent}-${data.reinvest_percent}`} settings={data} />
        ) : (
          <div className="mf-loading">Loading...</div>
        )}
      </Card>
    </>
  );
}
