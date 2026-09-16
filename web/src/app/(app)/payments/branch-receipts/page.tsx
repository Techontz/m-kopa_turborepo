"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ApprovalActions, type Approvable } from "@/components/finance/Approval";
import type { Payment } from "@/components/payments/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";

type BranchReceipt = Payment & Pick<Approvable, "can_approve" | "approve_blocked_reason"> & { bank_account?: string | null };

const STATUSES = [
  { value: "pending_approval", label: "PENDING APPROVAL" },
  { value: "allocated", label: "ALLOCATED" },
  { value: "unallocated", label: "HELD IN SUSPENSE" },
  { value: "rejected", label: "REJECTED" },
  { value: "all", label: "ALL" },
];

/**
 * Payments → Branch Receipts (C6): mobile money / bank receipts entered by a branch or teller wait here as PENDING APPROVAL with
 * nothing posted. Finance approves (received into suspense and allocated to the loan — a repayment, or a recovery for a
 * written-off loan) or rejects; the teller who recorded a receipt cannot approve it.
 */
export default function BranchReceiptsPage() {
  const { can } = useAuth();
  const [status, setStatus] = useState("pending_approval");
  const { data, isLoading } = useQuery({
    queryKey: ["payments/branch-receipts", status],
    queryFn: () => api.get<{ data: BranchReceipt[]; pending_total: number }>("payments/branch-receipts", { status }),
  });

  return (
    <>
      <PageHeader crumbs={["Payments", "Branch Receipts"]} />
      <Card
        title={<>Branch receipts awaiting Finance: <b>{money(data?.pending_total)}</b></>}
        actions={
          <select className="form-control form-control-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        }
      >
        <DataTable
          rows={data?.data}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "receipt_number", header: "Receipt" },
            { key: "paid_on", header: "Date" },
            { key: "branch", header: "Branch" },
            { key: "customer", header: "Customer" },
            { key: "loan_number", header: "Loan" },
            { key: "channel", header: "Channel" },
            { key: "transaction_id", header: "Transaction ID" },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "employee", header: "Recorded by" },
            { key: "status", header: "Status", render: (row) => <><Badge tone={row.status_badge}>{row.status_label}</Badge>{row.rejection_reason && <div className="small text-muted">{row.rejection_reason}</div>}</> },
            ...(can("payments.verify")
              ? [{
                  key: "action",
                  header: "Action",
                  sortable: false,
                  render: (row: BranchReceipt) => (
                    <ApprovalActions
                      row={{ id: row.id, amount: row.amount, status: row.status === "pending_approval" ? "pending" : row.status, can_approve: row.can_approve, approve_blocked_reason: row.approve_blocked_reason, can_reject: row.can_approve }}
                      approvePath={`payments/branch-receipts/${row.id}/approve`}
                      rejectPath={`payments/branch-receipts/${row.id}/reject`}
                      description={`${row.channel} ${row.transaction_id ?? ""} for loan ${row.loan_number ?? ""}`}
                    />
                  ),
                }]
              : []),
          ]}
        />
        <small className="text-muted">A pending receipt changes no loan balance, income or profit. Approval posts Dr BANK / Cr SUSPENSE and allocates it to the loan in one step.</small>
      </Card>
    </>
  );
}
