"use client";

import Link from "next/link";
import { useState } from "react";

import { cleanQuery, FilterModal, SearchButton, StatusBadge, TotalsRow, type LoanReportRow, type ReportFilters, type Totals } from "@/components/reports/ReportKit";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

/** A live loan row, or (historical: true) a row of an imported historical File report, figures as printed. */
type FileRow = Omit<LoanReportRow, "id" | "duration" | "status"> & {
  id: number | string;
  duration: string | null;
  status: string | null;
  months: Record<string, number>;
  historical: boolean;
  /** Historical rows: the customer created from the row, if any. */
  customer_id: number | null;
  source?: string;
  serial_number?: number;
};

interface HistoricalSource {
  id: number;
  title: string;
  source_document: string;
  branch: string;
  year: number;
  records: number;
  printed_totals: Record<string, number>;
  notes: string | null;
}

interface FileReport {
  rows: FileRow[];
  months: Array<{ number: number; name: string }>;
  totals: Totals;
  historical: HistoricalSource[];
  year: number;
  years: number[];
}

/**
 * Report → File (live admin/collection_data): loans with collections in a year, one column per collection month.
 * Rows of imported historical File reports (e.g. Kakonko 2022) are listed with their printed S/No. and a source badge;
 * they are records only — no loan, cash or ledger entry stands behind them.
 */
export default function FileReportPage() {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [filtering, setFiltering] = useState(false);
  const { data, isLoading } = useApi<FileReport>("reports/file", cleanQuery(filters));

  const columns: Column<FileRow>[] = [
    { key: "sn", header: "S/No.", render: (row, index) => `${row.historical ? row.serial_number : index + 1}.`, sortable: false },
    { key: "branch", header: "Branch Name" },
    {
      key: "customer",
      header: "Customer Name",
      render: (row) => (
        <>
          {row.historical && row.customer_id ? <Link href={`/customers/${row.customer_id}`}>{row.customer}</Link> : row.customer}
          {row.historical && <div><span className="badge badge-default" title={row.source}>Historical {data?.year}</span></div>}
        </>
      ),
    },
    { key: "phone", header: "Phone Number" },
    { key: "total_payable", header: "Loan Amount", render: (row) => money(row.total_payable) },
    { key: "duration", header: "Duration Type", value: (row) => durationLabel(row), render: (row) => durationLabel(row) },
    { key: "restoration", header: "Collection", render: (row) => money(row.restoration) },
    { key: "paid", header: "Paid Amount", render: (row) => money(row.paid) },
    { key: "remain", header: "Remain Amount", render: (row) => money(row.remain) },
    { key: "withdrawal_date", header: "Withdrawal Date" },
    { key: "status", header: "Loan Status", render: (row) => <StatusBadge label={row.status} tone={row.status_badge} /> },
    ...(data?.months ?? []).map((month) => ({
      key: `month_${month.number}`,
      header: month.name,
      value: (row: FileRow) => row.months[month.number] ?? 0,
      render: (row: FileRow) => money(row.months[month.number] ?? 0),
    })),
  ];

  const historical = data?.historical ?? [];
  const printedTotal = (month: number) => historical.reduce((sum, source) => sum + (source.printed_totals[month] ?? 0), 0);

  return (
    <>
      <PageHeader crumbs={["Report", "File"]} />

      {historical.map((source) => (
        <div key={source.id} className="alert alert-info">
          <strong>Historical records:</strong> {source.records} rows from {source.title} ({source.source_document}), branch {source.branch}. Imported from the
          old system as records only — they are not loans, repayments or cash in this system and do not change any balance.{" "}
          <Link href={`/reports/file/historical-payments?year=${source.year}`}>Monthly payment history</Link>
          {source.notes && <div className="small mt-1">{source.notes}</div>}
        </div>
      ))}

      <Card
        title="File"
        actions={
          <>
            <SearchButton onClick={() => setFiltering(true)} />
            <Link href="/reports/file/new-loans" className="btn btn-sm btn-warning ml-1" title="New Loan"><i className="icon-drawer" /></Link>
            <Link href="/reports/file/historical-payments" className="btn btn-sm btn-info ml-1" title="Historical Payments"><i className="icon-clock" /></Link>
          </>
        }
      >
        <DataTable
          rows={data?.rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={columns}
          footer={
            data && (
              <>
                <TotalsRow cells={[...Array(10).fill(""), ...data.months.map((month) => money(data.totals[`month_${month.number}`]))]} />
                {historical.length > 0 && <TotalsRow label="PRINTED TOTAL" cells={[`As printed on ${historical.map((source) => source.source_document).join(", ")}`, ...Array(9).fill(""), ...data.months.map((month) => money(printedTotal(month.number)))]} />}
              </>
            )
          }
        />
      </Card>

      <FilterModal open={filtering} onClose={() => setFiltering(false)} title="Filter Loan Collection" withDates={false} withAll={false} initial={{ year: String(new Date().getFullYear()), loan_status: "ALL" }} onApply={setFilters}>
        {(form, setForm) => (
          <>
            <Field label="*Select Year:" className="col-md-6">
              <select className="form-control" value={form.year ?? ""} onChange={(e) => setForm({ ...form, year: e.target.value })} required>
                <option value="">Select Year</option>
                {(data?.years ?? []).map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </Field>
            <Field label="*Status:" className="col-md-6">
              <select className="form-control" value={form.loan_status ?? ""} onChange={(e) => setForm({ ...form, loan_status: e.target.value })} required>
                <option value="">Select Status</option>
                {["ALL", "ACTIVE", "CLOSED", "DEFAULT"].map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </Field>
          </>
        )}
      </FilterModal>
    </>
  );
}

/** Historical rows keep the printed "Monthly / 6" (a blank printed duration type prints as "/ 3"); live rows show the duration. */
function durationLabel(row: FileRow): string {
  if (!row.historical) {
    return row.duration ?? "";
  }
  return row.sessions ? `${row.duration ?? ""} / ${row.sessions}`.trim() : (row.duration ?? "");
}
