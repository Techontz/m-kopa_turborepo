"use client";

import Link from "next/link";
import { useState } from "react";

import { ReportBarChart } from "@/components/reports/ReportChart";
import { cleanQuery, CsvButton, FilterModal, PrintButton, SearchButton, Stat, StatusBadge, type ReportFilters } from "@/components/reports/ReportKit";
import { Card } from "@/components/ui/Card";
import { Loading } from "@/components/ui/Loading";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

const PAR_DAYS = [1, 7, 30, 60, 90] as const;

type ParRow = { label: string; loans: number; portfolio: number; loans_in_arrears: number; arrears_amount: number; default_rate: number } & Record<string, number | string>;

interface ArrearsLoan {
  id: number;
  loan_number: string;
  customer_id: number;
  customer: string;
  phone: string;
  branch: string;
  officer: string;
  status: string;
  status_badge: string;
  outstanding_principal: number;
  outstanding_total: number;
  arrears: number;
  oldest_due: string;
  dpd: number;
  bucket: string;
}

interface Arrears {
  summary: ParRow;
  by_branch: ParRow[];
  by_officer: ParRow[];
  rows: ArrearsLoan[];
}

const parColumns = (heading: string): Column<ParRow>[] => [
  { key: "label", header: heading },
  { key: "loans", header: "Open Loans" },
  { key: "portfolio", header: "Portfolio (Principal)", render: (row) => money(row.portfolio) },
  { key: "loans_in_arrears", header: "Loans in Arrears" },
  { key: "arrears_amount", header: "Arrears Amount", render: (row) => money(row.arrears_amount) },
  ...PAR_DAYS.map((days) => ({
    key: `par${days}`,
    header: `PAR ${days}`,
    value: (row: ParRow) => Number(row[`par${days}`]),
    render: (row: ParRow) => <>{money(row[`par${days}`] as number)} <small className="text-muted">({row[`par${days}_rate`]}%)</small></>,
  })),
  { key: "default_rate", header: "Default Rate", render: (row) => `${row.default_rate}%` },
];

const csvRows = (rows: ParRow[]) => rows.map((row) => [row.label, row.loans, row.portfolio, row.loans_in_arrears, row.arrears_amount, ...PAR_DAYS.flatMap((days) => [row[`par${days}`], row[`par${days}_rate`]]), row.default_rate]);
const csvHeader = (heading: string) => [heading, "Open Loans", "Portfolio", "Loans in Arrears", "Arrears Amount", ...PAR_DAYS.flatMap((days) => [`PAR ${days}`, `PAR ${days} %`]), "Default Rate %"];

/** Report → Portfolio & Risk → Arrears & PAR (Documents: ⚠️ Default & Arrears Report). */
export default function ArrearsPage() {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [filtering, setFiltering] = useState(false);
  const { data, isLoading } = useApi<Arrears>("reports/arrears", cleanQuery(filters));
  const s = data?.summary;

  return (
    <>
      <PageHeader crumbs={["Report", "Arrears & PAR"]} />

      <Card title="Portfolio at Risk (PAR)" actions={<><SearchButton onClick={() => setFiltering(true)} /><PrintButton /></>}>
        {isLoading || !s ? (
          <Loading />
        ) : (
          <>
            <div className="row">
              <Stat tone="primary" label="Portfolio (Outstanding Principal)" value={money(s.portfolio)} />
              <Stat tone="warning" label={`Loans in Arrears (${s.loans_in_arrears})`} value={money(s.arrears_amount)} />
              <Stat tone="danger" label="PAR 30" value={`${s.par30_rate}%`} />
              <Stat tone="info" label="Default Rate" value={`${s.default_rate}%`} />
            </div>
            <ReportBarChart
              data={PAR_DAYS.map((days) => ({ label: `PAR ${days}`, amount: Number(s[`par${days}`]) }))}
              xKey="label"
              series={[{ key: "amount", label: "Principal at risk" }]}
            />
          </>
        )}
      </Card>

      {data && (
        <>
          <Card title="PAR per Branch" actions={<CsvButton filename="par-per-branch" header={csvHeader("Branch")} rows={csvRows(data.by_branch)} />}>
            <DataTable rows={data.by_branch} rowKey={(row) => row.label} columns={parColumns("Branch")} />
          </Card>
          <Card title="PAR per Loan Officer" actions={<CsvButton filename="par-per-officer" header={csvHeader("Loan Officer")} rows={csvRows(data.by_officer)} />}>
            <DataTable rows={data.by_officer} rowKey={(row) => row.label} columns={parColumns("Loan Officer")} />
          </Card>
          <Card
            title="Loans Past Due"
            actions={<CsvButton filename="loans-past-due" header={["Customer", "Loan Ac", "Branch", "Officer", "Outstanding Principal", "Total Outstanding", "Arrears", "Oldest Due", "Days in Arrears", "Bucket"]} rows={data.rows.map((row) => [row.customer, row.loan_number, row.branch, row.officer, row.outstanding_principal, row.outstanding_total, row.arrears, row.oldest_due, row.dpd, row.bucket])} />}
          >
            <DataTable
              rows={data.rows}
              rowKey={(row) => row.id}
              columns={[
                { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
                { key: "customer", header: "Customer Name", render: (row) => <Link href={`/customers/${row.customer_id}`}>{row.customer}</Link> },
                { key: "loan_number", header: "Loan Ac", render: (row) => <Link href={`/loans/${row.id}`}>{row.loan_number}</Link> },
                { key: "phone", header: "Phone Number" },
                { key: "branch", header: "Branch" },
                { key: "officer", header: "Loan Officer" },
                { key: "outstanding_principal", header: "Outstanding Principal", render: (row) => money(row.outstanding_principal) },
                { key: "outstanding_total", header: "Total Outstanding", render: (row) => money(row.outstanding_total) },
                { key: "arrears", header: "Arrears", render: (row) => money(row.arrears) },
                { key: "oldest_due", header: "Oldest Due" },
                { key: "dpd", header: "Days in Arrears" },
                { key: "bucket", header: "Bucket" },
                { key: "status", header: "Status", render: (row) => <StatusBadge label={row.status} tone={row.status_badge} /> },
              ]}
            />
          </Card>
        </>
      )}

      <FilterModal open={filtering} onClose={() => setFiltering(false)} title="Filter Arrears" datesOptional onApply={setFilters} />
    </>
  );
}
