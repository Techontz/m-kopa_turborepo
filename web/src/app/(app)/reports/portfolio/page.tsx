"use client";

import { useState } from "react";

import { ReportBarChart } from "@/components/reports/ReportChart";
import { cleanQuery, CsvButton, FilterModal, PrintButton, SearchButton, Stat, TotalsRow, type ReportFilters } from "@/components/reports/ReportKit";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface GroupRow {
  label: string;
  loans: number;
  active: number;
  completed: number;
  default: number;
  written_off: number;
  disbursed: number;
  outstanding_principal: number;
  outstanding_total: number;
  share: number;
}

interface Portfolio {
  summary: Record<string, number>;
  by_branch: GroupRow[];
  by_product: GroupRow[];
  by_officer: GroupRow[];
  by_category: GroupRow[];
}

const GROUPS: Array<[keyof Omit<Portfolio, "summary">, string, string]> = [
  ["by_branch", "Portfolio per Branch", "Branch"],
  ["by_product", "Portfolio per Loan Product", "Loan Product"],
  ["by_officer", "Portfolio per Loan Officer", "Loan Officer"],
  ["by_category", "Portfolio per Customer Category", "Customer Category"],
];

function GroupTable({ rows, heading }: { rows: GroupRow[]; heading: string }) {
  const sum = (key: keyof GroupRow) => rows.reduce((total, row) => total + Number(row[key]), 0);

  return (
    <DataTable
      rows={rows}
      rowKey={(row) => row.label}
      columns={[
        { key: "label", header: heading },
        { key: "loans", header: "Loans Issued" },
        { key: "active", header: "Active" },
        { key: "completed", header: "Completed" },
        { key: "default", header: "Default" },
        { key: "disbursed", header: "Disbursed", render: (row) => money(row.disbursed) },
        { key: "outstanding_principal", header: "Outstanding Principal", render: (row) => money(row.outstanding_principal) },
        { key: "outstanding_total", header: "Total Outstanding", render: (row) => money(row.outstanding_total) },
        { key: "share", header: "% of Portfolio", render: (row) => `${row.share}%` },
      ]}
      footer={rows.length > 0 && <TotalsRow cells={[sum("loans"), sum("active"), sum("completed"), sum("default"), money(sum("disbursed")), money(sum("outstanding_principal")), money(sum("outstanding_total")), ""]} />}
    />
  );
}

/** Report → Portfolio & Risk → Loan Portfolio (Documents: 📘 Loan Portfolio Report). */
export default function LoanPortfolioPage() {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [filtering, setFiltering] = useState(false);
  const { data, isLoading } = useApi<Portfolio>("reports/portfolio", cleanQuery(filters));
  const s = data?.summary;

  return (
    <>
      <PageHeader crumbs={["Report", "Loan Portfolio"]} />

      <Card
        title={`Loan Portfolio${filters.from ? ` / Issued ${filters.from} - ${filters.to}` : ""}`}
        actions={<><SearchButton onClick={() => setFiltering(true)} /><PrintButton /></>}
      >
        {isLoading || !s ? (
          <div className="mf-loading">Loading...</div>
        ) : (
          <div className="row">
            <Stat tone="primary" label="Total Loans Issued" value={`${s.issued_count} / ${money(s.issued_amount)}`} />
            <Stat tone="success" label="Active Loans" value={s.active_count} />
            <Stat tone="info" label="Completed Loans" value={s.completed_count} />
            <Stat tone="danger" label="Default Loans" value={s.default_count} />
            <Stat tone="primary" label="Outstanding Principal" value={money(s.outstanding_principal)} />
            <Stat tone="warning" label="Outstanding Interest" value={money(s.outstanding_interest)} />
            <Stat tone="danger" label="Outstanding Penalty" value={money(s.outstanding_penalty)} />
            <Stat tone="success" label={`Total Outstanding (${s.active_customers} customers)`} value={money(s.outstanding_total)} />
          </div>
        )}
      </Card>

      {data &&
        GROUPS.map(([key, title, heading]) => (
          <Card
            key={key}
            title={title}
            actions={
              <CsvButton
                filename={`loan-portfolio-${key}`}
                header={[heading, "Loans Issued", "Active", "Completed", "Default", "Disbursed", "Outstanding Principal", "Total Outstanding", "% of Portfolio"]}
                rows={data[key].map((row) => [row.label, row.loans, row.active, row.completed, row.default, row.disbursed, row.outstanding_principal, row.outstanding_total, row.share])}
              />
            }
          >
            {key === "by_branch" && <ReportBarChart data={data[key]} xKey="label" series={[{ key: "outstanding_principal", label: "Outstanding Principal" }]} />}
            <GroupTable rows={data[key]} heading={heading} />
          </Card>
        ))}

      <FilterModal open={filtering} onClose={() => setFiltering(false)} title="Filter Loan Portfolio" datesOptional onApply={setFilters} />
    </>
  );
}
