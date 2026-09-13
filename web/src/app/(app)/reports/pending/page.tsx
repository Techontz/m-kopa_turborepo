"use client";

import { useState } from "react";

import { cleanQuery, FilterModal, PaneCard, ReportTabs, SearchButton, sumBy, TotalsRow, type LoanReportRow, type ReportFilters, type ReportRows } from "@/components/reports/ReportKit";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

type PendingRow = LoanReportRow & { pending: number; date: string };
type Tab = "Basic" | "Account" | "General";

const PANES: Record<Tab, [string, PendingRow["duration"] | null]> = {
  Basic: ["All loan pending", null],
  Account: ["Weekly loan pending", "Weekly"],
  General: ["Daily loan pending", "Daily"],
};

/** Report → Loan Pending (live admin/loan_pending_time): active loans with unpaid instalments past their due date. */
export default function LoanPendingPage() {
  const [tab, setTab] = useState<Tab>("Basic");
  const [filters, setFilters] = useState<ReportFilters>({});
  const [filtering, setFiltering] = useState(false);
  const { data, isLoading } = useApi<ReportRows<PendingRow>>("reports/pending", cleanQuery(filters));

  const [title, duration] = PANES[tab];
  const rows = duration ? data?.rows.filter((row) => row.duration === duration) : data?.rows;

  return (
    <>
      <PageHeader crumbs={["Report", "Loan Pending"]} />
      {/* Live: the "Monthly" tab opens the "All loan pending" pane. */}
      <ReportTabs tabs={[["Basic", "Monthly"], ["Account", "Weekly"], ["General", "Daily"]]} value={tab} onChange={setTab} />

      <PaneCard title={title} actions={tab === "Basic" && <SearchButton onClick={() => setFiltering(true)} />}>
        <DataTable
          key={tab}
          rows={rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "branch", header: "Branch Name" },
            { key: "customer", header: "Customer Name" },
            { key: "phone", header: "Phone Number" },
            { key: "total_payable", header: "Loan Amount", render: (row) => money(row.total_payable) },
            { key: "duration", header: "Duration Type" },
            { key: "pending", header: "Pending Amount", render: (row) => money(row.pending) },
            { key: "date", header: "Date" },
          ]}
          footer={tab !== "Basic" && rows && <TotalsRow label={<b>TOTAL:</b>} cells={["", "", "", "", "", money(sumBy(rows, (row) => row.pending)), ""]} />}
        />
      </PaneCard>

      <FilterModal open={filtering} onClose={() => setFiltering(false)} title="Filter Loan Pending" withDates={false} onApply={setFilters} />
    </>
  );
}
