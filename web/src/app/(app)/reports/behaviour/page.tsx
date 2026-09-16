"use client";

import { useState } from "react";

import { ReportBarChart } from "@/components/reports/ReportChart";
import { cleanQuery, CsvButton, FilterModal, PrintButton, ReportTabs, SearchButton, Stat, type ReportFilters } from "@/components/reports/ReportKit";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Loading } from "@/components/ui/Loading";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface Instalment {
  id: number;
  loan_number: string;
  customer: string;
  branch: string;
  due_date: string;
  paid_date: string | null;
  amount: number;
  paid_amount: number;
  delay_days: number;
  bucket: string;
  bucket_label: string;
}

interface CustomerBehaviour {
  customer_id: number;
  customer: string;
  phone: string;
  branch: string;
  total_loans: number;
  instalments: number;
  avg_delay_days: number;
  max_delay_days: number;
  on_time_rate: number;
  late_rate: number;
  default_history: number;
  rating: "A" | "B" | "C" | "D";
  pattern: string;
}

interface Behaviour {
  buckets: Array<{ bucket: string; label: string; instalments: number; amount: number; share: number }>;
  ratings: Record<string, number>;
  patterns: Array<{ pattern: string; customers: number }>;
  summary: { instalments: number; avg_delay_days: number; on_time_rate: number };
  customers: CustomerBehaviour[];
  rows: Instalment[];
}

type Tab = "delay" | "customers" | "patterns";

const RATING_TONE: Record<string, BadgeTone> = { A: "success", B: "info", C: "warning", D: "danger" };
const RATING_TEXT: Record<string, string> = { A: "Always on time", B: "Minor delays", C: "Risky", D: "Defaulter" };

/** Report → Portfolio & Risk → Repayment Behaviour (Documents: ⏱️ REPAYMENT BEHAVIOR REPORT — DPD, average behaviour, rating, pattern). */
export default function BehaviourPage() {
  const [tab, setTab] = useState<Tab>("delay");
  const [filters, setFilters] = useState<ReportFilters>({});
  const [filtering, setFiltering] = useState(false);
  const { data, isLoading } = useApi<Behaviour>("reports/behaviour", cleanQuery(filters));

  return (
    <>
      <PageHeader crumbs={["Report", "Repayment Behaviour"]} />

      <Card title="Days Past Due (DPD)" actions={<><SearchButton onClick={() => setFiltering(true)} /><PrintButton /></>}>
        {isLoading || !data ? (
          <Loading />
        ) : (
          <>
            <div className="row">
              <Stat tone="primary" label="Instalments Due" value={data.summary.instalments} />
              <Stat tone="warning" label="Average Delay (days)" value={data.summary.avg_delay_days} />
              <Stat tone="success" label="On-time Payments" value={`${data.summary.on_time_rate}%`} />
              <Stat tone="danger" label="Defaulters (Rating D)" value={data.ratings.D ?? 0} />
            </div>
            <div className="row">
              <div className="col-lg-7">
                <ReportBarChart data={data.buckets.map((bucket) => ({ label: `${bucket.bucket} (${bucket.label})`, instalments: bucket.instalments }))} xKey="label" series={[{ key: "instalments", label: "Instalments" }]} format={(value) => String(value)} />
              </div>
              <div className="col-lg-5">
                <div className="table-responsive">
                  <table className="table table-hover table-custom mf-table">
                    <thead className="thead-info">
                      <tr><th>Days Delayed</th><th>Bucket</th><th>Instalments</th><th>Amount</th><th>Share</th></tr>
                    </thead>
                    <tbody>
                      {data.buckets.map((bucket) => (
                        <tr key={bucket.bucket}><td>{bucket.bucket}</td><td>{bucket.label}</td><td>{bucket.instalments}</td><td>{money(bucket.amount)}</td><td>{bucket.share}%</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </Card>

      <ReportTabs tabs={[["delay", "Days Delay Analysis"], ["customers", "Customer Payment Behaviour"], ["patterns", "Behaviour Pattern"]]} value={tab} onChange={setTab} />

      {data && tab === "delay" && (
        <Card
          title="Days Delay Analysis"
          actions={<CsvButton filename="days-delay" header={["Customer", "Loan", "Branch", "Due Date", "Paid Date", "Delay Days", "Bucket"]} rows={data.rows.map((row) => [row.customer, row.loan_number, row.branch, row.due_date, row.paid_date, row.delay_days, `${row.bucket} ${row.bucket_label}`])} />}
        >
          <DataTable
            rows={data.rows}
            rowKey={(row) => row.id}
            columns={[
              { key: "customer", header: "Customer" },
              { key: "loan_number", header: "Loan" },
              { key: "branch", header: "Branch" },
              { key: "due_date", header: "Due Date" },
              { key: "paid_date", header: "Paid Date", render: (row) => row.paid_date ?? <Badge tone="danger">NOT PAID</Badge> },
              { key: "amount", header: "Instalment", render: (row) => money(row.amount) },
              { key: "delay_days", header: "Delay Days" },
              { key: "bucket", header: "Bucket", value: (row) => row.bucket, render: (row) => `${row.bucket} — ${row.bucket_label}` },
            ]}
          />
        </Card>
      )}

      {data && tab === "customers" && (
        <Card
          title="Average Customer Payment Behaviour"
          actions={<CsvButton filename="customer-behaviour" header={["Customer", "Branch", "Total Loans", "Avg Delay Days", "On-time %", "Late %", "Default History", "Rating", "Pattern"]} rows={data.customers.map((row) => [row.customer, row.branch, row.total_loans, row.avg_delay_days, row.on_time_rate, row.late_rate, row.default_history, row.rating, row.pattern])} />}
        >
          <p className="text-muted">
            {Object.entries(RATING_TEXT).map(([rating, text]) => (
              <span key={rating} className="mr-3"><Badge tone={RATING_TONE[rating]}>{rating}</Badge> {text}: <b>{data.ratings[rating] ?? 0}</b></span>
            ))}
          </p>
          <DataTable
            rows={data.customers}
            rowKey={(row) => row.customer_id}
            columns={[
              { key: "customer", header: "Customer" },
              { key: "phone", header: "Phone Number" },
              { key: "branch", header: "Branch" },
              { key: "total_loans", header: "Total Loans" },
              { key: "avg_delay_days", header: "Avg Delay Days" },
              { key: "on_time_rate", header: "On-time Payments", render: (row) => `${row.on_time_rate}%` },
              { key: "late_rate", header: "Late Payments", render: (row) => `${row.late_rate}%` },
              { key: "default_history", header: "Default History" },
              { key: "rating", header: "Rating", render: (row) => <Badge tone={RATING_TONE[row.rating]}>{row.rating}</Badge> },
              { key: "pattern", header: "Pattern" },
            ]}
          />
        </Card>
      )}

      {data && tab === "patterns" && (
        <Card title="Behaviour Pattern">
          <ReportBarChart data={data.patterns} xKey="pattern" series={[{ key: "customers", label: "Customers" }]} format={(value) => String(value)} />
          <DataTable searchable={false} rows={data.patterns} rowKey={(row) => row.pattern} columns={[{ key: "pattern", header: "Pattern" }, { key: "customers", header: "Customers" }]} />
        </Card>
      )}

      <FilterModal open={filtering} onClose={() => setFiltering(false)} title="Filter Repayment Behaviour (due date)" datesOptional onApply={setFilters} />
    </>
  );
}
