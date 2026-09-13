"use client";

import { useState } from "react";

import { cleanQuery, FilterModal, PaneCard, ReportTabs, SearchButton, sumBy, TotalsRow, type ReportFilters, type ReportRows } from "@/components/reports/ReportKit";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface ReceivedRow {
  id: number;
  customer: string | null;
  branch: string | null;
  phone: string | null;
  duration: string | null;
  total_payable: number;
  amount: number;
  principal: number;
  penalty: number;
  interest: number;
  reserve: number;
  employee: string | null;
  date: string;
}

type Tab = "Basic" | "aditinal" | "Account" | "General";

/** Pane headings as on live, including "Daily Receivable" on the daily received pane. */
const PANES: Record<Tab, [string, string | null, string]> = {
  Basic: ["All Received", null, "Reserve"],
  aditinal: ["Monthly Received", "Monthly", "reserve"],
  Account: ["Weekly Received", "Weekly", "reserve"],
  General: ["Daily Receivable", "Daily", "reserve"],
};

/** Report → Today Received (live admin/today_receved_loan): repayments with their Principal / Interest split and reserve. */
export default function ReceivedPage() {
  const [tab, setTab] = useState<Tab>("Basic");
  const [filters, setFilters] = useState<ReportFilters>({});
  const [filtering, setFiltering] = useState(false);
  const { data, isLoading } = useApi<ReportRows<ReceivedRow>>("reports/received", cleanQuery(filters));

  const [title, duration, reserveLabel] = PANES[tab];
  const rows = duration ? data?.rows.filter((row) => row.duration === duration) : data?.rows;

  return (
    <>
      <PageHeader crumbs={["Report", "Received"]} />
      <ReportTabs tabs={[["Basic", "All"], ["aditinal", "Monthly"], ["Account", "Weekly"], ["General", "Daily"]]} value={tab} onChange={setTab} />

      <PaneCard title={title} actions={tab === "Basic" && <SearchButton onClick={() => setFiltering(true)} />}>
        <DataTable
          key={tab}
          rows={rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/no", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "customer", header: "Customer" },
            { key: "branch", header: "Branch" },
            { key: "phone", header: "Number" },
            { key: "duration", header: "Duration" },
            { key: "total_payable", header: "Loan", render: (row) => money(row.total_payable) },
            { key: "amount", header: "Received Amount", render: (row) => money(row.amount) },
            { key: "principal", header: "Principal", render: (row) => money(row.principal) },
            { key: "interest", header: "Intrest", render: (row) => money(row.interest) },
            { key: "reserve", header: reserveLabel, render: (row) => money(row.reserve) },
            { key: "employee", header: "Employee" },
            { key: "date", header: "Date" },
          ]}
          footer={
            rows && (
              <TotalsRow
                label={<b>TOTAL:</b>}
                cells={["", "", "", "", "", <b key="a">{money(sumBy(rows, (row) => row.amount))}</b>, <b key="p">{money(sumBy(rows, (row) => row.principal))}</b>, <b key="i">{money(sumBy(rows, (row) => row.interest))}</b>, <b key="r">{money(sumBy(rows, (row) => row.reserve))}</b>, "", ""]}
              />
            )
          }
        />
      </PaneCard>

      <FilterModal open={filtering} onClose={() => setFiltering(false)} title="Filter Received" datesFirst onApply={setFilters} />
    </>
  );
}
