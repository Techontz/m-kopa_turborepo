"use client";

import { useState } from "react";

import { FilterModal, HeaderButton, sum, type Filters } from "@/components/finance-b/FilterModal";
import type { SalaryAdvance } from "@/components/finance-b/types";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { money, percent } from "@/lib/format";
import { useApi } from "@/lib/hooks";

function todayLabel(): string {
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "short" });
  return `${String(now.getDate()).padStart(2, "0")},${month},${now.getFullYear()}`;
}

export default function SalaryAdvanceApprovedPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [filtering, setFiltering] = useState(false);
  const { data: advances, isLoading } = useApi<SalaryAdvance[]>("salary-advance/approved", { branch_id: filters.branch_id });

  return (
    <>
      <PageHeader crumbs={["Salary Advance", "salary Advance Loan Approved"]} />

      <Card title={`Salary Advance Approved Today / ${todayLabel()}`} actions={<HeaderButton onClick={() => setFiltering(true)} />}>
        <DataTable
          rows={advances}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "customer", header: "Customer Name" },
            { key: "phone", header: "Phone Number" },
            { key: "branch", header: "Branch Name" },
            { key: "amount", header: "Loan Amount", render: (row) => money(row.amount) },
            { key: "interest_rate", header: "Interest", render: (row) => percent(row.interest_rate) },
            { key: "total_payable", header: "Principal + Interest", render: (row) => money(row.total_payable) },
            { key: "paid_amount", header: "Paid Amount", render: (row) => money(row.paid_amount) },
            { key: "remaining_amount", header: "Remain Amount", render: (row) => money(row.remaining_amount) },
            { key: "status", header: "Status", render: (row) => row.status.toUpperCase() },
            { key: "fee", header: "chargers", render: (row) => money(row.fee) },
            { key: "approved_at", header: "Date" },
            { key: "action", header: "Action", sortable: false, render: () => null },
          ]}
          footer={
            <tr>
              <td><b>TOTAL:</b></td>
              <td />
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
            </tr>
          }
        />
      </Card>

      <FilterModal open={filtering} onClose={() => setFiltering(false)} onApply={setFilters} title="Filter debit pending" submitLabel="Save" dates={false} />
    </>
  );
}
