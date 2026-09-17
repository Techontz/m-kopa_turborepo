"use client";

import { Stat } from "@/components/hrm/common";
import { MyPortalHeader, PortalStatus, type MyStaffFund } from "@/components/hrm/MyPortal";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { money, percent } from "@/lib/format";
import { useApi } from "@/lib/hooks";

/**
 * Spec §26 / §27 Staff Fund: the employee's own contributions (the share withheld from basic salary — the only contribution),
 * benefit record and benefit claim history. The Fund Account balance is Finance's and is never shown here.
 */
export default function MyStaffFundPage() {
  const { data, isLoading } = useApi<MyStaffFund>("hrm/my/staff-fund");

  return (
    <>
      <MyPortalHeader title="Staff Fund" />
      <div className="row clearfix">
        <Stat label="Total contributions" value={money(data?.summary.total_contributions)} />
        <Stat label="Benefits paid" value={money(data?.summary.benefits_paid)} />
        <Stat label="Total benefit record" value={money(data?.summary.total_benefit_record)} />
        <Stat label="Open claims" value={money(data?.summary.open_claims)} />
      </div>

      <Card title={`My Contributions (${percent(data?.summary.contribution_percent)} of basic salary)`}>
        <DataTable
          rows={data?.contributions}
          loading={isLoading}
          rowKey={(row) => row.payslip_id}
          columns={[
            { key: "payroll_period", header: "Payroll period", render: (row) => row.period_label },
            { key: "basic_salary", header: "Basic salary", render: (row) => money(row.basic_salary) },
            { key: "staff_contribution", header: "Staff contribution", render: (row) => money(row.staff_contribution) },
            { key: "paid_on", header: "Deducted on" },
          ]}
        />
      </Card>

      <Card title="My Benefit Claims">
        <DataTable
          rows={data?.claims}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "created_at", header: "Date" },
            { key: "reason", header: "Reason" },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "status", header: "Status", value: (row) => row.status_label, render: (row) => <PortalStatus status={row.status} label={row.status_label} /> },
            {
              key: "trail",
              header: "Stages",
              sortable: false,
              render: (row) => (
                <small className="d-block text-muted">
                  {([["Prepared", row.prepared_at], ["Finance review", row.reviewed_at], ["Approved", row.approved_at], ["Rejected", row.rejected_at], ["Paid", row.paid_at]] as const)
                    .filter(([, at]) => at)
                    .map(([label, at]) => <span key={label} className="d-block">{label} ({at})</span>)}
                  {row.rejection_reason && <span className="d-block">Reason: {row.rejection_reason}</span>}
                </small>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
