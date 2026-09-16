"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { PaymentFilterModal, SearchButton, total, type PaymentFilters } from "@/components/payments/PaymentFilterModal";
import type { Payment } from "@/components/payments/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { promptReason } from "@/components/ui/notify";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { useAction } from "@/lib/hooks";

const STATUSES = [
  { value: "pending_verification", label: "PENDING_VERIFICATION" },
  { value: "deposited", label: "DEPOSITED" },
  { value: "confirmed", label: "CONFIRMED" },
  { value: "rejected", label: "REJECTED" },
  { value: "all", label: "ALL" },
];

/** Payments → Cash Verification: Finance view of teller cash receipts (Documents: cash flow, fraud control). */
export default function CashVerificationPage() {
  const [filters, setFilters] = useState<PaymentFilters>({});
  const [filtering, setFiltering] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["payments/cash", filters],
    queryFn: () => api.get<{ data: Payment[]; totals: Record<string, number> }>("payments/cash", { ...filters }),
  });
  const reject = useAction<{ id: number; reason: string }>("post", (body) => `payments/cash/${body.id}/reject`);
  const rows = data?.data;

  return (
    <>
      <PageHeader crumbs={["Payments", "Cash Verification"]} />

      <div className="row clearfix">
        {STATUSES.slice(0, 4).map((status) => (
          <div className="col-lg-3 col-md-6" key={status.value}>
            <div className="card">
              <div className="body">
                <small>{status.label}</small>
                <h5 className="mb-0">{money(data?.totals?.[status.value] ?? 0)}</h5>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Card title="Teller Cash Receipts" actions={<SearchButton onClick={() => setFiltering(true)} />}>
        <DataTable
          rows={rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "receipt_number", header: "Receipt" },
            { key: "customer", header: "Customer Name" },
            { key: "branch", header: "Branch Name" },
            { key: "employee", header: "Teller" },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "slip_number", header: "Deposit Slip" },
            { key: "paid_on", header: "Date" },
            { key: "status", header: "Status", render: (row) => <Badge tone={row.status_badge}>{row.status_label}</Badge> },
            { key: "rejection_reason", header: "Comment" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              render: (row) =>
                row.status === "pending_verification" && (
                  <button
                    type="button"
                    className="btn btn-sm btn-icon btn-danger"
                    title="Reject"
                    disabled={reject.isPending}
                    onClick={async () => {
                      const reason = await promptReason("Reject cash payment");
                      if (reason) {
                        reject.mutate({ id: row.id, reason });
                      }
                    }}
                  >
                    <i className={reject.isPending && reject.variables?.id === row.id ? "fa fa-spinner fa-spin" : "icon-close"} />
                  </button>
                ),
            },
          ]}
          footer={
            <tr>
              <td><b>TOTAL</b></td>
              <td /><td /><td /><td />
              <td><b>{money(total(rows, (row) => row.amount))}</b></td>
              <td /><td /><td /><td /><td />
            </tr>
          }
        />
      </Card>

      <PaymentFilterModal open={filtering} onClose={() => setFiltering(false)} onApply={setFilters} withZone statuses={STATUSES} />
    </>
  );
}
