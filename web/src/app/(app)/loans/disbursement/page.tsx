"use client";

import Link from "next/link";
import { useState } from "react";
import Swal from "sweetalert2";

import { DisbursementSourceFields } from "@/components/loans/DisbursementSourceFields";
import { EMPTY_SOURCE, sourcePayload, type SourceChoice } from "@/components/loans/disbursementSource";
import { LoanStatusBadge } from "@/components/loans/LoanStatusBadge";
import type { Loan } from "@/components/loans/types";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction } from "@/components/ui/notify";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

const TABS = [
  { status: "pending_finance", label: "Pending Finance" },
  { status: "awaiting_disbursement", label: "Awaiting Disbursement" },
  { status: "disbursement_failed", label: "Disbursement Failed" },
  { status: "escalated", label: "Escalated" },
  { status: "disbursement_suspense", label: "Suspense" },
];

interface DisburseResult {
  message: string;
  portal_url?: string | null;
}

async function askText(title: string, placeholder: string): Promise<string | null> {
  const result = await Swal.fire({ title, input: "text", inputPlaceholder: placeholder, showCancelButton: true, confirmButtonText: "Submit", inputValidator: (value) => (!value ? "Required" : undefined) });
  return result.isConfirmed ? String(result.value) : null;
}

/**
 * Finance disbursement desk (Documents: FINANCE PREPARATION → VODACOM DISBURSEMENT → CALLBACK → retry max 3 → ESCALATED).
 * Finance edits nothing on the loan: prepare the batch choosing the disbursement source (branch cash or a company bank
 * account), Disburse (then complete in the Vodacom portal), Retry, or decide on escalations.
 */
