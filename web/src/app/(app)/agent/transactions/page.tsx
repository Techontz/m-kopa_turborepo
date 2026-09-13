"use client";

import { useState } from "react";

import { AgentTransactionModal } from "@/components/finance-b/AgentTransactionModal";
import { BalanceModal } from "@/components/finance-b/BalanceModal";
import { FilterModal, HeaderButton, sum, type Filters } from "@/components/finance-b/FilterModal";
import type { AgentTransaction } from "@/components/finance-b/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { promptReason } from "@/components/ui/notify";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

export default function AgentTransactionsPage() {
  const { can } = useAuth();
  const [filters, setFilters] = useState<Filters>({});
  const [modal, setModal] = useState<"record" | "balance" | "filter" | null>(null);
  const { data: transactions, isLoading } = useApi<AgentTransaction[]>("agent/transactions", { ...filters });
  const reverse = useAction<{ id: number; reason: string }>("post", (body) => `agent/transactions/${body.id}/reverse`);
  const active = (transactions ?? []).filter((row) => !row.reversed);

  return (
    <>
      <PageHeader crumbs={["Clientless transaction", "Record transaction"]} />

      <Card
        title="transaction list"
        actions={
          <>
            <HeaderButton icon="icon-plus" tone="info" title="record" onClick={() => setModal("record")} />
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
            { key: "payment_mode", header: "Mode of payment" },
            { key: "agent", header: "Agent" },
            { key: "amount", header: "Amount", render: (row) => (row.reversed ? <del>{money(row.amount)}</del> : money(row.amount)) },
            { key: "transaction_time", header: "Rec Time" },
            { key: "transaction_date", header: "Date" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              render: (row) =>
                row.reversed ? (
                  <Badge tone="danger">REVERSED</Badge>
                ) : can("accounting.reverse") ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-icon btn-danger"
                    title="Reverse"
                    onClick={async () => {
                      const reason = await promptReason("Reason for reversal");
                      if (reason) {
                        reverse.mutate({ id: row.id, reason });
                      }
                    }}
                  >
                    <i className="icon-action-undo" />
                  </button>
                ) : null,
            },
          ]}
          footer={
            <tr>
              <td><b>TOTAL</b></td>
              <td />
              <td />
              <td />
              <td><b>{money(sum(active, (row) => row.amount))}</b></td>
              <td />
              <td />
              <td />
            </tr>
          }
        />
      </Card>

      <AgentTransactionModal open={modal === "record"} onClose={() => setModal(null)} />
      <BalanceModal open={modal === "balance"} onClose={() => setModal(null)} title="Balance" path="agent/balances" />
      <FilterModal open={modal === "filter"} onClose={() => setModal(null)} onApply={setFilters} branchLabel="Branch" submitLabel="filter" />
    </>
  );
}
