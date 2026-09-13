"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ReportFrame, SERIES, short, styles, SummaryTiles, useDefaultFilter, useFinancialReport } from "@/components/financial-reports/ReportShell";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { money } from "@/lib/format";

interface CategoryRow {
  key: string;
  label: string;
  amount: number;
}

interface CashFlow {
  opening: number;
  inflows: CategoryRow[];
  outflows: CategoryRow[];
  total_inflow: number;
  total_outflow: number;
  net_movement: number;
  closing: number;
  cash_held: number;
  suspense_held: number;
  transactions: Array<{ id: number; date: string; reference: string; description: string; category: string; inflow: number; outflow: number; balance: number; branch: string; approved_by: string | null; is_reversal: boolean }>;
  daily: Array<{ date: string; inflow: number; outflow: number; balance: number }>;
}

export default function MasterCashFlowPage() {
  const [filter, setFilter] = useDefaultFilter();
  const { data, isLoading, error } = useFinancialReport<CashFlow>("cash-flow", filter);

  return (
    <ReportFrame title="Master Cash Flow" filter={filter} onFilter={setFilter} error={error} loading={isLoading}>
      {data && (
        <>
          <SummaryTiles
            items={[
              { label: "Opening Balance", value: data.opening },
              { label: "Total Inflows", value: data.total_inflow, tone: "in" },
              { label: "Total Outflows", value: data.total_outflow, tone: "out" },
              { label: "Net Movement", value: data.net_movement },
              { label: "Closing Balance", value: data.closing },
            ]}
          />

          <div className="row">
            <div className="col-lg-6">
              <div className={styles.chartTitle}>Daily inflows vs outflows</div>
              <div className={styles.chart}>
                <ResponsiveContainer>
                  <BarChart data={data.daily} margin={{ top: 10, right: 10, bottom: 0, left: 0 }} barGap={2}>
                    <CartesianGrid stroke="#eee" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#777" }} tickLine={false} axisLine={{ stroke: "#ddd" }} />
                    <YAxis tickFormatter={short} tick={{ fontSize: 11, fill: "#777" }} tickLine={false} axisLine={false} width={60} />
                    <Tooltip formatter={(value) => money(Number(value))} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                    <Legend />
                    <Bar dataKey="inflow" name="Inflow" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="outflow" name="Outflow" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="col-lg-6">
              <div className={styles.chartTitle}>Running balance</div>
              <div className={styles.chart}>
                <ResponsiveContainer>
                  <LineChart data={data.daily} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="#eee" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#777" }} tickLine={false} axisLine={{ stroke: "#ddd" }} />
                    <YAxis tickFormatter={short} tick={{ fontSize: 11, fill: "#777" }} tickLine={false} axisLine={false} width={60} />
                    <Tooltip formatter={(value) => money(Number(value))} />
                    <Line type="monotone" dataKey="balance" name="Balance" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="table-responsive">
            <table className={`table table-hover table-custom ${styles.statement}`}>
              <thead className="thead-info">
                <tr>
                  <th>DESCRIPTION</th>
                  <th>AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                <tr className={styles.total}>
                  <td>OPENING</td>
                  <td>{money(data.opening)}</td>
                </tr>
                <tr className={styles.group}>
                  <td colSpan={2}>INFLOWS (INGIZO)</td>
                </tr>
                {data.inflows.map((row) => (
                  <tr key={`in-${row.key}`}>
                    <td className={styles.indent}>{row.label.toUpperCase()}</td>
                    <td>{money(row.amount)}</td>
                  </tr>
                ))}
                <tr className={styles.total}>
                  <td className={styles.in}>TOTAL</td>
                  <td className={styles.in}>{money(data.total_inflow)}</td>
                </tr>
                <tr className={styles.group}>
                  <td colSpan={2}>OUTFLOWS (MATUMIZI)</td>
                </tr>
                {data.outflows.map((row) => (
                  <tr key={`out-${row.key}`}>
                    <td className={styles.indent}>{row.label.toUpperCase()}</td>
                    <td>{money(row.amount)}</td>
                  </tr>
                ))}
                <tr className={styles.total}>
                  <td className={styles.out}>TOTAL</td>
                  <td className={styles.out}>{money(data.total_outflow)}</td>
                </tr>
                <tr className={styles.total}>
                  <td>CLOSING</td>
                  <td>{money(data.closing)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {data.suspense_held !== 0 && (
            <p className={styles.note}>
              Cash held in accounts: {money(data.cash_held)} — of which {money(data.suspense_held)} is unallocated money in the Suspense account (not available cash).
            </p>
          )}

          <div className={styles.subhead}>Transactions</div>
          <DataTable
            rows={data.transactions}
            rowKey={(row) => row.id}
            pageSize={25}
            columns={[
              { key: "date", header: "Date" },
              { key: "reference", header: "Ref" },
              {
                key: "description",
                header: "Description",
                render: (row) => (
                  <>
                    {row.description} {row.is_reversal && <Badge tone="danger">REVERSAL</Badge>}
                    <div className={styles.note}>{row.category}</div>
                  </>
                ),
              },
              { key: "inflow", header: "Inflow", render: (row) => (row.inflow ? money(row.inflow) : "-") },
              { key: "outflow", header: "Outflow", render: (row) => (row.outflow ? money(row.outflow) : "-") },
              { key: "balance", header: "Balance", render: (row) => money(row.balance) },
              { key: "branch", header: "Branch" },
              { key: "approved_by", header: "Approved By", render: (row) => row.approved_by ?? "-" },
            ]}
            footer={
              <tr className={styles.total}>
                <td colSpan={3}>TOTAL</td>
                <td>{money(data.total_inflow)}</td>
                <td>{money(data.total_outflow)}</td>
                <td>{money(data.closing)}</td>
                <td colSpan={2} />
              </tr>
            }
          />
        </>
      )}
    </ReportFrame>
  );
}
