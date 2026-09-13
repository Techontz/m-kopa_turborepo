"use client";

import { useState } from "react";

import { DepositHistoryModal } from "@/components/finance-b/SalaryAdvanceModals";
import type { SalaryAdvance } from "@/components/finance-b/types";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { money, percent } from "@/lib/format";
import { useApi } from "@/lib/hooks";

export default function SalaryAdvanceRepaymentsPage() {
  const [history, setHistory] = useState<SalaryAdvance | null>(null);
  const { data: advances, isLoading } = useApi<SalaryAdvance[]>("salary-advance/repayments");

  return (
    <>
      <PageHeader crumbs={["Salary Advance", "Salary Advance Loan Repayment"]} />

      <Card title="Salary Advance Loan">
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
            { key: "status", header: "Status", render: (row) => row.status.toUpperCase() },
            { key: "created_at", header: "Date" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              render: (row) => (
                <button type="button" className="btn btn-sm btn-icon btn-info" title="Deposit History" onClick={() => setHistory(row)}><i className="icon-list" /></button>
              ),
            },
          ]}
        />
      </Card>

      <DepositHistoryModal advance={history} onClose={() => setHistory(null)} />
    </>
  );
}
