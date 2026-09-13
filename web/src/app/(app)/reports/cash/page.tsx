"use client";

import { useState } from "react";

import { cleanQuery, FilterModal, SearchButton, TotalsRow, type ReportFilters, type ReportRows } from "@/components/reports/ReportKit";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface CashRow {
  id: number;
  customer: string | null;
  deposit: number | null;
  withdrawal: number | null;
  date: string;
}

/** Report → Cash Transaction (live admin/cash_transaction): loan deposits and withdrawals, today by default. */
export default function CashTransactionPage() {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [filtering, setFiltering] = useState(false);
  const { data, isLoading } = useApi<ReportRows<CashRow>>("reports/cash", cleanQuery(filters));

  return (
    <>
      <PageHeader crumbs={["Report", "Cash Transaction"]} />

      <Card title="Transaction list" actions={<SearchButton onClick={() => setFiltering(true)} />}>
        <DataTable
          rows={data?.rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "customer", header: "Customer Name" },
            { key: "deposit", header: "Deposit", render: (row) => (row.deposit === null ? "-" : money(row.deposit)) },
            { key: "withdrawal", header: "Withdrawal", render: (row) => (row.withdrawal === null ? "-" : money(row.withdrawal)) },
            { key: "date", header: "Date" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              // Live links this button to a hard delete of the transaction; the ledger is reversal-only, so it stays disabled.
              render: () => <button type="button" className="btn btn-info btn-sm" disabled title="Not available"><i className="icon-pencil" /></button>,
            },
          ]}
          footer={data && <TotalsRow cells={["", money(data.totals.deposit), money(data.totals.withdrawal), "", ""]} />}
        />
      </Card>

      <FilterModal open={filtering} onClose={() => setFiltering(false)} title="Filter Transaction" onApply={setFilters} />
    </>
  );
}
