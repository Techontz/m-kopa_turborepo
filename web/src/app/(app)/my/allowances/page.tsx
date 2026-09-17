"use client";

import { Stat } from "@/components/hrm/common";
import { MyPortalHeader, PortalStatus, type MyAllowances, type MyNegligence } from "@/components/hrm/MyPortal";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

/**
 * Spec §24 allowances (reason, amount, payroll period, status — "Approved / Awaiting Payroll"), other salary deductions and
 * §23 Finance-approved negligence / loss deductions recovered from commission.
 */
export default function MyAllowancesPage() {
  const { data, isLoading } = useApi<MyAllowances>("hrm/my/allowances");
  const { data: negligence, isLoading: loadingNegligence } = useApi<MyNegligence>("hrm/my/negligence");

  return (
    <>
      <MyPortalHeader title="Allowances & Deductions" />
      <div className="row clearfix">
        <Stat label="Approved / Awaiting Payroll" value={money(data?.summary.awaiting_payroll_amount)} />
        <Stat label="Pending Finance approval" value={data?.summary.pending_approval_count ?? 0} />
        <Stat label="Allowances paid" value={money(data?.summary.paid_amount)} />
        <Stat label="Negligence outstanding" value={money(negligence?.summary.outstanding)} />
      </div>

      <Card title="My Allowances">
        <DataTable
          rows={data?.allowances}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "reason_label", header: "Allowance", render: (row) => <>{row.reason_label}{row.description && <small className="d-block text-muted">{row.description}</small>}</> },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "payroll_period", header: "Payroll period", render: (row) => (row.recurring ? "Every payroll" : `${row.payroll_period_label ?? "-"} Payroll`) },
            { key: "status", header: "Status", value: (row) => row.status_label, render: (row) => <><PortalStatus status={row.status} label={row.status_label} />{row.rejection_reason && <small className="d-block text-muted">{row.rejection_reason}</small>}</> },
            { key: "paid_in_payroll", header: "Paid in", render: (row) => row.paid_in_payroll ?? "-" },
          ]}
        />
      </Card>

      <Card title="My Other Salary Deductions">
        <DataTable
          rows={data?.deductions}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "created_at", header: "Date" },
            { key: "description", header: "Description" },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "instalment_amount", header: "Per payroll", render: (row) => `${money(row.instalment_amount)} × ${row.instalments}` },
            { key: "paid_amount", header: "Deducted", render: (row) => money(row.paid_amount) },
            { key: "outstanding_amount", header: "Remaining", render: (row) => money(row.outstanding_amount) },
            { key: "status", header: "Status", render: (row) => <PortalStatus status={row.status} /> },
          ]}
        />
      </Card>

      <Card title="My Negligence / Loss Deductions (recovered from commission)">
        <DataTable
          rows={negligence?.deductions}
          loading={loadingNegligence}
          rowKey={(row) => row.id}
          columns={[
            { key: "created_at", header: "Date" },
            { key: "reason", header: "Reason" },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "recovered_amount", header: "Recovered", render: (row) => money(row.recovered_amount) },
            { key: "outstanding_amount", header: "Outstanding", render: (row) => money(row.outstanding_amount) },
            { key: "status", header: "Status", value: (row) => row.status_label, render: (row) => <PortalStatus status={row.status} label={row.status_label} /> },
            {
              key: "recoveries",
              header: "Recoveries",
              sortable: false,
              render: (row) => (
                <small className="d-block text-muted">
                  {row.recoveries.length === 0 ? "-" : row.recoveries.map((recovery, index) => (
                    <span key={index} className="d-block">{recovery.period_label}: {money(recovery.amount)} (left {money(recovery.outstanding_after)})</span>
                  ))}
                </small>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
