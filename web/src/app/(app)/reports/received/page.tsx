"use client";

import { useState } from "react";

import { cleanQuery, FilterModal, PaneCard, ReportTabs, SearchButton, sumBy, TotalsRow, type ReportFilters, type ReportRows } from "@/components/reports/ReportKit";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { SelectBox } from "@/components/ui/SelectBox";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface ReceivedRow {
  id: string;
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
  method: string;
  employee: string | null;
  date: string;
  status: string;
  status_label: string;
  status_badge: BadgeTone;
}

type Tab = "Basic" | "aditinal" | "Account" | "General";

/** Pane headings as on live, including "Daily Receivable" on the daily received pane. */
const PANES: Record<Tab, [string, string | null, string]> = {
  Basic: ["All Received", null, "Reserve"],
  aditinal: ["Monthly Received", "Monthly", "reserve"],
  Account: ["Weekly Received", "Weekly", "reserve"],
  General: ["Daily Receivable", "Daily", "reserve"],
};

/**
 * Report → Today Received (live admin/today_receved_loan): every loan payment with its status — COMPLETED repayments with their
 * Principal / Interest split and reserve, money still pending (not yet verified / approved) and reversed repayments. Totals count
 * completed repayments only. Today by default; choosing a branch shows that branch's whole history.
 */
export default function ReceivedPage() {
  const [tab, setTab] = useState<Tab>("Basic");
  const [filters, setFilters] = useState<ReportFilters>({});
  const [filtering, setFiltering] = useState(false);
  const { data, isLoading } = useApi<ReportRows<ReceivedRow>>("reports/received", cleanQuery(filters));

  const [title, duration, reserveLabel] = PANES[tab];
  const rows = duration ? data?.rows.filter((row) => row.duration === duration) : data?.rows;
  const completed = rows?.filter((row) => row.status === "completed");
  const pendingTotal = sumBy(rows?.filter((row) => row.status !== "completed" && row.status !== "reversed") ?? [], (row) => row.amount);
  const period = filters.from || filters.to ? `${filters.from ?? "…"} to ${filters.to ?? "…"}` : filters.branch_id && filters.branch_id !== "all" ? "all history" : "today";

  return (
    <>
      <PageHeader crumbs={["Report", "Received"]} />
      <ReportTabs tabs={[["Basic", "All"], ["aditinal", "Monthly"], ["Account", "Weekly"], ["General", "Daily"]]} value={tab} onChange={setTab} />

      <div className="card">
        <div className="body d-flex flex-wrap align-items-center" style={{ gap: 12 }}>
          <span>Branch:</span>
          <SelectBox
            width={280}
            placeholder="All branches (today)"
            optionsUrl="options/branches"
            query={{ branches_only: 1 }}
            isClearable
            value={filters.branch_id ?? ""}
            onChange={(value) => setFilters({ ...filters, branch_id: value ?? "", from: "", to: "" })}
          />
          <small className="text-muted">Showing {period}. Choose a branch to see all of its payment history.</small>
        </div>
      </div>

      <PaneCard
        title={<>{title} <small className="ml-2">({period}) · Pending: <b>{money(pendingTotal)}</b></small></>}
        actions={tab === "Basic" && <SearchButton onClick={() => setFiltering(true)} />}
      >
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
            { key: "method", header: "Method" },
            { key: "amount", header: "Received Amount", render: (row) => money(row.amount) },
            { key: "principal", header: "Principal", render: (row) => money(row.principal) },
            { key: "interest", header: "Interest", render: (row) => money(row.interest) },
            { key: "reserve", header: reserveLabel, render: (row) => money(row.reserve) },
            { key: "employee", header: "Employee" },
            { key: "date", header: "Date" },
            { key: "status", header: "Status", value: (row) => row.status_label, render: (row) => <Badge tone={row.status_badge}>{row.status_label}</Badge> },
          ]}
          footer={
            rows && (
              <TotalsRow
                label={<b>TOTAL (completed):</b>}
                cells={["", "", "", "", "", "", <b key="a">{money(sumBy(completed ?? [], (row) => row.amount))}</b>, <b key="p">{money(sumBy(completed ?? [], (row) => row.principal))}</b>, <b key="i">{money(sumBy(completed ?? [], (row) => row.interest))}</b>, <b key="r">{money(sumBy(completed ?? [], (row) => row.reserve))}</b>, "", "", ""]}
              />
            )
          }
        />
      </PaneCard>

      <FilterModal open={filtering} onClose={() => setFiltering(false)} title="Filter Received" datesFirst onApply={setFilters} />
    </>
  );
}
