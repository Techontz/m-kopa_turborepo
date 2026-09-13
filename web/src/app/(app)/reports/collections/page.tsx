"use client";

import { useState } from "react";

import { ReportBarChart } from "@/components/reports/ReportChart";
import { cleanQuery, CsvButton, FilterModal, PrintButton, SearchButton, Stat, TotalsRow, type ReportFilters } from "@/components/reports/ReportKit";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface CollectionRow {
  label: string;
  expected: number;
  due_paid: number;
  collected: number;
  principal: number;
  penalty: number;
  interest: number;
  insurance: number;
  variance: number;
  collection_rate: number;
}

interface Collections {
  period: string;
  summary: CollectionRow;
  rows: CollectionRow[];
  by_branch: CollectionRow[];
  mandates: { total: number; active: number; failed: number; pending: number; success_rate: number };
  filter: { from: string; to: string };
}

const columns = (heading: string): Column<CollectionRow>[] => [
  { key: "label", header: heading },
  { key: "expected", header: "Expected", render: (row) => money(row.expected) },
  { key: "due_paid", header: "Paid on Due Instalments", render: (row) => money(row.due_paid) },
  { key: "collected", header: "Actual Collected", render: (row) => money(row.collected) },
  { key: "principal", header: "Principal", render: (row) => money(row.principal) },
  { key: "penalty", header: "Penarty", render: (row) => money(row.penalty) },
  { key: "interest", header: "Interest", render: (row) => money(row.interest) },
  { key: "variance", header: "Variance", render: (row) => money(row.variance) },
  { key: "collection_rate", header: "Collection Rate", render: (row) => `${row.collection_rate}%` },
];

const totals = (row: CollectionRow) => [money(row.expected), money(row.due_paid), money(row.collected), money(row.principal), money(row.penalty), money(row.interest), money(row.variance), `${row.collection_rate}%`];

/** Report → Portfolio & Risk → Repayment (Documents: 📅 Repayment Report — Expected vs Actual, daily/weekly/monthly, e-mandate success rate). */
export default function CollectionsPage() {
  const [filters, setFilters] = useState<ReportFilters>({ period: "daily" });
  const [filtering, setFiltering] = useState(false);
  const { data, isLoading } = useApi<Collections>("reports/collections", cleanQuery(filters));
  const periodLabel = { daily: "Date", weekly: "Week starting", monthly: "Month" }[data?.period ?? "daily"] ?? "Period";

  return (
    <>
      <PageHeader crumbs={["Report", "Repayment (Expected vs Actual)"]} />

      <Card title={`Expected vs Actual Collection${data ? ` / ${data.filter.from} - ${data.filter.to}` : ""}`} actions={<><SearchButton onClick={() => setFiltering(true)} /><PrintButton /></>}>
        {isLoading || !data ? (
          <div className="mf-loading">Loading...</div>
        ) : (
          <>
            <div className="row">
              <Stat tone="primary" label="Expected" value={money(data.summary.expected)} />
              <Stat tone="success" label="Actual Collected" value={money(data.summary.collected)} />
              <Stat tone="info" label="Collection Rate" value={`${data.summary.collection_rate}%`} />
              <Stat tone="warning" label={`E-mandate Success (${data.mandates.active}/${data.mandates.active + data.mandates.failed})`} value={`${data.mandates.success_rate}%`} />
            </div>
            <div className="btn-group mb-3">
              {["daily", "weekly", "monthly"].map((period) => (
                <button key={period} type="button" className={`btn btn-sm ${data.period === period ? "btn-primary" : "btn-default"}`} onClick={() => setFilters({ ...filters, period })}>
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </button>
              ))}
            </div>
            <ReportBarChart data={data.rows} xKey="label" series={[{ key: "expected", label: "Expected" }, { key: "collected", label: "Actual" }]} />
            <DataTable rows={data.rows} rowKey={(row) => row.label} columns={columns(periodLabel)} footer={<TotalsRow cells={totals(data.summary)} />} />
          </>
        )}
      </Card>

      {data && (
        <Card
          title="Collection per Branch"
          actions={<CsvButton filename="collection-per-branch" header={["Branch", "Expected", "Paid on Due", "Collected", "Principal", "Penarty", "Interest", "Variance", "Rate %"]} rows={data.by_branch.map((row) => [row.label, row.expected, row.due_paid, row.collected, row.principal, row.penalty, row.interest, row.variance, row.collection_rate])} />}
        >
          <DataTable rows={data.by_branch} rowKey={(row) => row.label} columns={columns("Branch")} footer={<TotalsRow cells={totals(data.summary)} />} />
          <p className="text-muted mb-0">
            E-mandates: {data.mandates.total} total, {data.mandates.active} active, {data.mandates.failed} failed, {data.mandates.pending} pending.
          </p>
        </Card>
      )}

      <FilterModal open={filtering} onClose={() => setFiltering(false)} title="Filter Repayment" datesOptional initial={{ period: filters.period }} onApply={setFilters}>
        {(form, setForm) => (
          <Field label="Period:" className="col-md-12">
            <select className="form-control" value={form.period ?? "daily"} onChange={(e) => setForm({ ...form, period: e.target.value })}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </Field>
        )}
      </FilterModal>
    </>
  );
}
