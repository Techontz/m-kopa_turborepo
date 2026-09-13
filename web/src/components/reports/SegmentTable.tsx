"use client";

import { CsvButton, TotalsRow } from "@/components/reports/ReportKit";
import { DataTable } from "@/components/ui/DataTable";
import { money } from "@/lib/format";

export interface SegmentRow {
  segment: string;
  customers: number;
  loans: number;
  disbursed: number;
  collected: number;
  repayment_rate: number;
  default_rate: number;
  avg_delay_days: number;
  profit: number;
}

/** Per-segment metrics (Documents: Total Customers, Total Loans, Disbursed, Collected, Default Rate, Avg Delay Days, Profit Contribution). */
export function SegmentTable({ rows, heading, filename }: { rows: SegmentRow[]; heading: string; filename: string }) {
  const sum = (key: keyof SegmentRow) => rows.reduce((total, row) => total + Number(row[key]), 0);

  return (
    <>
      <div className="text-right mb-2">
        <CsvButton
          filename={filename}
          header={[heading, "Total Customers", "Total Loans", "Total Disbursed", "Total Collected", "Repayment Rate %", "Default Rate %", "Avg Delay Days", "Profit Contribution"]}
          rows={rows.map((row) => [row.segment, row.customers, row.loans, row.disbursed, row.collected, row.repayment_rate, row.default_rate, row.avg_delay_days, row.profit])}
        />
      </div>
      <DataTable
        rows={rows}
        rowKey={(row) => row.segment}
        pageSize={25}
        columns={[
          { key: "segment", header: heading },
          { key: "customers", header: "Total Customers" },
          { key: "loans", header: "Total Loans" },
          { key: "disbursed", header: "Total Disbursed", render: (row) => money(row.disbursed) },
          { key: "collected", header: "Total Collected", render: (row) => money(row.collected) },
          { key: "repayment_rate", header: "Repayment Rate", render: (row) => `${row.repayment_rate}%` },
          { key: "default_rate", header: "Default Rate", render: (row) => `${row.default_rate}%` },
          { key: "avg_delay_days", header: "Avg Delay Days" },
          { key: "profit", header: "Profit Contribution", render: (row) => money(row.profit) },
        ]}
        footer={rows.length > 0 && <TotalsRow cells={[sum("customers"), sum("loans"), money(sum("disbursed")), money(sum("collected")), "", "", "", money(sum("profit"))]} />}
      />
    </>
  );
}
