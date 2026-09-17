"use client";

import Link from "next/link";

import { Stat } from "@/components/hrm/common";
import { MyPortalHeader, PortalStatus, type MyPayslip } from "@/components/hrm/MyPortal";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

/** Spec §60 Salary: payslips per payroll period with salary deductions, net salary and payment status. */
export default function MySalaryPage() {
  const { data, isLoading } = useApi<{ summary: { total_net_paid: number; awaiting_payment_count: number }; payslips: MyPayslip[] }>("hrm/my/payslips");

  return (
    <>
      <MyPortalHeader title="Salary & Payslips" />
      <div className="row clearfix">
        <Stat label="Net salary paid" value={money(data?.summary.total_net_paid)} />
        <Stat label="Payrolls awaiting payment" value={data?.summary.awaiting_payment_count ?? 0} />
      </div>
      <Card title="My Payslips">
        <DataTable
          rows={data?.payslips}
          loading={isLoading}
          rowKey={(row, index) => `${row.payroll_period}-${row.payslip_id ?? "pending"}-${index}`}
          columns={[
            { key: "payroll_period", header: "Payroll period", render: (row) => row.period_label },
            { key: "basic_salary", header: "Basic salary", render: (row) => money(row.basic_salary) },
            { key: "allowance", header: "Allowances", render: (row) => money(row.allowance) },
            { key: "staff_fund", header: "Staff fund", render: (row) => money(row.staff_fund) },
            { key: "loan_restoration", header: "Staff loan", render: (row) => money(row.loan_restoration) },
            { key: "salary_advance", header: "Salary advance", render: (row) => money(row.salary_advance) },
            { key: "other_deductions", header: "Other deductions", render: (row) => money(row.other_deductions + row.negligence) },
            { key: "total_deductions", header: "Total deductions", render: (row) => money(row.total_deductions) },
            { key: "net_salary", header: "Net salary", render: (row) => <b>{money(row.net_salary)}</b> },
            { key: "payment_status", header: "Status", value: (row) => row.payment_status_label, render: (row) => <PortalStatus status={row.payment_status} label={row.payment_status_label} /> },
            { key: "paid_on", header: "Paid on", render: (row) => row.paid_on ?? "-" },
            {
              key: "payslip",
              header: "Payslip",
              sortable: false,
              render: (row) => row.payslip_id ? <Link href={`/hrm/salary-sheet/payslip/${row.payslip_id}`} className="btn btn-sm btn-info"><i className="icon-eye" /></Link> : "-",
            },
          ]}
        />
      </Card>
    </>
  );
}
