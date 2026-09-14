"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { SharesAccess } from "@/components/shares/SharesAccess";
import { SharesNav } from "@/components/shares/SharesNav";
import { allocationStatus, holdingValue, initialShareValue, ownershipPercent, parseAmount, sharesLabel } from "@/components/shares/shares";
import type { SharesOverview } from "@/components/shares/types";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox, type Option } from "@/components/ui/SelectBox";
import { useAuth } from "@/lib/auth";
import { money, percent, todayIso } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";
import { newIdempotencyKey } from "@/lib/idempotency";

interface AllocationForm {
  share_holder_id: string;
  shares: string;
  treatment: "" | "linked_contribution" | "paid" | "no_cash";
  capital_id: string;
  pay_method: string;
  bank_account_id: string;
  receipt_number: string;
}

const EMPTY_LINE: AllocationForm = { share_holder_id: "", shares: "", treatment: "", capital_id: "", pay_method: "", bank_account_id: "", receipt_number: "" };

const TREATMENTS = [
  { value: "linked_contribution", label: "Link a recorded capital contribution (no new journal)" },
  { value: "paid", label: "Record the payment now (Dr Cash/Bank, Cr Share Capital)" },
  { value: "no_cash", label: "Allocate without cash (no journal)" },
];

/**
 * Shares → Overview → Set Up: capital basis ÷ number of shares gives the initial share value; the initial allocation
 * must allocate every initial share, and each founder line states explicitly how the shares were paid for.
 */
