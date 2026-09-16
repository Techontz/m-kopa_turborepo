"use client";

import { useState } from "react";

import { ReportBarChart } from "@/components/reports/ReportChart";
import { cleanQuery, CsvButton, FilterModal, PrintButton, SearchButton, Stat, TotalsRow, type ReportFilters } from "@/components/reports/ReportKit";
import { Card } from "@/components/ui/Card";
import { Loading } from "@/components/ui/Loading";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface RecoveryRow {
  label: string;
  default_loans: number;
  default_balance: number;
  written_off: number;
  recovered_default: number;
  recovered_write_off: number;
  unrecovered_write_off: number;
  total_recovered: number;
  efficiency: number;
}

interface RecoveryTransaction {
  id: number;
  date: string;
  loan_number: string;
  customer: string;
  branch: string;
  end_date: string;
  days_after_end: number;
  amount: number;
  principal: number;
  penalty: number;
  interest: number;
  status: string;
  /** "repayment" after the end date of a defaulted loan, or "write_off_recovery" (rule 8: all interest income). */
  source?: "repayment" | "write_off_recovery";
}

interface Recovery {
  summary: RecoveryRow;
  by_branch: RecoveryRow[];
  rows: RecoveryTransaction[];
}

/** Report → Portfolio & Risk → Recovery (Documents: 💰 Recovery Report — amount recovered from defaults, efficiency per branch). */
export default function RecoveryPage() {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [filtering, setFiltering] = useState(false);
  const { data, isLoading } = useApi<Recovery>("reports/recovery", cleanQuery(filters));
  const s = data?.summary;

  return (
    <>
      <PageHeader crumbs={["Report", "Recovery"]} />

      <Card title="Recovery Report" actions={<><SearchButton onClick={() => setFiltering(true)} /><PrintButton /></>}>
        {isLoading || !s || !data ? (
          <Loading />
        ) : (
          <>
            <div className="row">
              <Stat tone="success" label="Recovered from Defaults" value={money(s.recovered_default)} />
              <Stat tone="info" label="Recovered from Write-off" value={money(s.recovered_write_off)} />
              <Stat tone="danger" label={`Balance in Default (${s.default_loans} loans)`} value={money(s.default_balance)} />
              <Stat tone="primary" label="Recovery Efficiency" value={`${s.efficiency}%`} />
            </div>
            <ReportBarChart data={data.by_branch} xKey="label" series={[{ key: "total_recovered", label: "Recovered" }, { key: "default_balance", label: "Still in default" }]} />
            <DataTable
              rows={data.by_branch}
              rowKey={(row) => row.label}
              columns={[
                { key: "label", header: "Branch" },
                { key: "default_loans", header: "Default Loans" },
                { key: "default_balance", header: "Default Balance", render: (row) => money(row.default_balance) },
                { key: "written_off", header: "Write-off Amount", render: (row) => money(row.written_off) },
                { key: "recovered_default", header: "Recovered (Default)", render: (row) => money(row.recovered_default) },
                { key: "recovered_write_off", header: "Recovered (Write-off)", render: (row) => money(row.recovered_write_off) },
                { key: "unrecovered_write_off", header: "Unrecovered (Write-off)", render: (row) => money(row.unrecovered_write_off) },
                { key: "total_recovered", header: "Total Recovered", render: (row) => money(row.total_recovered) },
                { key: "efficiency", header: "Recovery Efficiency", render: (row) => `${row.efficiency}%` },
              ]}
              footer={<TotalsRow cells={[s.default_loans, money(s.default_balance), money(s.written_off), money(s.recovered_default), money(s.recovered_write_off), money(s.unrecovered_write_off), money(s.total_recovered), `${s.efficiency}%`]} />}
            />
          </>
        )}
      </Card>

      {data && (
        <Card
          title="Recovery Transactions"
          actions={<CsvButton filename="recovery-transactions" header={["Date", "Customer", "Loan Ac", "Branch", "End Date", "Days after End", "Amount", "Principal", "Penalty", "Interest", "Status"]} rows={data.rows.map((row) => [row.date, row.customer, row.loan_number, row.branch, row.end_date, row.days_after_end, row.amount, row.principal, row.penalty, row.interest, row.status])} />}
        >
          <DataTable
            rows={data.rows}
            rowKey={(row) => `${row.source ?? "repayment"}-${row.id}`}
            columns={[
              { key: "date", header: "Date" },
              { key: "source", header: "Source", render: (row) => (row.source === "write_off_recovery" ? "Write-off recovery (interest income)" : "Repayment") },
              { key: "customer", header: "Customer Name" },
              { key: "loan_number", header: "Loan Ac" },
              { key: "branch", header: "Branch" },
              { key: "end_date", header: "End Date" },
              { key: "days_after_end", header: "Days after End" },
              { key: "amount", header: "Amount", render: (row) => money(row.amount) },
              { key: "principal", header: "Principal", render: (row) => money(row.principal) },
              { key: "penalty", header: "Penalty", render: (row) => money(row.penalty) },
              { key: "interest", header: "Interest", render: (row) => money(row.interest) },
              { key: "status", header: "Loan Status" },
            ]}
          />
        </Card>
      )}

      <FilterModal open={filtering} onClose={() => setFiltering(false)} title="Filter Recovery" datesOptional onApply={setFilters} />
    </>
  );
}
