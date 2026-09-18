"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { ApprovalActions, ApprovalStatus } from "@/components/finance/Approval";
import { approvePath, rejectPath, type ReversalRequestRow } from "@/components/loans/reversalRequest";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

const STATUSES = [
  { value: "pending", label: "Waiting for approval" },
  { value: "approved", label: "Approved (posted)" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
] as const;

const TYPES = [
  { value: "", label: "All types" },
  { value: "loan_repayment", label: "Loan Repayment" },
  { value: "loan_disbursement", label: "Loan Disbursement" },
  { value: "penalty_payment", label: "Penalty Payment" },
];

type Status = (typeof STATUSES)[number]["value"];

/**
 * Reversal Requests (maker/checker). Step 1 happens elsewhere: Finance clicks Reverse on Report → Cash Transaction (repayments,
 * disbursements, top-ups), on the loan page, or on Penalty → Paid Penalty. Step 2 is here: another Finance user, an Admin or
 * the Super Admin approves (posts) or rejects. Tabs carry live counts so an empty "waiting" list is never ambiguous.
 */
export default function ReversalRequestsPage() {
  const { can } = useAuth();
  const [status, setStatus] = useState<Status>("pending");
  const [type, setType] = useState("");
  const allowed = can(["reversals.approve", "loans.reverse_repayment", "loans.reverse_disbursement", "penalties.reverse_payment"]);
  const mayApprove = can("reversals.approve");
  const { data: all, isLoading } = useApi<ReversalRequestRow[]>(allowed ? "reversal-requests" : null, { status: "all", type: type || undefined });
  const count = (value: Status) => (all ?? []).filter((row) => value === "all" || row.status === value).length;
  const rows = (all ?? []).filter((row) => status === "all" || row.status === status);

  return (
    <>
      <PageHeader crumbs={["Approvals", "Reversal Requests"]} />
      <Card
        title="Reversal Requests"
        actions={
          <select className="form-control form-control-sm" value={type} onChange={(event) => setType(event.target.value)}>
            {TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        }
      >
        {!allowed ? (
          <div className="alert alert-warning mb-0">You do not have permission to view reversal requests.</div>
        ) : (
          <>
            <div className="row mb-3">
              <Step n={1} title="Request">
                Go to <Link href="/reports/cash"><b>Report → Cash Transaction</b></Link>, click <b>Reverse</b> on the repayment, disbursement or top-up and give a
                reason. (Also on the loan page and Penalty → Paid Penalty.) Nothing is posted yet.
              </Step>
              <Step n={2} title="Approve here">
                Another Finance user, an Admin or the Super Admin clicks <b>Approve</b> below (or Reject). The requester cannot approve their own request
                {mayApprove ? "" : " — you can request, but not approve"}.
              </Step>
              <Step n={3} title="Posted">
                On approval the original journal is mirrored exactly, the row moves to <b>Approved (posted)</b> with its reversal reference, and the
                transaction leaves Cash Transaction.
              </Step>
            </div>

            <div className="btn-group mb-3 flex-wrap">
              {STATUSES.map((option) => (
                <button key={option.value} type="button" className={`btn btn-sm ${status === option.value ? "btn-primary" : "btn-default"}`} onClick={() => setStatus(option.value)}>
                  {option.label} <span className={`badge ml-1 ${status === option.value ? "badge-light" : "badge-info"}`}>{all ? count(option.value) : "…"}</span>
                </button>
              ))}
            </div>

            <DataTable
              rows={all ? rows : undefined}
              loading={isLoading}
              rowKey={(row) => row.id}
              emptyMessage={
                status === "pending"
                  ? <>Nothing is waiting for approval. To start a reversal, open <Link href="/reports/cash">Report → Cash Transaction</Link> and click Reverse.</>
                  : "No reversal requests"
              }
              columns={[
                { key: "requested_at", header: "Requested", render: (row) => <>{row.requested_at}<div className="text-muted small">by {row.requested_by ?? "—"}</div></> },
                { key: "type_label", header: "Type" },
                {
                  key: "description",
                  header: "Transaction",
                  render: (row) => (
                    <span style={{ whiteSpace: "normal" }}>
                      {row.description}
                      {row.customer && <div className="text-muted small">{row.customer}{row.branch ? ` · ${row.branch}` : ""}</div>}
                      {row.loan_id && <div><Link href={`/loans/${row.loan_id}`} className="small">Open loan</Link></div>}
                    </span>
                  ),
                },
                { key: "amount", header: "Amount", render: (row) => money(row.amount), value: (row) => row.amount },
                { key: "reason", header: "Reason", render: (row) => <span style={{ whiteSpace: "normal" }}>{row.reason}</span> },
                { key: "effect", header: "On approval", sortable: false, render: (row) => <span className="small" style={{ whiteSpace: "normal", display: "block", maxWidth: 280 }}>{row.effect}</span> },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => (
                    <>
                      <ApprovalStatus row={row} />
                      {row.reversal_reference && <div className="text-muted small">{row.reversal_reference}</div>}
                    </>
                  ),
                },
                {
                  key: "actions",
                  header: "Action",
                  sortable: false,
                  render: (row) => (
                    <ApprovalActions row={row} approvePath={approvePath(row)} rejectPath={rejectPath(row)} description={`reversal of ${row.description}`} />
                  ),
                },
              ]}
            />
          </>
        )}
      </Card>
    </>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="col-md-4 mb-2">
      <div className="border rounded p-3 h-100">
        <div className="mb-1">
          <span className="badge badge-primary mr-2">{n}</span>
          <b>{title}</b>
        </div>
        <div className="small">{children}</div>
      </div>
    </div>
  );
}
