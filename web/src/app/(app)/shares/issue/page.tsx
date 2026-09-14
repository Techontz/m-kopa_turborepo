"use client";

import Link from "next/link";
import { useState } from "react";

import { SharesAccess } from "@/components/shares/SharesAccess";
import { SharesNav } from "@/components/shares/SharesNav";
import { parseAmount, projectIssuance, sharesLabel } from "@/components/shares/shares";
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

interface IssueForm {
  share_holder_id: string;
  type: "issuance" | "bonus_issuance";
  payment_treatment: "" | "paid" | "linked_contribution";
  shares: string;
  price_per_share: string;
  issue_date: string;
  pay_method: string;
  bank_account_id: string;
  capital_id: string;
  receipt_number: string;
  cheque_number: string;
  notes: string;
}

const EMPTY: IssueForm = { share_holder_id: "", type: "issuance", payment_treatment: "paid", shares: "", price_per_share: "", issue_date: todayIso(), pay_method: "", bank_account_id: "", capital_id: "", receipt_number: "", cheque_number: "", notes: "" };
const DOCUMENT_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "webp"];
const DOCUMENT_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

/**
 * Shares → Issue Shares. New shares increase total issued shares and dilute every holder. A paid issuance is recorded
 * as a capital contribution: Dr COMPANY ACCOUNT (cash) or the receiving bank / Cr CAPITAL ACCOUNT (share capital).
 */
