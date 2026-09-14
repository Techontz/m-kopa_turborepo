"use client";

import { useState } from "react";

import { SharesAccess } from "@/components/shares/SharesAccess";
import { SharesNav } from "@/components/shares/SharesNav";
import { parseAmount, projectTransfer, sharesLabel } from "@/components/shares/shares";
import type { ShareHolderRow, SharesOverview } from "@/components/shares/types";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FileField } from "@/components/ui/FileField";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { confirmAction } from "@/components/ui/notify";
import { useAuth } from "@/lib/auth";
import { money, percent, todayIso } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";
import { newIdempotencyKey } from "@/lib/idempotency";

const EMPTY = { from_share_holder_id: "", to_share_holder_id: "", shares: "", consideration_per_share: "", transfer_date: todayIso(), notes: "" };
const DOCUMENT_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "webp"];
const DOCUMENT_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

/**
 * Shares → Transfer Shares. Existing shares move between two shareholders; total issued shares never change and no
 * company ledger entry is posted (the consideration is recorded for information only).
 */
export default function TransferSharesPage() {
  const { can } = useAuth();
  const allowed = can("shares.transfer");
  const { data: overview } = useApi<SharesOverview>(allowed ? "shares/overview" : null);
  const { data: holders = [] } = useApi<ShareHolderRow[]>(allowed ? "shares/share-holders" : null);
  const [form, setForm] = useState(EMPTY);
  const [document, setDocument] = useState<File | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [key, setKey] = useState(() => newIdempotencyKey("share-transfer"));
  const transfer = useAction<FormData>("post", "shares/transfers");
  const set = (field: keyof typeof EMPTY) => (event: { target: { value: string } }) => setForm({ ...form, [field]: event.target.value });

  const fromId = Number(form.from_share_holder_id);
  const toId = Number(form.to_share_holder_id);
  const shares = Math.trunc(parseAmount(form.shares)) || 0;
  const source = holders.find((row) => row.id === fromId);
  const shareValue = overview?.current_share_value ?? 0;
  const projection = projectTransfer(holders.map((row) => ({ id: row.id, name: row.name, shares: row.shares })), fromId, toId, shares, shareValue);
  const consideration = parseAmount(form.consideration_per_share);

  const submit = async () => {
    if (!(await confirmAction("Transfer shares?", `${sharesLabel(shares)} shares from ${source?.name ?? ""} to ${holders.find((row) => row.id === toId)?.name ?? ""}.`))) {
      return;
    }
    const body = new FormData();
    for (const [field, value] of Object.entries(form)) {
      if (value !== "") {
        body.append(field, value);
      }
    }
    body.append("idempotency_key", key);
    if (document) {
      body.append("document", document);
    }
    transfer.mutate(body, {
      onSuccess: () => {
        setForm(EMPTY);
        setDocument(null);
        setFormKey((value) => value + 1);
        setKey(newIdempotencyKey("share-transfer"));
      },
    });
  };

  return (
    <SharesAccess permission="shares.transfer" crumbs={["Shares", "Transfer Shares"]}>
      <PageHeader crumbs={["Shares", "Transfer Shares"]} />
      <SharesNav />
      <Card title="Transfer Shares">
        <form key={formKey} onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <div className="row">
            <Field label="From Shareholder:" required className="col-lg-4 col-md-6" error={transfer.fieldError("from_share_holder_id")}>
              <SelectBox inputId="transfer-from" placeholder="Select Shareholder" optionsUrl="shares/options/share-holders" query={{ holding: 1 }} value={form.from_share_holder_id} onChange={(value) => setForm({ ...form, from_share_holder_id: value ?? "" })} />
              {source && <small className="text-muted">Holds {sharesLabel(source.shares)} shares</small>}
            </Field>
            <Field label="To Shareholder:" required className="col-lg-4 col-md-6" error={transfer.fieldError("to_share_holder_id")}>
              <SelectBox inputId="transfer-to" placeholder="Select Shareholder" optionsUrl="shares/options/share-holders" value={form.to_share_holder_id} onChange={(value) => setForm({ ...form, to_share_holder_id: value ?? "" })} />
              {fromId > 0 && fromId === toId && <small className="text-danger">Choose a different receiving shareholder</small>}
            </Field>
            <Field label="Shares:" required className="col-lg-4 col-md-6" error={transfer.fieldError("shares")}>
              <input className="form-control" inputMode="numeric" value={form.shares} onChange={set("shares")} required />
              {source && shares > source.shares && <small className="text-danger">More than the {sharesLabel(source.shares)} shares held</small>}
            </Field>
            <Field label="Transfer Date:" required className="col-lg-4 col-md-6" error={transfer.fieldError("transfer_date")}>
              <input type="date" className="form-control" max={todayIso()} value={form.transfer_date} onChange={set("transfer_date")} required />
            </Field>
            <Field label="Consideration per Share (optional):" className="col-lg-4 col-md-6" error={transfer.fieldError("consideration_per_share")}>
              <input className="form-control" inputMode="decimal" placeholder="Information only" value={form.consideration_per_share} onChange={set("consideration_per_share")} />
              {Number.isFinite(consideration) && shares > 0 && <small className="text-muted">Total consideration {money(consideration * shares)}</small>}
            </Field>
            <Field label="Notes:" className="col-lg-4 col-md-6" error={transfer.fieldError("notes")}>
              <input className="form-control" value={form.notes} onChange={set("notes")} />
            </Field>
            <Field label="Supporting Document:" className="col-lg-6 col-md-6">
              <FileField file={document} onChange={setDocument} accept={DOCUMENT_ACCEPT} extensions={DOCUMENT_EXTENSIONS} maxMb={5} placeholder="Upload transfer form (PDF / image)" error={transfer.fieldError("document")} />
            </Field>
          </div>
          <p className="text-muted mb-2"><small>No company ledger entry: the company&apos;s cash is unchanged. Total issued shares stay {sharesLabel(overview?.total_issued_shares)}.</small></p>

          {projection.valid && (
            <div className="table-responsive">
              <table className="table table-custom table-sm">
                <thead className="thead-info"><tr><th>Shareholder (after transfer)</th><th className="text-right">Shares</th><th className="text-right">Ownership %</th><th className="text-right">Holding Value</th></tr></thead>
                <tbody>
                  {projection.rows.filter((row) => row.shares > 0 || row.id === fromId).map((row) => (
                    <tr key={row.id} className={row.id === fromId || row.id === toId ? "font-weight-bold" : undefined}>
                      <td>{row.name}</td>
                      <td className="text-right">{sharesLabel(row.shares)}</td>
                      <td className="text-right">{percent(row.ownership_percent)}</td>
                      <td className="text-right">{money(row.holding_value)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><th>Total issued shares (unchanged)</th><th className="text-right">{sharesLabel(projection.total)}</th><th className="text-right">100%</th><th className="text-right">{money(projection.total * shareValue)}</th></tr></tfoot>
              </table>
            </div>
          )}

          <div className="text-center m-t-20">
            <button type="submit" className="btn btn-primary" disabled={transfer.isPending || (shares > 0 && !projection.valid)}><i className="icon-shuffle" /> Transfer Shares</button>
          </div>
        </form>
      </Card>
    </SharesAccess>
  );
}
