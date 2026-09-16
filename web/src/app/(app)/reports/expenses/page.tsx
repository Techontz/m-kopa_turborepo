"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ReportFrame, SERIES, short, styles, SummaryTiles, useDefaultFilter, useFinancialReport } from "@/components/financial-reports/ReportShell";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { money, percent } from "@/lib/format";

interface ExpenseRow {
  id: number;
  date: string;
  expense_type: string | null;
  scope: string;
  tag: string;
  branch: string | null;
  paid_from: string | null;
  amount: number;
  description: string | null;
  requested_by: string | null;
  approved_by: string | null;
  journal_reference: string | null;
  mis_tagged: boolean;
  flags: string[];
  reversed: boolean;
  reversed_at: string | null;
  reversal_reason: string | null;
}

interface ExpenseReport {
  rows: ExpenseRow[];
  by_category: Array<{ label: string; count: number; amount: number }>;
  by_branch: Array<{ label: string; branch_tagged: number; hq_paid_branch_tagged: number; hq: number; amount: number }>;
  months: Array<{ month: string; branch: number; hq: number; hq_change_percent: number | null }>;
  total: number;
  branch_total: number;
  hq_total: number;
  hq_paid_branch_tagged_total: number;
  mis_tagged_count: number;
  mis_tagged_total: number;
  reversed_count: number;
  reversed_total: number;
}

export default function ExpenseReportPage() {
  const [filter, setFilter] = useDefaultFilter();
  const { data, isLoading, error } = useFinancialReport<ExpenseReport>("expenses", filter);

  return (
    <ReportFrame title="Expense Report" filter={filter} onFilter={setFilter} error={error} loading={isLoading}>
      {data && (
        <>
          <SummaryTiles
            items={[
              { label: "All Expenses", value: data.total },
              { label: "Branch Tagged", value: data.branch_total },
              { label: "HQ Expenses", value: data.hq_total },
              { label: "HQ-Paid, Branch-Tagged", value: data.hq_paid_branch_tagged_total },
              { label: `Mis-tagged (${data.mis_tagged_count})`, value: data.mis_tagged_total, tone: data.mis_tagged_count ? "out" : undefined },
              { label: `Reversed — not counted (${data.reversed_count})`, value: data.reversed_total },
            ]}
          />

          <div className="row">
            <div className="col-lg-7">
              <div className={styles.chartTitle}>Month to month: branch vs HQ expenses</div>
              <div className={styles.chart}>
                <ResponsiveContainer>
                  <BarChart data={data.months} margin={{ top: 10, right: 10, bottom: 0, left: 0 }} barGap={2}>
                    <CartesianGrid stroke="#eee" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#777" }} tickLine={false} axisLine={{ stroke: "#ddd" }} />
                    <YAxis tickFormatter={short} tick={{ fontSize: 11, fill: "#777" }} tickLine={false} axisLine={false} width={60} />
                    <Tooltip formatter={(value) => money(Number(value))} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                    <Legend />
                    <Bar dataKey="branch" name="Branch" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="hq" name="HQ" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="col-lg-5">
              <div className={styles.chartTitle}>HQ expenses month to month</div>
              <table className="table table-custom">
                <thead className="thead-info">
                  <tr>
                    <th>Month</th>
                    <th>Branch</th>
                    <th>HQ</th>
                    <th>HQ Change</th>
                  </tr>
                </thead>
                <tbody>
                  {data.months.map((month) => (
                    <tr key={month.month}>
                      <td>{month.month}</td>
                      <td>{money(month.branch)}</td>
                      <td>{money(month.hq)}</td>
                      <td>{month.hq_change_percent === null ? "-" : <span className={month.hq_change_percent > 0 ? styles.out : styles.in}>{percent(month.hq_change_percent)}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.subhead}>All expenses</div>
          <DataTable
            rows={data.rows}
            rowKey={(row) => row.id}
            pageSize={25}
            columns={[
              { key: "sn", header: "S/No.", sortable: false, render: (_row, index) => `${index + 1}.` },
              { key: "date", header: "Date" },
              { key: "expense_type", header: "Expense Category" },
              { key: "tag", header: "Tag", render: (row) => <Badge tone={row.tag === "BRANCH" ? "info" : row.tag === "HQ" ? "primary" : "warning"}>{row.tag}</Badge> },
              { key: "branch", header: "Branch", render: (row) => row.branch ?? "HQ" },
              { key: "paid_from", header: "Paid From", render: (row) => row.paid_from ?? "-" },
              { key: "amount", header: "Amount", render: (row) => (row.reversed ? <s>{money(row.amount)}</s> : money(row.amount)) },
              { key: "requested_by", header: "Requested By", render: (row) => row.requested_by ?? "-" },
              { key: "approved_by", header: "Approved By", render: (row) => row.approved_by ?? "-" },
              {
                key: "flags",
                header: "Tag Check",
                value: (row) => row.flags.join(" "),
                render: (row) =>
                  row.reversed ? (
                    <>
                      <Badge tone="default">REVERSED</Badge>
                      {row.reversal_reason && <div className={styles.note}>{row.reversal_reason}</div>}
                    </>
                  ) : row.mis_tagged ? (
                    <>
                      <Badge tone="danger">MIS-TAGGED</Badge>
                      {row.flags.map((flag) => (
                        <div key={flag} className={styles.note}>
                          {flag}
                        </div>
                      ))}
                    </>
                  ) : (
                    <Badge tone="success">OK</Badge>
                  ),
              },
            ]}
            footer={
              <tr className={styles.total}>
                <td colSpan={6}>TOTAL (excluding reversed)</td>
                <td>{money(data.total)}</td>
                <td colSpan={3} />
              </tr>
            }
          />

          <div className="row">
            <div className="col-lg-5">
              <div className={styles.subhead}>By category</div>
              <DataTable
                rows={data.by_category}
                rowKey={(row) => row.label}
                searchable={false}
                pageSize={100}
                columns={[
                  { key: "label", header: "Category" },
                  { key: "count", header: "Count" },
                  { key: "amount", header: "Amount", render: (row) => money(row.amount) },
                ]}
              />
            </div>
            <div className="col-lg-7">
              <div className={styles.subhead}>By branch</div>
              <DataTable
                rows={data.by_branch}
                rowKey={(row) => row.label}
                searchable={false}
                pageSize={100}
                columns={[
                  { key: "label", header: "Branch" },
                  { key: "branch_tagged", header: "Branch Tagged", render: (row) => money(row.branch_tagged) },
                  { key: "hq_paid_branch_tagged", header: "HQ-Paid, Branch-Tagged", render: (row) => money(row.hq_paid_branch_tagged) },
                  { key: "hq", header: "HQ", render: (row) => money(row.hq) },
                  { key: "amount", header: "Total", render: (row) => money(row.amount) },
                ]}
              />
            </div>
          </div>
        </>
      )}
    </ReportFrame>
  );
}
