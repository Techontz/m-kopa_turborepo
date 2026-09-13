"use client";

import { ReportFrame, styles, SummaryTiles, useDefaultFilter, useFinancialReport } from "@/components/financial-reports/ReportShell";
import { DataTable } from "@/components/ui/DataTable";
import { money } from "@/lib/format";

interface ReversalReport {
  rows: Array<{
    id: number;
    date: string;
    reference: string;
    original_reference: string | null;
    original_date: string | null;
    description: string;
    source: string;
    amount: number;
    branch: string;
    posted_by: string | null;
    reversed_by: string | null;
    reason: string | null;
  }>;
  count: number;
  total: number;
  by_source: Array<{ label: string; count: number; amount: number }>;
}

export default function ReversalReportPage() {
  const [filter, setFilter] = useDefaultFilter();
  const { data, isLoading, error } = useFinancialReport<ReversalReport>("reversals", filter);

  return (
    <ReportFrame title="Reversal Report" filter={filter} onFilter={setFilter} error={error} loading={isLoading}>
      {data && (
        <>
          <SummaryTiles
            items={[
              { label: "Reversed Transactions", value: String(data.count) },
              { label: "Amount Reversed", value: data.total },
            ]}
          />
          <DataTable
            rows={data.rows}
            rowKey={(row) => row.id}
            pageSize={25}
            columns={[
              { key: "sn", header: "S/No.", sortable: false, render: (_row, index) => `${index + 1}.` },
              { key: "date", header: "Reversal Date" },
              { key: "reference", header: "Reversal Ref" },
              { key: "original_reference", header: "Original Ref", render: (row) => row.original_reference ?? "-" },
              { key: "original_date", header: "Original Date", render: (row) => row.original_date ?? "-" },
              { key: "description", header: "Description" },
              { key: "source", header: "Source" },
              { key: "amount", header: "Amount", render: (row) => money(row.amount) },
              { key: "branch", header: "Branch" },
              { key: "posted_by", header: "Posted By", render: (row) => row.posted_by ?? "-" },
              { key: "reversed_by", header: "Reversed By", render: (row) => row.reversed_by ?? "-" },
              { key: "reason", header: "Reason", render: (row) => row.reason ?? "-" },
            ]}
            footer={
              <tr className={styles.total}>
                <td colSpan={7}>TOTAL</td>
                <td>{money(data.total)}</td>
                <td colSpan={4} />
              </tr>
            }
          />
          {data.by_source.length > 0 && (
            <>
              <div className={styles.subhead}>By source</div>
              <DataTable
                rows={data.by_source}
                rowKey={(row) => row.label}
                searchable={false}
                pageSize={100}
                columns={[
                  { key: "label", header: "Source" },
                  { key: "count", header: "Count" },
                  { key: "amount", header: "Amount", render: (row) => money(row.amount) },
                ]}
              />
            </>
          )}
        </>
      )}
    </ReportFrame>
  );
}