export default function IssueSharesPage() {
  const { can } = useAuth();
  const allowed = can("shares.issue");
  const { data: overview } = useApi<SharesOverview>(allowed ? "shares/overview" : null);
  const { data: holders = [] } = useApi<ShareHolderRow[]>(allowed ? "shares/share-holders" : null);
  const [form, setForm] = useState<IssueForm>(EMPTY);
  const [document, setDocument] = useState<File | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [key, setKey] = useState(() => newIdempotencyKey("share-issue"));
  const issue = useAction<FormData>("post", "shares/issuances");
  const set = (field: keyof IssueForm) => (event: { target: { value: string } }) => setForm({ ...form, [field]: event.target.value });

  const shares = Math.trunc(parseAmount(form.shares)) || 0;
  const currentValue = overview?.current_share_value ?? 0;
  const price = form.price_per_share === "" ? currentValue : parseAmount(form.price_per_share);
  const amount = form.type === "issuance" && Number.isFinite(price) ? Math.round(shares * price * 100) / 100 : 0;
  const holderId = Number(form.share_holder_id);
  const projection = projectIssuance(holders.map((row) => ({ id: row.id, name: row.name, shares: row.shares })), holderId, shares, currentValue);
  const overLimit = overview?.available_shares !== null && overview?.available_shares !== undefined && shares > overview.available_shares;

  const submit = async () => {
    if (!(await confirmAction("Issue shares?", `${sharesLabel(shares)} shares to ${holders.find((row) => row.id === holderId)?.name ?? ""}${amount > 0 ? ` for ${money(amount)}` : ""}.`))) {
      return;
    }
    const body = new FormData();
    const skip = new Set<string>();
    if (form.type === "bonus_issuance") {
      ["payment_treatment", "price_per_share", "pay_method", "bank_account_id", "capital_id", "receipt_number", "cheque_number"].forEach((field) => skip.add(field));
    } else if (form.payment_treatment !== "paid") {
      ["pay_method", "bank_account_id", "receipt_number", "cheque_number"].forEach((field) => skip.add(field));
    } else {
      skip.add("capital_id");
    }
    if (form.pay_method !== "BANK") {
      skip.add("bank_account_id");
    }
    for (const [field, value] of Object.entries(form)) {
      if (value !== "" && !skip.has(field)) {
        body.append(field, value);
      }
    }
    body.append("idempotency_key", key);
    if (document) {
      body.append("document", document);
    }
    issue.mutate(body, {
      onSuccess: () => {
        setForm(EMPTY);
        setDocument(null);
        setFormKey((value) => value + 1);
        setKey(newIdempotencyKey("share-issue"));
      },
    });
  };

  return (
    <SharesAccess permission="shares.issue" crumbs={["Shares", "Issue Shares"]}>
      <PageHeader crumbs={["Shares", "Issue Shares"]} right={can("capital.manage") && <Link href="/capital/share-holders" className="btn btn-secondary"><i className="icon-user-follow" /> Register New Investor</Link>} />
      <SharesNav />

      {overview && !overview.has_structure ? (
        <Card title="Issue Shares"><div className="alert alert-warning mb-0">Set up the share structure first (Shares → Overview).</div></Card>
      ) : (
        <Card title="Issue Shares">
          <form key={formKey} onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            <div className="row">
              <Field label="Shareholder / Investor:" required className="col-lg-4 col-md-6" error={issue.fieldError("share_holder_id")}>
                <SelectBox inputId="issue-holder" placeholder="Select Shareholder" optionsUrl="shares/options/share-holders" value={form.share_holder_id} onChange={(value) => setForm({ ...form, share_holder_id: value ?? "", capital_id: "" })} />
              </Field>
              <Field label="Issue Type:" required className="col-lg-4 col-md-6" error={issue.fieldError("type")}>
                <select className="form-control" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as IssueForm["type"] })}>
                  <option value="issuance">Share issuance (paid)</option>
                  <option value="bonus_issuance">Bonus issuance (non-cash, no journal)</option>
                </select>
              </Field>
              <Field label="Shares:" required className="col-lg-4 col-md-6" error={issue.fieldError("shares")}>
                <input className="form-control" inputMode="numeric" placeholder="Number of shares" value={form.shares} onChange={set("shares")} required />
                {overview?.available_shares !== null && overview?.available_shares !== undefined && (
                  <small className={overLimit ? "text-danger" : "text-muted"}>Available under the authorised limit: {sharesLabel(overview.available_shares)}</small>
                )}
              </Field>
              <Field label="Issue Date:" required className="col-lg-4 col-md-6" error={issue.fieldError("issue_date")}>
                <input type="date" className="form-control" max={todayIso()} value={form.issue_date} onChange={set("issue_date")} required />
              </Field>
              {form.type === "issuance" && (
                <>
                  <Field label="Issue Price per Share:" className="col-lg-4 col-md-6" error={issue.fieldError("price_per_share")}>
                    <input className="form-control" inputMode="decimal" placeholder={`Current share value ${money(currentValue)}`} value={form.price_per_share} onChange={set("price_per_share")} />
                  </Field>
                  <Field label="Subscription Amount:" className="col-lg-4 col-md-6">
                    <input className="form-control" readOnly value={money(amount)} />
                  </Field>
                  <Field label="Payment:" required className="col-lg-4 col-md-6" error={issue.fieldError("payment_treatment")}>
                    <select className="form-control" value={form.payment_treatment} onChange={(e) => setForm({ ...form, payment_treatment: e.target.value as IssueForm["payment_treatment"] })} required>
                      <option value="paid">Record the payment now</option>
                      <option value="linked_contribution">Link a recorded capital contribution</option>
                    </select>
                  </Field>
                  {form.payment_treatment === "paid" ? (
                    <>
                      <Field label="Pay Method:" required className="col-lg-4 col-md-6" error={issue.fieldError("pay_method")}>
                        <select className="form-control" value={form.pay_method} onChange={(e) => setForm({ ...form, pay_method: e.target.value, bank_account_id: "" })} required>
                          <option value="">Select</option>
                          <option value="CASH">CASH</option>
                          <option value="BANK">BANK</option>
                        </select>
                      </Field>
                      <Field label="Receiving Account:" required className="col-lg-4 col-md-6" error={issue.fieldError("bank_account_id")}>
                        {form.pay_method === "BANK" ? (
                          <SelectBox inputId="issue-bank" placeholder="Select Bank Account" optionsUrl="shares/options/bank-accounts" value={form.bank_account_id} onChange={(value) => setForm({ ...form, bank_account_id: value ?? "" })} />
                        ) : (
                          <input className="form-control" readOnly value={form.pay_method === "CASH" ? "COMPANY ACCOUNT (cash)" : "Select pay method first"} />
                        )}
                      </Field>
                      <Field label="Receipt / Reference No:" className="col-lg-2 col-md-6" error={issue.fieldError("receipt_number")}>
                        <input className="form-control" value={form.receipt_number} onChange={set("receipt_number")} />
                      </Field>
                      <Field label="Cheque No:" className="col-lg-2 col-md-6" error={issue.fieldError("cheque_number")}>
                        <input className="form-control" value={form.cheque_number} onChange={set("cheque_number")} />
                      </Field>
                    </>
                  ) : (
                    <Field label="Capital Contribution:" required className="col-lg-8 col-md-6" error={issue.fieldError("capital_id")}>
                      <SelectBox
                        inputId="issue-capital"
                        placeholder={form.share_holder_id ? "Select an unlinked contribution" : "Select shareholder first"}
                        optionsUrl={form.share_holder_id ? "shares/options/contributions" : undefined}
                        query={{ share_holder_id: form.share_holder_id }}
                        isDisabled={!form.share_holder_id}
                        value={form.capital_id}
                        onChange={(value) => setForm({ ...form, capital_id: value ?? "" })}
                      />
                    </Field>
                  )}
                </>
              )}
              <Field label="Notes:" className="col-lg-6 col-md-6" error={issue.fieldError("notes")}>
                <input className="form-control" value={form.notes} onChange={set("notes")} />
              </Field>
              <Field label={form.type === "issuance" && form.payment_treatment === "paid" ? "Receipt Document:" : "Supporting Document:"} className="col-lg-6 col-md-6">
                <FileField file={document} onChange={setDocument} accept={DOCUMENT_ACCEPT} extensions={DOCUMENT_EXTENSIONS} maxMb={5} placeholder="Upload document (PDF / image)" error={issue.fieldError("document")} />
              </Field>
            </div>
            <p className="text-muted mb-2">
              <small>
                {form.type === "bonus_issuance"
                  ? "Bonus shares are issued without cash: no journal entry is posted."
                  : form.payment_treatment === "paid"
                    ? "Posting: Dr receiving account (COMPANY ACCOUNT or the bank) / Cr CAPITAL ACCOUNT (share capital), recorded as a capital contribution linked to this issuance."
                    : "The selected contribution was already posted to the ledger; no second journal entry is posted."}
              </small>
            </p>

            {shares > 0 && holderId > 0 && (
              <div className="table-responsive">
                <table className="table table-custom table-sm">
                  <thead className="thead-info"><tr><th>Shareholder (after issue)</th><th className="text-right">Shares</th><th className="text-right">Ownership %</th><th className="text-right">Holding Value</th></tr></thead>
                  <tbody>
                    {projection.rows.filter((row) => row.shares > 0).map((row) => (
                      <tr key={row.id} className={row.id === holderId ? "font-weight-bold" : undefined}>
                        <td>{row.name}</td>
                        <td className="text-right">{sharesLabel(row.shares)}</td>
                        <td className="text-right">{percent(row.ownership_percent)}</td>
                        <td className="text-right">{money(row.holding_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr><th>Total issued shares</th><th className="text-right">{sharesLabel(projection.total)}</th><th className="text-right">100%</th><th className="text-right">{money(projection.total * currentValue)}</th></tr></tfoot>
                </table>
              </div>
            )}

            <div className="text-center m-t-20">
              <button type="submit" className="btn btn-primary" disabled={issue.isPending || overLimit}><i className="icon-drawer" /> Issue Shares</button>
            </div>
          </form>
        </Card>
      )}
    </SharesAccess>
  );
}
