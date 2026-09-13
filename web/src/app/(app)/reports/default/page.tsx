"use client";

import { useState } from "react";

import { cleanQuery, FilterModal, PaneCard, ReportTabs, SearchButton, sumBy, TotalsRow, type LoanReportRow, type ReportFilters, type ReportRows } from "@/components/reports/ReportKit";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction } from "@/components/ui/notify";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

type DefaultRow = LoanReportRow & { paid_this_month: number };
type Tab = "Basic" | "aditinal" | "Account" | "General";

const PANES: Record<Tab, [string, DefaultRow["duration"] | null]> = {
  Basic: ["All default loan", null],
  aditinal: ["Monthly Default loan", "Monthly"],
  Account: ["Weekly Default loan", "Weekly"],
  General: ["Daily Default Loan", "Daily"],
};

/** Report → Default Loan (live admin/get_outstand_loan) with the Write-off action. */
export default function DefaultLoanPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<Tab>("Basic");
  const [filters, setFilters] = useState<ReportFilters>({});
  const [filtering, setFiltering] = useState(false);
  const { data, isLoading } = useApi<ReportRows<DefaultRow>>("reports/default", cleanQuery(filters));
  const writeOff = useAction<{ id: number }>("post", (body) => `loans/${body.id}/write-off`);

  const [title, duration] = PANES[tab];
  const rows = duration ? data?.rows.filter((row) => row.duration === duration) : data?.rows;
  const withPaid = tab === "Basic" || tab === "aditinal";

  const columns: Column<DefaultRow>[] = [
    { key: "sn", header: "S/No.", render: (_, index) => index + 1, sortable: false },
    { key: "branch", header: "Branch Name", render: (row) => row.branch?.toUpperCase() },
    { key: "customer", header: "Customer Name" },
    { key: "phone", header: "Phone Number" },
    { key: "total_payable", header: "Loan Amount", render: (row) => money(row.total_payable) },
    { key: "restoration", header: "Restoration", render: (row) => money(row.restoration) },
    { key: "duration", header: "Duration Type" },
    { key: "sessions", header: "Number of Repayment" },
    ...(withPaid ? [{ key: "paid_this_month", header: tab === "Basic" ? "Paid This Month" : "Paid this Month", render: (row: DefaultRow) => money(row.paid_this_month) }] : []),
    { key: "remain", header: "Remain Amount", render: (row) => money(row.remain) },
    { key: "withdrawal_date", header: "Start date" },
    { key: "end_date", header: "End date" },
    ...(withPaid
      ? [{
          key: "action",
          header: tab === "Basic" ? "Action" : "",
          sortable: false,
          render: (row: DefaultRow) =>
            tab === "Basic" && can("loans.write_off") ? (
              <button type="button" className="btn btn-sm btn-danger" title="Write-off" onClick={async () => (await confirmAction("Are you sure to write-off")) && writeOff.mutate({ id: row.id })}>
                <i className="icon-close" />
              </button>
            ) : null,
        }]
      : []),
  ];

  return (
    <>
      <PageHeader crumbs={["Report", "Default Loan"]} />
      <ReportTabs tabs={[["Basic", "All"], ["aditinal", "Monthly"], ["Account", "Weekly"], ["General", "Daily"]]} value={tab} onChange={setTab} />

      <PaneCard title={title} actions={tab === "Basic" && <SearchButton onClick={() => setFiltering(true)} />}>
        <DataTable
          key={tab}
          rows={rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={columns}
          footer={
            rows && (
              <TotalsRow
                label={<b>TOTAL:</b>}
                cells={[...Array(7).fill(""), ...(withPaid ? [<b key="m">{money(sumBy(rows, (row) => row.paid_this_month))}</b>] : []), <b key="r">{money(sumBy(rows, (row) => row.remain))}</b>, "", "", ...(withPaid ? [""] : [])]}
              />
            )
          }
        />
      </PaneCard>

      <FilterModal open={filtering} onClose={() => setFiltering(false)} title="Filter" withDates={false} onApply={setFilters} />
    </>
  );
}
