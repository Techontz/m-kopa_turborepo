"use client";

import Link from "next/link";

import { MyPortalHeader, PortalStatus, type MyRepayments } from "@/components/hrm/MyPortal";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

/**
 * Spec §29 / §30 Staff Loans and Salary Advances: approved amount, outstanding balance, repayment schedule and payroll
 * deductions. Requests (apply and follow the approval stages) stay on My Loan & Advance Requests.
 */
export default function MyLoansPage() {
  const { data, isLoading } = useApi<MyRepayments>("hrm/my/repayments");

  return (
    <>
      <MyPortalHeader title="Loans & Advances" />
      <Card
        title="My Staff Loans"
        actions={<Link href="/hrm/my-requests" className="btn btn-sm btn-primary"><i className="icon-plus" /> Requests</Link>}
      >
        <DataTable
          rows={data?.staff_loans}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "category", header: "Category" },
            { key: "amount_approved", header: "Approved", render: (row) => money(row.amount_approved || row.amount_applied) },
            { key: "total_payable", header: "Loan + interest", render: (row) => money(row.total_payable) },
            { key: "instalment", header: "Per payroll", render: (row) => `${money(row.instalment)} × ${row.sessions}` },
            { key: "paid_amount", header: "Deducted", render: (row) => money(row.paid_amount) },
            { key: "outstanding", header: "Outstanding", render: (row) => <b>{money(row.outstanding)}</b> },
            { key: "status", header: "Status", value: (row) => row.status_label, render: (row) => <PortalStatus status={row.status} label={row.status_label} /> },
            {
              key: "schedule",
              header: "Repayment schedule",
              sortable: false,
              render: (row) => row.schedule.length === 0 ? "-" : (
                <small className="d-block">
                  {row.schedule.map((item) => (
                    <span key={item.number} className="d-block">#{item.number}: {money(item.amount)} <PortalStatus status={item.status} /> <span className="text-muted">bal {money(item.balance)}</span></span>
                  ))}
                </small>
              ),
            },
            {
              key: "deductions",
              header: "Deductions",
              sortable: false,
              render: (row) => row.deductions.length === 0 ? "-" : (
                <small className="d-block text-muted">
                  {row.deductions.map((deduction, index) => <span key={index} className="d-block">{deduction.paid_on}: {money(deduction.amount)}</span>)}
                </small>
              ),
            },
          ]}
        />
      </Card>

      <Card title="My Salary Advances">
        <DataTable
          rows={data?.salary_advances}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "category", header: "Category" },
            { key: "amount", header: "Approved", render: (row) => money(row.amount) },
            { key: "disbursed_at", header: "Disbursed", render: (row) => row.disbursed_at ?? "-" },
            { key: "recovered_amount", header: "Deducted", render: (row) => money(row.recovered_amount) },
            { key: "outstanding", header: "Outstanding", render: (row) => <b>{money(row.outstanding)}</b> },
            { key: "status", header: "Status", value: (row) => row.status_label, render: (row) => <PortalStatus status={row.status} label={row.status_label} /> },
          ]}
        />
        <p className="text-muted mt-2 mb-0"><small>An outstanding salary advance is deducted in full from the next payroll.</small></p>
      </Card>

      <Card title="Salary Advance Deductions from Payroll">
        <DataTable
          rows={data?.salary_advance_deductions}
          loading={isLoading}
          rowKey={(row) => row.payslip_id}
          columns={[
            { key: "period_label", header: "Payroll period" },
            { key: "amount", header: "Deducted", render: (row) => money(row.amount) },
            { key: "paid_on", header: "Paid on" },
          ]}
        />
      </Card>
    </>
  );
}
