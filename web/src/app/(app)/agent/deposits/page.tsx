"use client";

import { useState } from "react";

import { BalanceModal } from "@/components/finance-b/BalanceModal";
import { FilterModal, HeaderButton, sum, type Filters } from "@/components/finance-b/FilterModal";
import type { AgentTransaction } from "@/components/finance-b/types";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

export default function AgentDepositsPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [modal, setModal] = useState<"balance" | "filter" | null>(null);
  const { data: transactions, isLoading } = useApi<AgentTransaction[]>("agent/deposits", { ...filters });
  const active = (transactions ?? []).filter((row) => !row.reversed);

  return (
    <>
      <PageHeader crumbs={["Clientless transaction", "Deposit"]} />

      <Card
        title="transaction list"
        actions={
          <>
            <HeaderButton icon="icon-wallet" tone="success" title="balance" onClick={() => setModal("balance")} />
            <HeaderButton title="Filter" onClick={() => setModal("filter")} />
          </>
        }
      >
        <DataTable
          rows={transactions}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/no.", render: (_, index) => `${index + 1}.`, value: (row) => row.id },
            { key: "branch", header: "Branch" },
            { key: "customer", header: "customer" },
            { key: "amount", header: "Deposit Amount", render: (row) => (row.reversed ? <del>{money(row.amount)}</del> : money(row.amount)) },
            { key: "loan_amount", header: "Loan Amount", render: (row) => money(row.loan_amount) },
            { key: "user", header: "User" },
            { key: "transaction_date", header: "Date" },
          ]}
          footer={
            <tr>
              <td><b>TOTAL</b></td>
              <td />
              <td />
              <td><b>{money(sum(active, (row) => row.amount))}</b></td>
              <td><b>{money(sum(active, (row) => row.loan_amount))}</b></td>
              <td />
              <td />
            </tr>
          }
        />
      </Card>

      <BalanceModal open={modal === "balance"} onClose={() => setModal(null)} title="Balance" path="agent/balances" />
      <FilterModal open={modal === "filter"} onClose={() => setModal(null)} onApply={setFilters} branchLabel="Branch" submitLabel="filter" />
    </>
  );
}