export default function DisbursementPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState(TABS[0].status);
  const [escalated, setEscalated] = useState<Loan | null>(null);
  const [decision, setDecision] = useState({ action: "", channel: "", reason: "" });
  const [decisionSource, setDecisionSource] = useState<SourceChoice>(EMPTY_SOURCE);
  const [preparing, setPreparing] = useState<Loan | null>(null);
  const [source, setSource] = useState<SourceChoice>(EMPTY_SOURCE);
  const { data, isLoading } = useApi<Loan[]>("loans", { stage: "disbursement" });

  const openPortal = (result: DisburseResult) => {
    if (result.portal_url) {
      window.open(result.portal_url, "_blank", "noopener");
    }
  };
  const prepare = useAction<{ id: number; source_account?: string; source_bank_account_id?: number }>("post", (body) => `loans/${body.id}/prepare-disbursement`);
  const disburse = useAction<{ id: number }, DisburseResult>("post", (body) => `loans/${body.id}/disburse`);
  const retry = useAction<{ id: number }, DisburseResult>("post", (body) => `loans/${body.id}/retry-disbursement`);
  const resolve = useAction<{ id: number; action: string; channel: string; reason: string; source_account?: string; source_bank_account_id?: number }>("post", (body) => `loans/${body.id}/escalation`);
  const requeue = useAction<{ id: number }>("post", (body) => `loans/${body.id}/requeue`);
  const confirm = useAction<{ id: number; reference: string }>("post", (body) => `loans/${body.id}/confirm-disbursement`);
  const cashOut = useAction<{ id: number; code: string }>("post", (body) => `loans/${body.id}/cash-out`);

  const rows = (data ?? []).filter((row) => row.status === tab);
  const count = (status: string) => (data ?? []).filter((row) => row.status === status).length;

  const actions = (row: Loan) => {
    const latest = row.latest_disbursement;
    switch (row.status) {
      case "pending_finance":
        return can("loans.prepare_disbursement") && <button type="button" className="btn btn-sm btn-primary" disabled={prepare.isPending} onClick={() => { prepare.setErrors({}); setSource(EMPTY_SOURCE); setPreparing(row); }}>Prepare Disbursement</button>;
      case "awaiting_disbursement":
        if (latest?.channel === "vodacom" && latest.status === "prepared") {
          return can("loans.disburse") && <button type="button" className="btn btn-sm btn-success" disabled={disburse.isPending} onClick={async () => (await confirmAction("Disburse via Vodacom?", `${money(latest.amount)} to ${row.customer_phone} from ${latest.source_label}`)) && disburse.mutate({ id: row.id }, { onSuccess: openPortal })}>Disburse</button>;
        }
        if (latest?.channel === "cash") {
          return can("payments.cash") ? <button type="button" className="btn btn-sm btn-info" onClick={async () => { const code = await askText("Enter withdrawal code", "Code sent by SMS"); if (code) { cashOut.mutate({ id: row.id, code }); } }}>Cash Withdrawal</button> : <small>Waiting for cash withdrawal at branch</small>;
        }
        if (latest && ["airtel", "bank"].includes(latest.channel)) {
          return can("loans.disburse") && <button type="button" className="btn btn-sm btn-info" onClick={async () => { const reference = await askText(`Confirm ${latest.channel.toUpperCase()} payment`, "Transaction reference"); if (reference) { confirm.mutate({ id: row.id, reference }); } }}>Confirm Paid</button>;
        }
        return <small>Waiting Vodacom callback</small>;
      case "disbursement_failed":
        return can("loans.disburse") && <button type="button" className="btn btn-sm btn-warning" disabled={retry.isPending} onClick={() => retry.mutate({ id: row.id }, { onSuccess: openPortal })}>Retry Disbursement</button>;
      case "escalated":
        return can("loans.disburse") && <button type="button" className="btn btn-sm btn-danger" onClick={() => { setEscalated(row); setDecision({ action: "", channel: "", reason: "" }); setDecisionSource(EMPTY_SOURCE); }}>Manual Decision</button>;
      case "disbursement_suspense":
        return can(["loans.disburse", "loans.prepare_disbursement"]) && <button type="button" className="btn btn-sm btn-primary" onClick={async () => (await confirmAction("Send back to Finance?")) && requeue.mutate({ id: row.id })}>Send to Finance</button>;
      default:
        return null;
    }
  };

  return (
    <>
      <PageHeader crumbs={["Loan", "Disbursement"]} />
      <Card title="Loan Disbursement">
        <ul className="nav nav-tabs mb-3">
          {TABS.map((item) => (
            <li className="nav-item" key={item.status}>
              <button type="button" className={`nav-link btn btn-link ${tab === item.status ? "active" : ""}`} onClick={() => setTab(item.status)}>
                {item.label} <span className="badge badge-info">{count(item.status)}</span>
              </button>
            </li>
          ))}
        </ul>
        <DataTable
          rows={rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/no.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "customer_name", header: "Customer Name", render: (row) => <Link href={`/loans/${row.id}`}>{row.customer_name}</Link> },
            { key: "customer_phone", header: "Phone Number" },
            { key: "branch", header: "Branch Name" },
            { key: "loan_number", header: "Loan Ac" },
            { key: "reference_number", header: "Reference No." },
            { key: "amount_approved", header: "Approved Loan", render: (row) => money(row.amount_approved) },
            { key: "amount", header: "Amount to Send", value: (row) => row.latest_disbursement?.amount ?? 0, render: (row) => (row.latest_disbursement ? money(row.latest_disbursement.amount) : "—") },
            { key: "batch", header: "Batch", value: (row) => row.latest_disbursement?.batch_id ?? "", render: (row) => row.latest_disbursement ? <>{row.latest_disbursement.batch_id}<br /><small>{row.latest_disbursement.channel.toUpperCase()} · {row.latest_disbursement.status}</small></> : "—" },
            { key: "source", header: "Disbursement Source", value: (row) => row.latest_disbursement?.source_label ?? "", render: (row) => row.latest_disbursement?.source_label ?? "—" },
            { key: "attempts", header: "Attempts", value: (row) => row.disbursement_attempts, render: (row) => `${row.disbursement_attempts} / 3` },
            { key: "failure", header: "Reason", value: (row) => row.latest_disbursement?.failure_reason ?? "", render: (row) => row.latest_disbursement?.failure_reason ?? "" },
            { key: "status_label", header: "Status", render: (row) => <LoanStatusBadge loan={row} /> },
            { key: "action", header: "Action", sortable: false, className: "text-nowrap", render: actions },
          ]}
        />
      </Card>

      <Modal
        open={escalated !== null}
        onClose={() => setEscalated(null)}
        title={`Escalated disbursement — ${escalated?.customer_name ?? ""}`}
        submitLabel="Submit"
        submitting={resolve.isPending}
        onSubmit={() => escalated && resolve.mutate({ id: escalated.id, ...decision, ...(decision.action === "other_channel" ? sourcePayload(decisionSource) : {}) }, { onSuccess: () => setEscalated(null) })}
      >
        <p>Disbursement failed {escalated?.disbursement_attempts} times. No ledger entry has been posted.</p>
        <div className="row">
          <Field label="Decision:" required className="col-md-12" error={resolve.fieldError("action")}>
            <select className="form-control" value={decision.action} onChange={(e) => setDecision({ ...decision, action: e.target.value })} required>
              <option value="">Select</option>
              <option value="cancel">Cancel loan</option>
              <option value="suspense">Move to suspense</option>
              <option value="other_channel">Try different channel</option>
            </select>
          </Field>
          {decision.action === "other_channel" && (
            <Field label="Channel:" required className="col-md-12" error={resolve.fieldError("channel")}>
              <select className="form-control" value={decision.channel} onChange={(e) => setDecision({ ...decision, channel: e.target.value })} required>
                <option value="">Select</option>
                <option value="airtel">AIRTEL</option>
                <option value="bank">BANK</option>
                <option value="cash">CASH (withdrawal code)</option>
              </select>
            </Field>
          )}
          {decision.action === "other_channel" && escalated && (
            <div className="col-md-12">
              <p className="mb-1"><small>Leave the source unchanged to keep {escalated.latest_disbursement?.source_label ?? "branch cash"}.</small></p>
              <DisbursementSourceFields loanId={escalated.id} value={decisionSource} onChange={setDecisionSource} fieldError={resolve.fieldError} required={false} />
            </div>
          )}
          <Field label="Reason:" required className="col-md-12" error={resolve.fieldError("reason")}>
            <textarea className="form-control" value={decision.reason} onChange={(e) => setDecision({ ...decision, reason: e.target.value })} required />
          </Field>
        </div>
      </Modal>

      <Modal
        open={preparing !== null}
        onClose={() => setPreparing(null)}
        title={`Prepare Disbursement — ${preparing?.customer_name ?? ""}`}
        submitLabel="Prepare"
        submitting={prepare.isPending}
        onSubmit={() => preparing && prepare.mutate({ id: preparing.id, ...sourcePayload(source) }, { onSuccess: () => setPreparing(null) })}
      >
        {preparing && (
          <>
            <p>
              Loan <b>{preparing.loan_number}</b> · Reference <b>{preparing.reference_number ?? "—"}</b> · Approved <b>{money(preparing.amount_approved)}</b>
              <br />Destination: <b>LOAN RECEIVABLE - {preparing.loan_number}</b> (customer loan account)
            </p>
            <DisbursementSourceFields loanId={preparing.id} value={source} onChange={setSource} fieldError={prepare.fieldError} />
          </>
        )}
      </Modal>
    </>
  );
}