export default function ShareSetupPage() {
  const router = useRouter();
  const { can } = useAuth();
  const { data: overview } = useApi<SharesOverview>(can("shares.manage") ? "shares/overview" : null);
  const { data: holders = [] } = useApi<Option[]>(can("shares.manage") ? "shares/options/share-holders" : null);
  const [form, setForm] = useState({ capital_basis: "", total_shares: "", authorised_shares: "", established_on: todayIso(), notes: "" });
  const [lines, setLines] = useState<AllocationForm[]>([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
  const [idempotencyKey] = useState(() => newIdempotencyKey("share-structure"));
  const save = useAction<Record<string, unknown>>("post", "shares/structure");

  const basis = parseAmount(form.capital_basis);
  const total = Math.trunc(parseAmount(form.total_shares));
  const shareValue = initialShareValue(basis, total);
  const status = allocationStatus(lines, total);
  const setLine = (index: number, patch: Partial<AllocationForm>) => setLines(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  const holderName = (id: string) => holders.find((option) => option.value === id)?.label.split(" — ")[0] ?? "";

  const submit = () => {
    save.mutate(
      {
        capital_basis: form.capital_basis,
        total_shares: form.total_shares,
        authorised_shares: form.authorised_shares || null,
        established_on: form.established_on,
        notes: form.notes || null,
        idempotency_key: idempotencyKey,
        allocations: lines.map((line) => ({
          share_holder_id: line.share_holder_id,
          shares: line.shares,
          treatment: line.treatment,
          capital_id: line.treatment === "linked_contribution" ? line.capital_id || null : null,
          pay_method: line.treatment === "paid" ? line.pay_method || null : null,
          bank_account_id: line.treatment === "paid" && line.pay_method === "BANK" ? line.bank_account_id || null : null,
          receipt_number: line.treatment === "paid" ? line.receipt_number || null : null,
        })),
      },
      { onSuccess: () => router.push("/shares") },
    );
  };

  return (
    <SharesAccess permission="shares.manage" crumbs={["Shares", "Set Up Share Structure"]}>
      <PageHeader crumbs={["Shares", "Set Up Share Structure"]} />
      <SharesNav />

      {overview?.has_structure ? (
        <Card title="Share Structure">
          <div className="alert alert-info mb-0">The share structure has already been set up. New shares are added through Issue Shares.</div>
        </Card>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Card title="Share Structure">
            <div className="row">
              <Field label="Capital Basis:" required className="col-lg-3 col-md-6" error={save.fieldError("capital_basis")}>
                <input className="form-control" inputMode="decimal" placeholder="e.g. 50,000,000" value={form.capital_basis} onChange={(e) => setForm({ ...form, capital_basis: e.target.value })} required />
              </Field>
              <Field label="Number of Shares:" required className="col-lg-3 col-md-6" error={save.fieldError("total_shares")}>
                <input className="form-control" inputMode="numeric" placeholder="e.g. 1,000" value={form.total_shares} onChange={(e) => setForm({ ...form, total_shares: e.target.value })} required />
              </Field>
              <Field label="Initial Share Value:" className="col-lg-3 col-md-6">
                <input className="form-control" readOnly value={shareValue > 0 ? money(shareValue) : ""} placeholder="Capital basis ÷ shares" />
              </Field>
              <Field label="Authorised Share Limit (optional):" className="col-lg-3 col-md-6" error={save.fieldError("authorised_shares")}>
                <input className="form-control" inputMode="numeric" placeholder="No limit" value={form.authorised_shares} onChange={(e) => setForm({ ...form, authorised_shares: e.target.value })} />
              </Field>
              <Field label="Structure Date:" required className="col-lg-3 col-md-6" error={save.fieldError("established_on")}>
                <input type="date" className="form-control" max={todayIso()} value={form.established_on} onChange={(e) => setForm({ ...form, established_on: e.target.value })} required />
              </Field>
              <Field label="Notes:" className="col-lg-9 col-md-6" error={save.fieldError("notes")}>
                <input className="form-control" placeholder="e.g. Board resolution reference" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </Field>
            </div>
          </Card>

          <Card
            title="Initial Allocation"
            actions={<button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setLines([...lines, { ...EMPTY_LINE }])}><i className="icon-plus" /> Add line</button>}
          >
            <p className="text-muted">
              Shareholders are registered in Capital → Shareholders. Choose for every line how the shares were paid for — money already recorded as a capital
              contribution is linked and never posted twice.
            </p>
            {save.fieldError("allocations") && <div className="alert alert-danger">{save.fieldError("allocations")}</div>}
            {lines.map((line, index) => {
              const error = (field: string) => save.fieldError(`allocations.${index}.${field}`);
              const lineShares = Math.trunc(parseAmount(line.shares)) || 0;
              return (
                <div className="row border-bottom pb-2 mb-2" key={index}>
                  <Field label="Shareholder:" required className="col-lg-3 col-md-6" error={error("share_holder_id")}>
                    <SelectBox inputId={`holder-${index}`} placeholder="Select Shareholder" options={holders} value={line.share_holder_id} onChange={(value) => setLine(index, { share_holder_id: value ?? "", capital_id: "" })} />
                  </Field>
                  <Field label="Shares:" required className="col-lg-2 col-md-6" error={error("shares")}>
                    <input className="form-control" inputMode="numeric" placeholder="Shares" value={line.shares} onChange={(e) => setLine(index, { shares: e.target.value })} required />
                    {lineShares > 0 && total > 0 && <small className="text-muted">{percent(ownershipPercent(lineShares, total))} · {money(holdingValue(lineShares, shareValue))}</small>}
                  </Field>
                  <Field label="Payment:" required className="col-lg-4 col-md-6" error={error("treatment")}>
                    <select className="form-control" value={line.treatment} onChange={(e) => setLine(index, { treatment: e.target.value as AllocationForm["treatment"] })} required>
                      <option value="">Select how the shares were paid for</option>
                      {TREATMENTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </Field>
                  {line.treatment === "linked_contribution" && (
                    <Field label="Capital Contribution:" required className="col-lg-3 col-md-6" error={error("capital_id")}>
                      <SelectBox
                        inputId={`capital-${index}`}
                        placeholder={line.share_holder_id ? "Select contribution" : "Select shareholder first"}
                        optionsUrl={line.share_holder_id ? "shares/options/contributions" : undefined}
                        query={{ share_holder_id: line.share_holder_id }}
                        isDisabled={!line.share_holder_id}
                        value={line.capital_id}
                        onChange={(value) => setLine(index, { capital_id: value ?? "" })}
                      />
                    </Field>
                  )}
                  {line.treatment === "paid" && (
                    <>
                      <Field label="Pay Method:" required className="col-lg-1 col-md-3" error={error("pay_method")}>
                        <select className="form-control" value={line.pay_method} onChange={(e) => setLine(index, { pay_method: e.target.value, bank_account_id: "" })} required>
                          <option value="">Select</option>
                          <option value="CASH">CASH</option>
                          <option value="BANK">BANK</option>
                        </select>
                      </Field>
                      <Field label="Receiving Account:" required className="col-lg-2 col-md-3" error={error("bank_account_id")}>
                        {line.pay_method === "BANK" ? (
                          <SelectBox inputId={`bank-${index}`} placeholder="Select Bank" optionsUrl="shares/options/bank-accounts" value={line.bank_account_id} onChange={(value) => setLine(index, { bank_account_id: value ?? "" })} />
                        ) : (
                          <input className="form-control" readOnly value={line.pay_method === "CASH" ? "COMPANY ACCOUNT" : ""} />
                        )}
                      </Field>
                      <Field label="Amount:" className="col-lg-2 col-md-3">
                        <input className="form-control" readOnly value={money(holdingValue(lineShares, shareValue))} />
                      </Field>
                      <Field label="Receipt No:" className="col-lg-2 col-md-3" error={error("receipt_number")}>
                        <input className="form-control" value={line.receipt_number} onChange={(e) => setLine(index, { receipt_number: e.target.value })} />
                      </Field>
                    </>
                  )}
                  <div className="col-12 text-right">
                    {lines.length > 1 && (
                      <button type="button" className="btn btn-sm btn-link text-danger" onClick={() => setLines(lines.filter((_, i) => i !== index))}>
                        Remove {holderName(line.share_holder_id) || "line"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <p className={status.complete ? "text-success" : "text-warning"}>
              Allocated {sharesLabel(status.allocated)} of {sharesLabel(total > 0 ? total : 0)} shares
              {!status.complete && total > 0 && ` — ${sharesLabel(Math.abs(status.remaining))} ${status.remaining > 0 ? "still to allocate" : "too many"}`}
            </p>
            <div className="text-center m-t-20">
              <button type="submit" className="btn btn-primary" disabled={save.isPending || !status.complete}>
                <i className="icon-drawer" /> Create Share Structure
              </button>
            </div>
          </Card>
        </form>
      )}
    </SharesAccess>
  );
}
