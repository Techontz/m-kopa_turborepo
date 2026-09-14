"use client";

import { useState } from "react";

import { StepValueChart } from "@/components/shares/HoldingHistoryChart";
import { SharesAccess } from "@/components/shares/SharesAccess";
import { SharesNav } from "@/components/shares/SharesNav";
import { holdingValue, parseAmount, sharesLabel } from "@/components/shares/shares";
import type { RegisterResponse, ShareValuation } from "@/components/shares/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction, promptReason } from "@/components/ui/notify";
import { useAuth } from "@/lib/auth";
import { money, percent, todayIso } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";
import { newIdempotencyKey } from "@/lib/idempotency";

/**
 * Shares → Share Valuations. A new share value changes holding values only (never share counts or ownership); every
 * change is kept with its previous value, and it is a memorandum record with no journal entry.
 */
export default function ShareValuationsPage() {
  const { can } = useAuth();
  const { data: valuations, isLoading } = useApi<ShareValuation[]>(can("shares.view") ? "shares/valuations" : null);
  const { data: register } = useApi<RegisterResponse>(can("shares.view") ? "shares/register" : null);
  const [form, setForm] = useState({ new_value: "", valuation_date: todayIso(), reason: "" });
  const [key, setKey] = useState(() => newIdempotencyKey("share-value"));
  const save = useAction<typeof form & { idempotency_key: string }>("post", "shares/valuations");
  const reverse = useAction<{ id: number; reason: string }>("post", (body) => `shares/valuations/${body.id}/reverse`);

  const newValue = parseAmount(form.new_value);
  const valid = Number.isFinite(newValue) && newValue > 0;
  const latestEffective = valuations?.find((row) => row.status === "effective");
  const history = [...(valuations ?? [])].filter((row) => row.status === "effective").reverse();

  return (
    <SharesAccess crumbs={["Shares", "Share Valuations"]}>
      <PageHeader crumbs={["Shares", "Share Valuations"]} />
      <SharesNav />

      {can("shares.value") && (
        <Card title="Change Share Value">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (await confirmAction("Record the new share value?", `${money(register?.share_value)} → ${money(newValue)} per share, effective ${form.valuation_date}.`)) {
                save.mutate({ ...form, idempotency_key: key }, { onSuccess: () => { setForm({ ...form, new_value: "", reason: "" }); setKey(newIdempotencyKey("share-value")); } });
              }
            }}
          >
            <div className="row">
              <Field label="Current Share Value:" className="col-lg-3 col-md-6">
                <input className="form-control" readOnly value={money(register?.share_value)} />
              </Field>
              <Field label="New Share Value:" required className="col-lg-3 col-md-6" error={save.fieldError("new_value")}>
                <input className="form-control" inputMode="decimal" placeholder="e.g. 100,000" value={form.new_value} onChange={(e) => setForm({ ...form, new_value: e.target.value })} required />
              </Field>
              <Field label="Valuation Date:" required className="col-lg-3 col-md-6" error={save.fieldError("valuation_date")}>
                <input type="date" className="form-control" min={latestEffective?.valuation_date} max={todayIso()} value={form.valuation_date} onChange={(e) => setForm({ ...form, valuation_date: e.target.value })} required />
              </Field>
              <Field label="Total Valuation After:" className="col-lg-3 col-md-6">
                <input className="form-control" readOnly value={valid && register ? money(holdingValue(register.total_shares, newValue)) : ""} />
              </Field>
              <Field label="Reason:" required className="col-lg-12" error={save.fieldError("reason")}>
                <input className="form-control" placeholder="e.g. Annual board valuation" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
              </Field>
            </div>
            {valid && register && register.rows.some((row) => row.shares > 0) && (
              <div className="table-responsive">
                <table className="table table-custom table-sm">
                  <thead className="thead-info"><tr><th>Shareholder</th><th className="text-right">Shares (unchanged)</th><th className="text-right">Ownership % (unchanged)</th><th className="text-right">Holding Value Now</th><th className="text-right">Holding Value After</th></tr></thead>
                  <tbody>
                    {register.rows.filter((row) => row.shares > 0).map((row) => (
                      <tr key={row.share_holder_id}>
                        <td>{row.name}</td>
                        <td className="text-right">{sharesLabel(row.shares)}</td>
                        <td className="text-right">{percent(row.ownership_percent)}</td>
                        <td className="text-right">{money(row.holding_value)}</td>
                        <td className="text-right"><b>{money(holdingValue(row.shares, newValue))}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-muted mb-0"><small>A share value is not cash: no journal entry is posted and company cash and bank balances are unchanged.</small></p>
            <div className="text-center m-t-20">
              <button type="submit" className="btn btn-primary" disabled={save.isPending}><i className="icon-drawer" /> Save Share Value</button>
            </div>
          </form>
        </Card>
      )}

      <Card title="Valuation History">
        <StepValueChart title="Share value per share" points={history.map((row) => ({ date: row.valuation_date, value: row.new_value, detail: row.reference }))} />
        <DataTable
          rows={valuations}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "valuation_date", header: "Valuation Date" },
            { key: "reference", header: "Reference" },
            { key: "previous_value", header: "Previous Value", className: "text-right", render: (row) => (row.previous_value === null ? "—" : money(row.previous_value)) },
            { key: "new_value", header: "New Value", className: "text-right", render: (row) => money(row.new_value) },
            { key: "change_percent", header: "Change", className: "text-right", render: (row) => (row.change_percent === null ? "—" : `${row.change_percent > 0 ? "+" : ""}${percent(row.change_percent)}`) },
            { key: "total_shares", header: "Total Shares", className: "text-right", render: (row) => sharesLabel(row.total_shares) },
            { key: "previous_total_valuation", header: "Previous Total Valuation", className: "text-right", render: (row) => (row.previous_total_valuation === null ? "—" : money(row.previous_total_valuation)) },
            { key: "new_total_valuation", header: "New Total Valuation", className: "text-right", render: (row) => money(row.new_total_valuation) },
            { key: "reason", header: "Reason" },
            { key: "performed_by", header: "Performed By", render: (row) => row.performed_by ?? "—" },
            {
              key: "status",
              header: "Status",
              render: (row) => (
                <>
                  <Badge tone={row.status === "effective" ? "success" : "warning"}>{row.status === "effective" ? (row.kind === "initial" ? "INITIAL" : "EFFECTIVE") : "REVERSED"}</Badge>
                  {row.reversal_reason && <><br /><small className="text-muted">{row.reversal_reason}</small></>}
                </>
              ),
            },
            {
              key: "action",
              header: "Action",
              sortable: false,
              render: (row) =>
                can("shares.manage") && row.id === latestEffective?.id && row.kind !== "initial" ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-icon btn-danger"
                    title="Reverse this valuation"
                    onClick={async () => {
                      const reason = await promptReason(`Reverse valuation ${row.reference}? The previous share value applies again.`);
                      if (reason) {
                        reverse.mutate({ id: row.id, reason });
                      }
                    }}
                  >
                    <i className="icon-action-undo" />
                  </button>
                ) : null,
            },
          ]}
        />
      </Card>
    </SharesAccess>
  );
}
