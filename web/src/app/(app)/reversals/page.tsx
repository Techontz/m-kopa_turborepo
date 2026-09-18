"use client";

import Link from "next/link";
import { useState } from "react";

import { ApprovalActions, ApprovalStatus } from "@/components/finance/Approval";
import { approvePath, rejectPath, type ReversalRequestRow } from "@/components/loans/reversalRequest";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

const STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

const TYPES = [
  { value: "", label: "All types" },
  { value: "loan_repayment", label: "Loan Repayment" },
  { value: "loan_disbursement", label: "Loan Disbursement" },
  { value: "penalty_payment", label: "Penalty Payment" },
];

/**
 * Reversal Requests (maker/checker): Finance requests the reversal of a loan repayment, a loan disbursement or a direct
 * penalty payment from the loan page or Paid Penalty; another Finance user, an Admin or the Super Admin approves it here.
 */
export default function ReversalRequestsPage() {
  const { can } = useAuth();
  const [status, setStatus] = useState("pending");
  const [type, setType] = useState("");
  const allowed = can(["reversals.approve", "loans.reverse_repayment", "loans.reverse_disbursement", "penalties.reverse_payment"]);
  const { data: rows, isLoading } = useApi<ReversalRequestRow[]>(allowed ? "reversal-requests" : null, { status, type: type || undefined });

  return (
    <>
      <PageHeader crumbs={["Approvals", "Reversal Requests"]} />
      <Card
        title="Reversal Requests"
        actions={
          <span className="d-inline-flex">
            <select className="form-control form-control-sm mr-2" value={type} onChange={(event) => setType(event.target.value)}>
              {TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select className="form-control form-control-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
              {STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </span>
        }
      >
        {!allowed ? (
          <div className="alert alert-warning mb-0">You do not have permission to view reversal requests.</div>
        ) : (
          <>
            <div className="alert alert-info">
              A reversal is only <b>requested</b> from the loan page (repayment / disbursement) or Penalty → Paid Penalty. Nothing is posted until
              another Finance user, an Admin or the Super Admin approves it here; the requester cannot approve their own request, and the user who
              posted the original transaction can neither request nor approve its reversal.
            </div>
            <DataTable
              rows={rows}
              loading={isLoading}
              rowKey={(row) => row.id}
              emptyMessage="No reversal requests"
              columns={[
                { key: "requested_at", header: "Requested" },
                { key: "type_label", header: "Type" },
                {
                  key: "description",
                  header: "Transaction",
                  render: (row) => (
                    <span style={{ whiteSpace: "normal" }}>
                      {row.description}
                      {row.customer && <div className="text-muted small">{row.customer}</div>}
                      {row.loan_id && <div><Link href={`/loans/${row.loan_id}`} className="small">Open loan</Link></div>}
                    </span>
                  ),
                },
                { key: "branch", header: "Branch", render: (row) => row.branch ?? "—" },
                { key: "amount", header: "Amount", render: (row) => money(row.amount), value: (row) => row.amount },
                { key: "reason", header: "Reason", render: (row) => <span style={{ whiteSpace: "normal" }}>{row.reason}</span> },
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
