"use client";

import Link from "next/link";
import { useState } from "react";

import { cleanQuery, FilterModal, PrintButton, SearchButton, TotalsRow, type ReportFilters, type Totals } from "@/components/reports/ReportKit";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

/** A live penalty, or (historical: true) a row of an imported historical Penalty report, figures as printed. */
interface PenaltyRow {
  id: number | string;
  historical: boolean;
  source: string | null;
  serial_number: number | null;
  customer_id: number | null;
  customer: string | null;
  branch: string | null;
  loan_id: number | null;
  loan_number: string | null;
  loan_amount: number;
  penalty_amount: number;
  paid_amount: number;
  is_waived: boolean;
  penalty_date: string | null;
}

interface HistoricalSource {
  id: number;
  title: string;
  source_document: string;
  branch: string;
  printed_on: string | null;
  records: number;
  printed_total: number;
  notes: string | null;
}

interface PenaltyReport {
  rows: PenaltyRow[];
  totals: Totals;
  historical: HistoricalSource[];
}

/**
 * Report → Penalty (the old system's "PENARTY REPORT"): every penalty charged, newest first. Rows of imported
 * historical Penalty reports are listed with their printed S/No. and a source badge; they are records only — no
 * penalty, payment, cash or ledger entry stands behind them, and nothing on them is owed to or by this system.
 * A negative Penalty Amount is a waiver or correction the old system printed as a negative figure, kept as printed.
 */
export default function PenaltyReportPage() {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [filtering, setFiltering] = useState(false);
  const { data, isLoading } = useApi<PenaltyReport>("reports/penalties", cleanQuery(filters));

  const columns: Column<PenaltyRow>[] = [
    { key: "sn", header: "S/No.", render: (row, index) => `${row.historical ? row.serial_number : index + 1}.`, sortable: false },
    {
      key: "customer",
      header: "Customer Name",
      render: (row) => (
        <>
          {row.customer_id ? <Link href={`/customers/${row.customer_id}`}>{row.customer ?? "—"}</Link> : (row.customer ?? <span className="text-muted">(no name on the printout)</span>)}
          {row.historical && <div><span className="badge badge-default" title={row.source ?? undefined}>Historical</span></div>}
        </>
      ),
    },
    { key: "branch", header: "Branch Name" },
    { key: "loan_amount", header: "Loan Amount", render: (row) => money(row.loan_amount) },
    {
      key: "penalty_amount",
      header: "Penalty Amount",
      render: (row) => (
        <>
          {money(row.penalty_amount)}
          {row.is_waived && <div><span className="badge badge-warning">Waived</span></div>}
        </>
      ),
    },
    { key: "penalty_date", header: "Date", render: (row) => row.penalty_date ?? "" },
  ];

  const historical = data?.historical ?? [];
  const printedTotal = historical.reduce((sum, source) => sum + source.printed_total, 0);

  return (
    <>
      <PageHeader crumbs={["Report", "Penalty"]} />

      {historical.length > 0 && (
        <div className="alert alert-info">
          <strong>Historical records:</strong> {historical.reduce((sum, source) => sum + source.records, 0)} rows from{" "}
          {historical.length} Penalty {historical.length === 1 ? "report" : "reports"} printed by the old system
          ({historical.map((source) => source.branch).join(", ")}). Imported as records only — they are not penalties,
          payments or cash in this system and do not change any balance. A negative Penalty Amount is a waiver or
          correction as the old system printed it.
          <div className="small mt-1">
            {historical.map((source) => (
              <div key={source.id}>
                {source.title} ({source.source_document}) — {source.records} rows, printed total {money(source.printed_total)}
                {source.printed_on && ` on ${source.printed_on}`}
              </div>
            ))}
          </div>
        </div>
      )}

      <Card
        title="Penalty"
        actions={
          <>
            <SearchButton onClick={() => setFiltering(true)} />
            <PrintButton />
          </>
        }
      >
        <DataTable
          rows={data?.rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          pageSize={25}
          columns={columns}
          emptyMessage="No penalty has been charged in this branch and date range."
          footer={
            data && (
              <>
                <TotalsRow cells={["", "", money(data.totals.loan_amount), money(data.totals.penalty_amount), ""]} />
                {historical.length > 0 && (
                  <TotalsRow
                    label="PRINTED TOTAL"
                    cells={[`As printed on ${historical.map((source) => source.source_document).join(", ")}`, "", "", money(printedTotal), ""]}
                  />
                )}
              </>
            )
          }
        />
      </Card>

      <FilterModal open={filtering} onClose={() => setFiltering(false)} title="Filter Penalty" onApply={setFilters} />
    </>
  );
}
