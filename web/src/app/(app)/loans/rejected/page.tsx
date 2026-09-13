"use client";

import Link from "next/link";

import { CustomerStatusBadge, LoanStatusBadge } from "@/components/loans/LoanStatusBadge";
import type { Loan } from "@/components/loans/types";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

/** Loan → Loan Rejected (live all_loan_lejected), plus loans cancelled after an escalated disbursement. */
export default function LoanRejectedPage() {
  const { data, isLoading } = useApi<Loan[]>("loans", { stage: "rejected" });

  return (
    <>
      <PageHeader crumbs={["Loan", "Loan Rejected"]} />
      <Card title="Loan Rejected">
        <DataTable
          rows={data}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "branch_head", header: "Branch", value: (row) => row.branch, render: (row) => row.branch },
            { key: "loan_number", header: "Loan AC/No", render: (row) => <Link href={`/loans/${row.id}`}>{row.loan_number}</Link> },
            { key: "customer_name", header: "customer name" },
            { key: "customer_phone", header: "Phone Number" },
            { key: "branch", header: "Branch" },
            { key: "amount_applied", header: "Loan Amount", render: (row) => money(row.amount_applied) },
            { key: "duration_label", header: "Loan Duration" },
            { key: "sessions", header: "Number of repayments" },
            { key: "status_label", header: "Loan Status", render: (row) => <LoanStatusBadge loan={row} /> },
            { key: "customer_status", header: "Customer Status", render: (row) => <CustomerStatusBadge status={row.customer_status} label={row.customer_status_label} /> },
            { key: "decision_reason", header: "Reason" },
          ]}
        />
      </Card>
    </>
  );
}
