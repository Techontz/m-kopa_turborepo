"use client";

import { sum } from "@/components/finance/FilterModal";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface BalanceRow {
  account: string;
  name: string;
  balance: number;
}

export default function HqBalancesPage() {
  const { data: rows, isLoading } = useApi<BalanceRow[]>("hq/balances");

  return (
    <>
      <PageHeader crumbs={["Headquater Account Balance"]} />
      <Card title="Headquater Account Balance">
        <DataTable
          rows={rows}
          loading={isLoading}
          searchable={false}
          pageSize={100}
          rowKey={(row) => row.account}
          columns={[
            { key: "name", header: "Account Name", sortable: false, render: (row) => <b>{row.name}</b> },
            { key: "balance", header: "Amount", sortable: false, render: (row) => <b>{money(row.balance)}</b> },
          ]}
          footer={
            <tr>
              <td><b>TOTAL:</b></td>
              <td><b>{money(sum(rows, (row) => row.balance))}</b></td>
            </tr>
          }
        />
      </Card>
    </>
  );
}
