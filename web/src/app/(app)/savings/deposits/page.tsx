"use client";

import { useState } from "react";

import { FilterModal, HeaderButton, sum, type Filters } from "@/components/finance-b/FilterModal";
import type { SavingTransaction } from "@/components/finance-b/types";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

export default function TodaySavingDepositsPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [filtering, setFiltering] = useState(false);
  const { data: rows, isLoading } = useApi<SavingTransaction[]>("savings/deposits", { ...filters });
  const active = (rows ?? []).filter((row) => !row.reversed);

  return (
    <>
      <PageHeader crumbs={["saving deposit"]} />

      <Card title="Today saving Deposit" actions={<HeaderButton onClick={() => setFiltering(true)} />}>
        <DataTable
          rows={rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/no.", render: (_, index) => `${index + 1}.`, value: (row) => row.id },
            { key: "branch", header: "Branch" },
            { key: "customer", header: "customer" },
            { key: "amount", header: "Amount", render: (row) => (row.reversed ? <del>{money(row.amount)}</del> : money(row.amount)) },
            { key: "transaction_date", header: "Date" },
          ]}
          footer={
            <tr>
              <td><b>TOTAL</b></td>
              <td />
              <td />
              <td><b>{money(sum(active, (row) => row.amount))}</b></td>
              <td />
            </tr>
          }
        />
      </Card>

      <FilterModal open={filtering} onClose={() => setFiltering(false)} onApply={setFilters} branchPlaceholder="---Select Branch---" />
    </>
  );
}
