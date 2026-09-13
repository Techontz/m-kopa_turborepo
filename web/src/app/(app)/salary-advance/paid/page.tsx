"use client";

import { useState } from "react";

import { FilterModal, HeaderButton, sum, type Filters } from "@/components/finance-b/FilterModal";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface Payment {
  id: number;
  branch: string | null;
  customer: string | null;
  amount: number;
  paid_on: string;
}

export default function SalaryAdvancePaidPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [filtering, setFiltering] = useState(false);
  const { data: payments, isLoading } = useApi<Payment[]>("salary-advance/paid", { ...filters });

  return (
    <>
      <PageHeader crumbs={["Salary Advance paid list"]} />

      <Card title="Salary Advance Paid List" actions={<HeaderButton onClick={() => setFiltering(true)} />}>
        <DataTable
          rows={payments}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/no.", render: (_, index) => `${index + 1}.`, value: (row) => row.id },
            { key: "branch", header: "Branch" },
            { key: "customer", header: "Customer Name" },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "paid_on", header: "Date" },
          ]}
          footer={
            <tr>
              <td><b>TOTAL:</b></td>
              <td />
              <td />
              <td><b>{money(sum(payments, (row) => row.amount))}</b></td>
              <td />
            </tr>
          }
        />
      </Card>

      <FilterModal open={filtering} onClose={() => setFiltering(false)} onApply={setFilters} branchPlaceholder="select branch" />
    </>
  );
}
