"use client";

import Link from "next/link";

import { AgreementActions } from "@/components/loans/AgreementActions";
import { LoanStatusBadge } from "@/components/loans/LoanStatusBadge";
import type { Loan } from "@/components/loans/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

/**
 * Loan → Loan Agreements: loans the branch manager has approved that are still before credit approval. The system
 * generates the agreement here; the loan officer prints it, the customer fills and signs it, and the signed PDF is
 * uploaded so the credit officer can approve.
 */
export default function LoanAgreementsPage() {
  const { data, isLoading } = useApi<Loan[]>("loans", { stage: "agreement" });

  return (
    <>
      <PageHeader crumbs={["Loan", "Loan Agreements"]} />
      <Card title="Loan Agreements (approved by branch manager)">
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
            { key: "approved_at", header: "Approved On" },
            { key: "status_label", header: "Loan Status", render: (row) => <LoanStatusBadge loan={row} /> },
            {
              key: "agreement",
              header: "Signed Agreement",
              value: (row) => (row.agreement_file ? "UPLOADED" : "NOT UPLOADED"),
              render: (row) => (row.agreement_file ? <Badge tone="success">UPLOADED</Badge> : <Badge tone="warning">NOT UPLOADED</Badge>),
            },
            { key: "action", header: "Action", sortable: false, className: "text-nowrap", render: (row) => <AgreementActions loan={row} compact /> },
          ]}
        />
      </Card>
    </>
  );
}
