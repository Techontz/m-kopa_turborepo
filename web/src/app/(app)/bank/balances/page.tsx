"use client";

import { sum } from "@/components/finance/FilterModal";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface BalanceRow {
  id: number;
  name: string;
  balance: number;
}

export default function BankBalancesPage() {
  const { data: rows, isLoading } = useApi<BalanceRow[]>("bank/balances");

  return (
    <>
      <PageHeader crumbs={["Bank", "Bank Balance"]} />
      <Card title="Account Balance">
        <DataTable
          rows={rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "name", header: "Account Name" },
            { key: "balance", header: "Balance", render: (row) => money(row.balance) },
          ]}
          footer={
            <tr>
              <td><b>TOTAL:</b></td>
              <td />
              <td><b>{money(sum(rows, (row) => row.balance))}</b></td>
            </tr>
          }
        />
      </Card>
    </>
  );
}
