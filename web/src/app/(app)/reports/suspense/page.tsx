"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ReportFrame, SERIES, short, styles, SummaryTiles, useDefaultFilter, useFinancialReport } from "@/components/financial-reports/ReportShell";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { money, todayIso } from "@/lib/format";

interface SuspenseRow {
  id: number;
  type: string;
  date: string;
  receipt_number: string | null;
  reference: string | null;
  channel: string;
  phone: string | null;
  branch: string;
  customer: string | null;
  amount: number;
  allocated: number;
  unallocated: number;
  status: string;
  status_badge: BadgeTone;
  reason: string | null;
  age_days: number;
  bucket: string;
}

interface SuspenseReport {
  as_of: string;
  rows: SuspenseRow[];
  deposits: Array<{ id: number; date: string; slip_number: string; branch: string; teller: string | null; amount: number; statement_amount: number | null; status: string; age_days: number; bucket: string }>;
  aging: Array<{ bucket: string; count: number; amount: number }>;
  unmatched_total: number;
  pending_allocation_total: number;
  deposits_total: number;
  open_total: number;
  ledger_balance: number;
  difference: number;
}

export default function SuspenseReportPage() {
  const [filter, setFilter] = useDefaultFilter(todayIso(), todayIso());
  const { data, isLoading, error } = useFinancialReport<SuspenseReport>("suspense", filter);

  return (
    <ReportFrame title="Suspense Report" filter={filter} onFilter={setFilter} dates="asOf" error={error} loading={isLoading}>
      {data && (
        <>
          <SummaryTiles
            items={[
              { label: "Unmatched Payments", value: data.unmatched_total },
              { label: "Pending Allocations", value: data.pending_allocation_total },
              { label: "Deposits Pending Reconciliation", value: data.deposits_total },
              { label: "Suspense A/C (Ledger)", value: data.ledger_balance },
              { label: "Difference", value: data.difference, tone: data.difference !== 0 ? "out" : undefined },
            ]}
          />

          <div className="row">
            <div className="col-lg-7">
              <div className={styles.chartTitle}>Aging (how long unresolved)</div>
              <div className={styles.chart}>
                <ResponsiveContainer>
                  <BarChart data={data.aging} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="#eee" vertical={false} />
                    <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "#777" }} tickLine={false} axisLine={{ stroke: "#ddd" }} />
                    <YAxis tickFormatter={short} tick={{ fontSize: 11, fill: "#777" }} tickLine={false} axisLine={false} width={60} />
                    <Tooltip formatter={(value) => money(Number(value))} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                    <Bar dataKey="amount" name="Unallocated" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="col-lg-5">
              <table className="table table-custom">
                <thead className="thead-info">
                  <tr>
                    <th>Aging</th>
                    <th>Count</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.aging.map((row) => (
                    <tr key={row.bucket}>
                      <td>{row.bucket}</td>
                      <td>{row.count}</td>
                      <td>{money(row.amount)}</td>
                    </tr>
                  ))}
                  <tr className={styles.total}>
                    <td>TOTAL</td>
                    <td>{data.rows.length}</td>
                    <td>{money(data.open_total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.subhead}>Unmatched payments &amp; pending allocations</div>
          <DataTable
            rows={data.rows}
            rowKey={(row) => row.id}
            pageSize={25}
            columns={[
              { key: "date", header: "Date" },
              { key: "type", header: "Type", render: (row) => <Badge tone={row.type === "UNMATCHED" ? "danger" : "warning"}>{row.type}</Badge> },
              { key: "reference", header: "Reference / Receipt", value: (row) => `${row.reference ?? ""} ${row.receipt_number ?? ""}`, render: (row) => row.reference ?? row.receipt_number ?? "-" },
              { key: "channel", header: "Channel" },
              { key: "phone", header: "Phone", render: (row) => row.phone ?? "-" },
              { key: "branch", header: "Branch" },
              { key: "customer", header: "Customer", render: (row) => row.customer ?? "-" },
              { key: "amount", header: "Amount", render: (row) => money(row.amount) },
              { key: "allocated", header: "Allocated", render: (row) => money(row.allocated) },
              { key: "unallocated", header: "Unallocated", render: (row) => <strong>{money(row.unallocated)}</strong> },
              { key: "status", header: "Status", render: (row) => <Badge tone={row.status_badge}>{row.status}</Badge> },
              { key: "age_days", header: "Age (days)", render: (row) => <span className={row.age_days > 30 ? styles.out : undefined}>{row.age_days}</span> },
              { key: "reason", header: "Reason", render: (row) => row.reason ?? "-" },
            ]}
            footer={
              <tr className={styles.total}>
                <td colSpan={9}>TOTAL</td>
                <td>{money(data.open_total)}</td>
                <td colSpan={3} />
              </tr>
            }
          />

          <div className={styles.subhead}>Bank deposits pending reconciliation</div>
          <DataTable
            rows={data.deposits}
            rowKey={(row) => row.id}
            columns={[
              { key: "date", header: "Deposit Date" },
              { key: "slip_number", header: "Slip Number" },
              { key: "branch", header: "Branch" },
              { key: "teller", header: "Teller", render: (row) => row.teller ?? "-" },
              { key: "amount", header: "Amount", render: (row) => money(row.amount) },
              { key: "statement_amount", header: "Statement Amount", render: (row) => (row.statement_amount === null ? "-" : money(row.statement_amount)) },
              { key: "status", header: "Status", render: (row) => <Badge tone={row.status === "MISMATCH" ? "danger" : "warning"}>{row.status}</Badge> },
              { key: "age_days", header: "Age (days)" },
            ]}
          />
        </>
      )}
    </ReportFrame>
  );
}
