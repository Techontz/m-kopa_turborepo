"use client";

import Link from "next/link";
import { useState } from "react";

import { AgreementActions } from "@/components/loans/AgreementActions";
import type { Loan, LoanDetail } from "@/components/loans/types";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { money, percent } from "@/lib/format";
import { useApi } from "@/lib/hooks";

/** Loan → Active Loans (live disburse_loan "Loan Disbursed"): running loans with agreement upload, repayment schedule and agreement. */
export default function LoanDisbursedPage() {
  const { data, isLoading } = useApi<Loan[]>("loans", { stage: "disbursed" });
  const [scheduleOf, setScheduleOf] = useState<Loan | null>(null);
  const { data: detail } = useApi<LoanDetail>(scheduleOf ? `loans/${scheduleOf.id}` : null);

  const rows = data ?? [];
  const total = (key: "amount_approved" | "total_payable") => rows.reduce((sum, row) => sum + Number(row[key]), 0);

  return (
    <>
      <PageHeader crumbs={["Loan", "Active Loans"]} />
      <Card title="Active Loans">
        <DataTable
          rows={data}
          loading={isLoading}
          rowKey={(row) => row.id}
          footer={
            <tr>
              <th colSpan={4}>TOTAL:</th>
              <th>{money(total("amount_approved"))}</th>
              <th />
              <th>{money(total("total_payable"))}</th>
              <th colSpan={8} />
            </tr>
          }
          columns={[
            { key: "sn", header: "S/no.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "customer_name", header: "Customer Name" },
            { key: "branch", header: "Branch Name" },
            { key: "loan_number", header: "Loan Ac", render: (row) => <Link href={`/loans/${row.id}`}>{row.loan_number}</Link> },
            { key: "amount_approved", header: "Amount Disbursed", render: (row) => money(row.amount_approved) },
            { key: "interest_rate", header: "Loan Interest", render: (row) => percent(row.interest_rate) },
            { key: "total_payable", header: "Principal + Interest", render: (row) => money(row.total_payable) },
            { key: "duration_label", header: "Restoration Type" },
            { key: "sessions", header: "Number of Repayment" },
            { key: "restoration", header: "Restoration", render: (row) => money(row.restoration) },
            { key: "source", header: "Disbursement Source", value: (row) => row.latest_disbursement?.source_label ?? "", render: (row) => row.latest_disbursement?.source_label ?? "—" },
            { key: "journal_reference", header: "Transaction Ref", value: (row) => row.latest_disbursement?.journal_reference ?? "", render: (row) => row.latest_disbursement?.journal_reference ?? "—" },
            { key: "withdrawn_at", header: "Date" },
            { key: "status_label", header: "Status", render: (row) => <span className={`badge badge-${row.status_badge}`}>{row.status_label}{row.days_past_due > 0 ? ` (${row.days_past_due} DPD)` : ""}</span> },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  <button type="button" className="btn btn-sm btn-icon btn-info mr-1" title="Repayment schedule" onClick={() => setScheduleOf(row)}><i className="icon-calendar" /></button>
                  <AgreementActions loan={row} compact />
                </>
              ),
            },
          ]}
        />
      </Card>

      <Modal open={scheduleOf !== null} onClose={() => setScheduleOf(null)} title={`Repayment schedule — ${scheduleOf?.customer_name ?? ""}`} size="lg">
        <DataTable
          rows={detail?.loan.id === scheduleOf?.id ? detail?.schedules : undefined}
          loading={detail?.loan.id !== scheduleOf?.id}
          searchable={false}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/no.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "due_date", header: "Date" },
            { key: "amount", header: "Restoration", render: (row) => money(row.amount) },
            { key: "paid_amount", header: "Received", render: (row) => money(row.paid_amount) },
            { key: "pending", header: "Pending", render: (row) => money(row.pending) },
          ]}
        />
      </Modal>
    </>
  );
}
