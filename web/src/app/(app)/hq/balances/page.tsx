"use client";

import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface BalanceRow {
  account: string;
  name: string;
  balance: number;
  /** False for the claim rows (UNMATCHED, SAVINGS, PROFIT, DIVIDENDS): listed, but never added to the total. */
  in_total: boolean;
}

/**
 * Headquarters Account Balance — the same rows Finance gets behind the green card on the dashboard
 * (HQ Account List), from the same API figures, so the page and the card can never disagree.
 */
export default function HqBalancesPage() {
  const { data: rows, isLoading } = useApi<BalanceRow[]>("hq/balances");
  const total = (rows ?? []).filter((row) => row.in_total).reduce((running, row) => running + row.balance, 0);
  const hasClaimRows = (rows ?? []).some((row) => !row.in_total);

  return (
    <>
      <PageHeader crumbs={["Headquarters Account Balance"]} />
      <Card title="Headquarters Account Balance">
        <DataTable
          rows={rows}
          loading={isLoading}
          searchable={false}
          pageSize={100}
          rowKey={(row) => row.account}
          columns={[
            {
              key: "name",
              header: "Account Name",
              sortable: false,
              render: (row) => (row.in_total ? <b>{row.name}</b> : <b className="text-muted">{row.name}</b>),
            },
            {
              key: "balance",
              header: "Amount",
              sortable: false,
              render: (row) => (row.in_total ? <b>{money(row.balance)}</b> : <b className="text-muted">{money(row.balance)}</b>),
            },
          ]}
          footer={
            <>
              <tr>
                <td><b>TOTAL:</b></td>
                <td><b>{money(total)}</b></td>
              </tr>
              {hasClaimRows && (
                <tr>
                  <td colSpan={2}>
                    <small className="text-muted">Unmatched is money received but not yet matched to a loan, and Savings belong to the customers who deposited them, so neither is HQ&apos;s. Profit and Dividends are shares of Operation Income. None of these four is added to the total.</small>
                  </td>
                </tr>
              )}
            </>
          }
        />
      </Card>
    </>
  );
}
