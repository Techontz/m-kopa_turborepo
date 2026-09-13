"use client";

import Link from "next/link";
import { useState } from "react";

import { CustomerStatusBadge, LoanStatusBadge } from "@/components/loans/LoanStatusBadge";
import type { Loan } from "@/components/loans/types";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction, promptReason } from "@/components/ui/notify";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction } from "@/lib/hooks";

/** Loan → Loan Pending (live loan_pending / loan_pending_recomended). Includes returned and e-mandate loans. */
export default function LoanPendingPage() {
  const { can } = useAuth();
  const [special, setSpecial] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["loans", "pending", special],
    queryFn: () => api.get<{ data: Loan[]; special_count: number }>("loans", { stage: "pending", special: special ? 1 : 0 }),
  });
  const reject = useAction<{ id: number; reason: string }>("post", (body) => `loans/${body.id}/reject`);
  const remove = useAction<{ id: number }>("delete", (body) => `loans/${body.id}`);

  return (
    <>
      <PageHeader crumbs={["Loan", "Loan Pending"]} />
      <Card
        title={special ? "Special Loan Pending List" : "Loan Pending List"}
        actions={
          <button type="button" className="btn btn-info" onClick={() => setSpecial(!special)}>
            {special ? "Loan Pending" : <>Special Loan <span className="badge badge-danger">{data?.special_count ?? 0}</span></>} <i className="icon-arrow-right" />
          </button>
        }
      >
        <DataTable
          rows={data?.data}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "loan_number", header: "Loan AC/No" },
            { key: "customer_name", header: "customer name", render: (row) => <Link href={`/loans/${row.id}`}>{row.customer_name}</Link> },
            { key: "customer_phone", header: "Phone Number" },
            { key: "branch", header: "Branch" },
            { key: "amount_applied", header: "Loan Amount", render: (row) => money(row.amount_applied) },
            { key: "duration_label", header: "Loan Duration" },
            { key: "sessions", header: "Number of repayments" },
            ...(special ? [{ key: "instalment", header: "Instalment", render: (row: Loan) => money(row.instalment) }] : []),
            { key: "status_label", header: "Loan Status", render: (row) => <LoanStatusBadge loan={row} /> },
            { key: "customer_status", header: "Customer Status", render: (row) => <CustomerStatusBadge status={row.customer_status} label={row.customer_status_label} /> },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  <Link href={`/loans/${row.id}`} className="btn btn-sm btn-icon btn-primary mr-1" title="View"><i className="icon-eye" /></Link>
                  {can("loans.apply") && ["pending_manager_approval", "returned"].includes(row.status) && (
                    <Link href={`/loans/${row.id}?edit=1`} className="btn btn-sm btn-icon btn-info mr-1" title="Edit"><i className="icon-pencil" /></Link>
                  )}
                  {can("loans.approve_manager") && row.status !== "returned" && (
                    <button type="button" className="btn btn-sm btn-icon btn-warning mr-1" title="Reject" onClick={async () => { const reason = await promptReason("Reject loan"); if (reason) { reject.mutate({ id: row.id, reason }); } }}><i className="icon-close" /></button>
                  )}
                  {can(["loans.apply", "loans.approve_manager"]) && ["pending_manager_approval", "returned"].includes(row.status) && (
                    <button type="button" className="btn btn-sm btn-icon btn-danger" title="Delete" onClick={async () => (await confirmAction()) && remove.mutate({ id: row.id })}><i className="icon-trash" /></button>
                  )}
                </>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
