"use client";

import { Stat } from "@/components/hrm/common";
import { MyPortalHeader, PortalStatus, type MyCommission } from "@/components/hrm/MyPortal";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { money, percent } from "@/lib/format";
import { useApi } from "@/lib/hooks";

/**
 * Spec §21 / §22 / §23 Commission: monthly commission per closed period, zone deduction where applicable, negligence recovered
 * (or expected) from it, net commission and the payment status and dates. The payment date never changes the period.
 */
export default function MyCommissionPage() {
  const { data, isLoading } = useApi<{ summary: { total_net_paid: number; total_net_unpaid: number }; commissions: MyCommission[] }>("hrm/my/commission");

  return (
    <>
      <MyPortalHeader title="Commission" />
      <div className="row clearfix">
        <Stat label="Net commission paid" value={money(data?.summary.total_net_paid)} />
        <Stat label="Net commission not yet paid" value={money(data?.summary.total_net_unpaid)} />
      </div>
      <Card title="My Commission">
        <DataTable
          rows={data?.commissions}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "period", header: "Commission period", render: (row) => row.period_label },
            { key: "closing_date", header: "Closed on" },
            { key: "kind_label", header: "Type", render: (row) => `${row.kind_label}${row.branch ? ` · ${row.branch}` : ""}` },
            { key: "share_percent", header: "Share", render: (row) => percent(row.share_percent) },
            { key: "zone_deduction", header: "Zone deduction", render: (row) => (row.zone_deduction === null ? "-" : money(row.zone_deduction)) },
            { key: "calculated_amount", header: "Commission", render: (row) => money(row.calculated_amount) },
            { key: "negligence_deduction", header: "Negligence deduction", render: (row) => <>{money(row.negligence_deduction)}{row.negligence_expected && row.negligence_deduction > 0 && <small className="d-block text-muted">expected</small>}</> },
            { key: "net_commission", header: "Net commission", render: (row) => <b>{money(row.net_commission)}</b> },
            { key: "status", header: "Status", value: (row) => row.status_label, render: (row) => <PortalStatus status={row.status} label={row.status_label} /> },
            {
              key: "dates",
              header: "Dates",
              sortable: false,
              render: (row) => (
                <small className="d-block text-muted">
                  {row.requested_at && <span className="d-block">Payment requested ({row.requested_at})</span>}
                  {row.approved_at && <span className="d-block">Finance approved ({row.approved_at})</span>}
                  {row.paid_on && <span className="d-block">Paid on {row.paid_on}</span>}
                  {row.rejection_reason && <span className="d-block">Returned: {row.rejection_reason}</span>}
                </small>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
