"use client";

import Link from "next/link";
import { useState } from "react";

import { approvableCount, approvalState, visibleGroups, type PendingApprovalRow, type PendingApprovals } from "@/components/finance/pendingApprovals";
import { Badge } from "@/components/ui/Badge";
import { Loading } from "@/components/ui/Loading";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

/**
 * Pending Approvals (C6): every item waiting for a checker across the maker/checker workflows the user may see — grouped by
 * workflow with counts. Approve or reject on the module page (Open); the initiator sees why another user must approve.
 */
export default function PendingApprovalsPage() {
  const { can } = useAuth();
  const allowed = can("approvals.view");
  const { data, isLoading, error } = useApi<PendingApprovals>(allowed ? "approvals/pending" : null);
  const [showEmpty, setShowEmpty] = useState(false);
  const groups = visibleGroups(data?.groups, showEmpty);

  return (
    <>
      <PageHeader crumbs={["Approvals", "Pending Approvals"]} />
      {!allowed ? (
        <Card><div className="alert alert-warning mb-0">You do not have permission to view pending approvals.</div></Card>
      ) : (
        <>
          <Card
            title={<>Pending Approvals: <b>{data?.total_count ?? 0}</b> items · <b>{money(data?.total_amount)}</b> · you can approve <b>{approvableCount(data?.groups)}</b></>}
            actions={
              <label className="mb-0 small text-nowrap">
                <input type="checkbox" className="mr-1" checked={showEmpty} onChange={(event) => setShowEmpty(event.target.checked)} /> Show workflows with nothing pending
              </label>
            }
          >
            {error && <div className="alert alert-danger">{error instanceof Error ? error.message : "Pending approvals could not be loaded."}</div>}
            {isLoading && <Loading />}
            {data && (
              <div className="d-flex flex-wrap">
                {data.groups.map((group) => (
                  <a key={group.workflow} href={`#${group.workflow}`} className="mr-2 mb-2">
                    <Badge tone={group.count > 0 ? "warning" : "default"}>{group.label.toUpperCase()}: {group.count}</Badge>
                  </a>
                ))}
              </div>
            )}
            <small className="text-muted">
              Nothing in this list is posted yet. Maker/checker: the user who initiated an item cannot approve it unless the company approval policy allows
              self-approval for that workflow and the user explicitly holds &quot;Approve own financial transactions&quot;.
            </small>
          </Card>
          {groups.map((group) => (
            <div key={group.workflow} id={group.workflow}>
              <Card title={<>{group.label} <Badge tone={group.count > 0 ? "warning" : "default"}>{group.count}</Badge> <small className="text-muted">{money(group.amount)}</small></>}>
                <DataTable
                  rows={group.rows}
                  rowKey={(row) => `${row.workflow}-${row.id}`}
                  emptyMessage="Nothing pending"
                  columns={[
                    { key: "requested_at", header: "Requested" },
                    { key: "description", header: "Transaction" },
                    { key: "branch", header: "Branch", render: (row) => row.branch ?? "—" },
                    { key: "amount", header: "Amount", render: (row) => money(row.amount), value: (row) => row.amount },
                    { key: "requested_by", header: "Requested By", render: (row) => row.requested_by ?? "—" },
                    { key: "status", header: "Status", render: (row) => row.status.replace(/_/g, " ").toUpperCase() },
                    {
                      key: "approval",
                      header: "Approval",
                      value: (row) => approvalState(row).label,
                      render: (row: PendingApprovalRow) => {
                        const state = approvalState(row);
                        return (
                          <span title={state.title ?? undefined} style={{ whiteSpace: "normal" }}>
                            <Badge tone={state.tone}>{state.label}</Badge>
                            {row.approve_blocked_reason && <div className="small text-muted">{row.approve_blocked_reason}</div>}
                          </span>
                        );
                      },
                    },
                    { key: "link", header: "", sortable: false, render: (row) => <Link href={row.link} className="btn btn-sm btn-primary text-nowrap"><i className="icon-arrow-right" /> Open</Link> },
                  ]}
                />
              </Card>
            </div>
          ))}
        </>
      )}
    </>
  );
}
