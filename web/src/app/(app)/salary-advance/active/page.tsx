"use client";

import { useState } from "react";

import { FilterModal, HeaderButton, sum, type Filters } from "@/components/finance-b/FilterModal";
import { DepositHistoryModal, DepositModal } from "@/components/finance-b/SalaryAdvanceModals";
import type { SalaryAdvance } from "@/components/finance-b/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction, promptReason } from "@/components/ui/notify";
import { money, percent } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";

export default function ActiveSalaryAdvancePage() {
  const { can } = useAuth();
  const [filters, setFilters] = useState<Filters>({});
  const [filtering, setFiltering] = useState(false);
  const [depositing, setDepositing] = useState<SalaryAdvance | null>(null);
  const [history, setHistory] = useState<SalaryAdvance | null>(null);
  const { data: advances, isLoading } = useApi<SalaryAdvance[]>("salary-advance/active", { ...filters });

  const reverse = useAction<{ id: number; reason: string }>("delete", (body) => `salary-advance/advances/${body.id}?reason=${encodeURIComponent(body.reason)}`);

  return (
    <>
      <PageHeader crumbs={["Salary Advance", "salary Advance Loan"]} />

      <Card title="Salary advance Loan" actions={<HeaderButton onClick={() => setFiltering(true)} />}>
        <DataTable
          rows={advances}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "customer", header: "Customer Name" },
            { key: "branch", header: "Branch Name" },
            { key: "amount", header: "Loan Amount", render: (row) => money(row.amount) },
            { key: "interest_rate", header: "Interest", render: (row) => percent(row.interest_rate) },
            { key: "total_payable", header: "Principal + Interest", render: (row) => money(row.total_payable) },
            { key: "paid_amount", header: "Paid Amount", render: (row) => money(row.paid_amount) },
            { key: "remaining_amount", header: "Remain Amount", render: (row) => money(row.remaining_amount) },
            { key: "status", header: "Status", render: () => "ACTIVE" },
            { key: "fee", header: "charger", render: (row) => money(row.fee) },
            { key: "created_at", header: "Date" },
            { key: "alert", header: "Alert", render: (row) => (row.alert === "old" ? <Badge tone="info">old</Badge> : <Badge tone="success">New</Badge>) },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  <button type="button" className="btn btn-sm btn-icon btn-info mr-1" title="Deposit" onClick={() => setDepositing(row)}><i className="icon-pencil" /></button>
                  <button type="button" className="btn btn-sm btn-icon btn-info mr-1" title="Deposit History" onClick={() => setHistory(row)}><i className="icon-list" /></button>
                  {can("accounting.reverse") && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      title="Delete"
                      onClick={async () => {
                        if (!(await confirmAction())) {
                          return;
                        }
                        const reason = await promptReason("Reason for reversal");
                        if (reason) {
                          reverse.mutate({ id: row.id, reason });
                        }
                      }}
                    >
                      <i className="icon-trash" />
                    </button>
                  )}
                </>
              ),
            },
          ]}
          footer={
            <tr>
              <td><b>TOTAL:</b></td>
              <td />
              <td><b>{money(sum(advances, (row) => row.amount))}</b></td>
              <td />
              <td><b>{money(sum(advances, (row) => row.total_payable))}</b></td>
              <td><b>{money(sum(advances, (row) => row.paid_amount))}</b></td>
              <td><b>{money(sum(advances, (row) => row.remaining_amount))}</b></td>
              <td />
              <td><b>{money(sum(advances, (row) => row.fee))}</b></td>
              <td />
              <td />
              <td />
            </tr>
          }
        />
      </Card>

      <DepositModal advance={depositing} onClose={() => setDepositing(null)} />
      <DepositHistoryModal advance={history} onClose={() => setHistory(null)} />
      <FilterModal open={filtering} onClose={() => setFiltering(false)} onApply={setFilters} dates="optional" />
    </>
  );
}
