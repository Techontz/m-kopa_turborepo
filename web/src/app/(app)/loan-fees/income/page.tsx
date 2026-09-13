"use client";

import { useState } from "react";

import { FilterModal, HeaderButton, sum, type Filters } from "@/components/finance/FilterModal";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface IncomeRow {
  id: number;
  loan_id: number | null;
  customer: string | null;
  branch: string | null;
  loan_approved: number;
  amount: number;
  date: string;
}

export default function LoanFeeIncomePage() {
  const [filters, setFilters] = useState<Filters>({});
  const [filtering, setFiltering] = useState(false);
  const { data: rows, isLoading } = useApi<IncomeRow[]>("loan-fees/income", { ...filters });

  return (
    <>
      <PageHeader crumbs={["Loan Fee"]} />
      <Card title="Loan Fee" actions={<HeaderButton onClick={() => setFiltering(true)} />}>
        <DataTable
          rows={rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/NO.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "customer", header: "Customer Name" },
            { key: "branch", header: "Branch Name" },
            { key: "loan_approved", header: "Loan Approved", render: (row) => money(row.loan_approved) },
            { key: "amount", header: "Income Amount", render: (row) => money(row.amount) },
            { key: "date", header: "Date" },
          ]}
          footer={
            <tr>
              <td><b>TOTAL</b></td>
              <td />
              <td />
              <td />
              <td><b>{money(sum(rows, (row) => row.amount))}</b></td>
              <td />
            </tr>
          }
        />
      </Card>
      <FilterModal open={filtering} onClose={() => setFiltering(false)} onApply={setFilters} withBranch branchPlaceholder="---Select Branch---" />
    </>
  );
}
