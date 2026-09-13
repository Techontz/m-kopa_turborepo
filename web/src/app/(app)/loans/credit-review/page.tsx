"use client";

import Link from "next/link";

import { LoanStatusBadge } from "@/components/loans/LoanStatusBadge";
import type { Loan } from "@/components/loans/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction, promptReason } from "@/components/ui/notify";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

/**
 * Credit officer review (handwritten note: 4 buttons — Verification, Approve, Reject (sababu), Modify → back to loan officer).
 * Approval is only possible after the Vodacom name/number verification matched; the reference number is generated on approval.
 */
export default function CreditReviewPage() {
  const { data, isLoading } = useApi<Loan[]>("loans", { stage: "credit-review" });
  const verify = useAction<{ id: number }>("post", (body) => `loans/${body.id}/kyc-verify`);
  const approve = useAction<{ id: number }>("post", (body) => `loans/${body.id}/approve-credit`);
  const reject = useAction<{ id: number; reason: string }>("post", (body) => `loans/${body.id}/reject`);
  const modify = useAction<{ id: number; reason: string }>("post", (body) => `loans/${body.id}/modify`);

  return (
    <>
      <PageHeader crumbs={["Loan", "Credit Review"]} />
      <Card title="Credit Review List">
        <DataTable
          rows={data}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "loan_number", header: "Loan AC/No" },
            { key: "customer_name", header: "customer name", render: (row) => <Link href={`/loans/${row.id}`}>{row.customer_name}</Link> },
            { key: "customer_phone", header: "Phone Number" },
            { key: "branch", header: "Branch" },
            { key: "category", header: "Loan Product" },
            { key: "amount_approved", header: "Approved Loan", render: (row) => money(row.amount_approved) },
            { key: "duration_label", header: "Loan Duration" },
            { key: "sessions", header: "Number of repayments" },
            {
              key: "telco",
              header: "Vodacom Verification",
              value: (row) => row.telco_name ?? "",
              render: (row) => row.telco_verified_at === null
                ? <Badge tone="warning">NOT VERIFIED</Badge>
                : <><Badge tone={row.telco_matched ? "success" : "danger"}>{row.telco_matched ? "MATCHED" : "MISMATCH"}</Badge> <small>{row.telco_name ?? "not registered"}</small></>,
            },
            { key: "status_label", header: "Loan Status", render: (row) => <LoanStatusBadge loan={row} /> },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  <button type="button" className="btn btn-sm btn-info mr-1" disabled={verify.isPending} onClick={() => verify.mutate({ id: row.id })}>Verification</button>
                  <button type="button" className="btn btn-sm btn-success mr-1" disabled={!row.telco_matched || approve.isPending} onClick={async () => (await confirmAction("Approve this loan?")) && approve.mutate({ id: row.id })}>Approve</button>
                  <button type="button" className="btn btn-sm btn-danger mr-1" onClick={async () => { const reason = await promptReason("Reject loan"); if (reason) { reject.mutate({ id: row.id, reason }); } }}>Reject</button>
                  <button type="button" className="btn btn-sm btn-warning" onClick={async () => { const reason = await promptReason("Modify: send back to loan officer"); if (reason) { modify.mutate({ id: row.id, reason }); } }}>Modify</button>
                </>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
