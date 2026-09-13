"use client";

import Link from "next/link";
import { useState } from "react";

import { BalanceModal } from "@/components/finance-b/BalanceModal";
import { FilterModal, HeaderButton, sum, type Filters } from "@/components/finance-b/FilterModal";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface CustomerBalance {
  customer_id: number;
  customer: string | null;
  branch: string | null;
  amount: number;
}

export default function SavingBalancesPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [modal, setModal] = useState<"balance" | "filter" | null>(null);
  const { data: rows, isLoading } = useApi<CustomerBalance[]>("savings/balances", { branch_id: filters.branch_id });

  return (
    <>
      <PageHeader crumbs={["saving deposit", "saving balance"]} />

      <Card
        title="Saving Deposit balance"
        actions={
          <>
            <HeaderButton icon="icon-wallet" onClick={() => setModal("balance")} />
            <HeaderButton onClick={() => setModal("filter")} />
          </>
        }
      >
        <DataTable
          rows={rows}
          loading={isLoading}
          rowKey={(row) => `${row.customer_id}-${row.branch}`}
          columns={[
            { key: "sn", header: "S/no.", render: (_, index) => `${index + 1}.`, value: (row) => row.customer_id },
            { key: "branch", header: "Branch" },
            { key: "customer", header: "customer", render: (row) => <Link href={`/savings/${row.customer_id}`}>{row.customer}</Link> },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
          ]}
          footer={
            <tr>
              <td><b>TOTAL</b></td>
              <td />
              <td />
              <td><b>{money(sum(rows, (row) => row.amount))}</b></td>
            </tr>
          }
        />
      </Card>

      <BalanceModal open={modal === "balance"} onClose={() => setModal(null)} title="Saving Deposit Balance" path="savings/branch-balances" totalLabel="TOTAL:" />
      <FilterModal open={modal === "filter"} onClose={() => setModal(null)} onApply={setFilters} branchPlaceholder="---Select Branch---" dates={false} />
    </>
  );
}
