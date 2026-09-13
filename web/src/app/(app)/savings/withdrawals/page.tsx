"use client";

import Link from "next/link";
import { useState } from "react";

import { FilterModal, sum, type Filters } from "@/components/finance-b/FilterModal";
import type { SavingTransaction } from "@/components/finance-b/types";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

type Tab = "all" | "taken" | "clear";

function WithdrawalTable({ rows, loading, withAction }: { rows: SavingTransaction[]; loading: boolean; withAction: boolean }) {
  const active = rows.filter((row) => !row.reversed);

  return (
    <DataTable
      rows={rows}
      loading={loading}
      rowKey={(row) => row.id}
      columns={[
        { key: "branch", header: <b>Branch</b> },
        { key: "customer", header: <b>Customer</b> },
        { key: "description", header: <b>Description</b> },
        { key: "amount", header: <b>Amount</b>, render: (row) => (row.reversed ? <del>{money(row.amount)}</del> : money(row.amount)) },
        { key: "transaction_date", header: <b>Date</b> },
        ...(withAction
          ? [{
              key: "action",
              header: <b>Action</b>,
              sortable: false,
              render: (row: SavingTransaction) => (
                <Link href={`/savings/${row.customer_id}`} className="btn btn-sm btn-info" title="view"><i className="icon-eye" /></Link>
              ),
            }]
          : []),
      ]}
      footer={
        <tr>
          <td><b>TOTAL:</b></td>
          <td />
          <td />
          <td><b>{money(sum(active, (row) => row.amount))}</b></td>
          <td />
          {withAction && <td />}
        </tr>
      }
    />
  );
}

export default function SavingWithdrawalsPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [filters, setFilters] = useState<Filters>({});
  const [filtering, setFiltering] = useState(false);
  const { data, isLoading } = useApi<SavingTransaction[]>("savings/withdrawals", { ...filters });
  const rows = data ?? [];

  const tabs: Array<[Tab, string]> = [["all", "All"], ["taken", "Saving Taken"], ["clear", "Saving clear loan"]];

  return (
    <>
      <PageHeader crumbs={["Saving Deposit", "Saving withdrawal"]} />

      <div className="card">
        <div className="body">
          <ul className="nav nav-tabs-new">
            {tabs.map(([key, label]) => (
              <li className="nav-item" key={key}>
                <button type="button" className={`nav-link ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>{label}</button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {tab === "all" && (
        <Card>
          <h6>All Saving withdrawal</h6>
          <div className="text-right">
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setFiltering(true)}><i className="icon-magnifier" /></button>
          </div>
          <WithdrawalTable rows={rows} loading={isLoading} withAction />
        </Card>
      )}
      {tab === "taken" && (
        <Card>
          <h6>Customer Taken</h6>
          <WithdrawalTable rows={rows.filter((row) => row.withdrawal_type !== "CLEAR")} loading={isLoading} withAction />
        </Card>
      )}
      {tab === "clear" && (
        <Card title="Clear Loan">
          <WithdrawalTable rows={rows.filter((row) => row.withdrawal_type === "CLEAR")} loading={isLoading} withAction={false} />
        </Card>
      )}

      <FilterModal open={filtering} onClose={() => setFiltering(false)} onApply={setFilters} branchPlaceholder="Select Branch" />
    </>
  );
}
