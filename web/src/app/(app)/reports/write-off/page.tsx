"use client";

import { useState } from "react";

import { cleanQuery, FilterModal, PaneCard, ReportTabs, SearchButton, TotalsRow, type ReportFilters, type ReportRows } from "@/components/reports/ReportKit";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface WriteOffRow {
  id: number;
  branch: string | null;
  customer: string | null;
  phone: string | null;
  total_payable: number;
  restoration: number;
  duration: string;
  sessions: number;
  amount: number;
  recovered_amount: number;
  start_date: string | null;
  end_date: string | null;
  employee: string | null;
  description: string | null;
}

type Tab = "write-off" | "bad-debit" | "done";

const BASE: Column<WriteOffRow>[] = [
  { key: "sn", header: "S/No.", render: (_, index) => index + 1, sortable: false },
  { key: "branch", header: "Branch Name" },
  { key: "customer", header: "Customer Name" },
  { key: "phone", header: "Phone Number" },
  { key: "total_payable", header: "Loan Amount", render: (row) => money(row.total_payable) },
  { key: "restoration", header: "Restoration", render: (row) => money(row.restoration) },
  { key: "duration", header: "Duration Type" },
  { key: "sessions", header: "Number of Repayment" },
];

/**
 * Report → Wright-off Loan (live admin/write_off_data) with the live "Bad Debit" and "Bad Debit Done" tabs.
 * Bad Debit Done = written-off debt fully recovered.
 */
export default function WriteOffPage() {
  const [tab, setTab] = useState<Tab>("write-off");
  const [filters, setFilters] = useState<ReportFilters>({});
  const [filtering, setFiltering] = useState(false);
  const done = tab === "done";
  const { data, isLoading } = useApi<ReportRows<WriteOffRow>>("reports/write-off", { ...cleanQuery(filters), done: done ? 1 : undefined });

  const columns: Column<WriteOffRow>[] = done
    ? [
        ...BASE,
        { key: "amount", header: "bad debit Amount", render: (row) => money(row.amount) },
        { key: "recovered_amount", header: "paid Amount", render: (row) => money(row.recovered_amount) },
        { key: "start_date", header: "Satart date" },
        { key: "end_date", header: "End date" },
        { key: "employee", header: "employee" },
        { key: "description", header: "Desc" },
        { key: "action", header: "Action", sortable: false, render: () => null },
      ]
    : [
        ...BASE,
        { key: "amount", header: "Wright-off Amount", render: (row) => money(row.amount) },
        { key: "start_date", header: "Satart date" },
        { key: "end_date", header: "End date" },
      ];

  return (
    <>
      <PageHeader crumbs={["Report", done ? "Bad Debit Done" : "Wright-off"]} />
      <ReportTabs tabs={[["write-off", "Write-off loan"], ["bad-debit", "Bad Debit"], ["done", "Bad Debit Done"]]} value={tab} onChange={setTab} />

      <PaneCard title={{ "write-off": "Write-off Loan", "bad-debit": "Bad Debit", done: "Bad Debit Done" }[tab]} actions={!done && <SearchButton onClick={() => setFiltering(true)} />}>
        <DataTable
          key={tab}
          rows={data?.rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={columns}
          footer={
            data && (
              <TotalsRow
                label={<b>TOTAL:</b>}
                cells={done
                  ? [...Array(7).fill(""), <b key="a">{money(data.totals.amount)}</b>, <b key="r">{money(data.totals.recovered_amount)}</b>, "", "", "", "", ""]
                  : [...Array(7).fill(""), <b key="a">{money(data.totals.amount)}</b>, "", ""]}
              />
            )
          }
        />
      </PaneCard>

      <FilterModal open={filtering} onClose={() => setFiltering(false)} title="Filter" withDates={false} onApply={setFilters} />
    </>
  );
}
