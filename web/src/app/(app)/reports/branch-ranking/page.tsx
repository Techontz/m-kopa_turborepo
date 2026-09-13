"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ReportFrame, SERIES, short, styles, useDefaultFilter, useFinancialReport } from "@/components/financial-reports/ReportShell";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { money, percent } from "@/lib/format";

interface RankingRow {
  rank: number;
  branch_id: string;
  branch: string;
  total_income: number;
  expenses: number;
  gross_profit: number;
  loss_brought_forward: number;
  net_profit: number;
  profit_expense_ratio: number | null;
  expense_income_percent: number | null;
  loans_issued: number;
  amount_issued: number;
  cost_per_loan: number | null;
  staff: number;
  revenue_per_staff: number | null;
  default_rate: number;
  performance: string;
}

const TONES: Record<string, BadgeTone> = { BEST: "success", WORST: "danger", LOSS: "warning", PROFIT: "info", "ONLY BRANCH": "default" };
const orDash = (value: number | null, format: (value: number) => string = money) => (value === null ? "-" : format(value));

export default function BranchRankingPage() {
  const [filter, setFilter] = useDefaultFilter();
  const { data, isLoading, error } = useFinancialReport<RankingRow[]>("branch-ranking", filter);

  return (
    <ReportFrame title="Branch Ranking" filter={filter} onFilter={setFilter} error={error} loading={isLoading}>
      {data && (
        <>
          <div className={styles.chartTitle}>Net profit by branch (best to worst)</div>
          <div className={styles.chart}>
            <ResponsiveContainer>
              <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 10 }}>
                <CartesianGrid stroke="#eee" horizontal={false} />
                <XAxis type="number" tickFormatter={short} tick={{ fontSize: 11, fill: "#777" }} tickLine={false} axisLine={{ stroke: "#ddd" }} />
                <YAxis type="category" dataKey="branch" tick={{ fontSize: 11, fill: "#777" }} tickLine={false} axisLine={false} width={110} />
                <Tooltip formatter={(value) => money(Number(value))} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                <Bar dataKey="net_profit" name="Net Profit" fill={SERIES[0]} radius={[0, 4, 4, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <DataTable
            rows={data}
            rowKey={(row) => row.branch_id}
            pageSize={50}
            columns={[
              { key: "rank", header: "Rank", render: (row) => `${row.rank}.` },
              { key: "branch", header: "Branch Name" },
              { key: "performance", header: "Performance", render: (row) => <Badge tone={TONES[row.performance] ?? "default"}>{row.performance}</Badge> },
              { key: "total_income", header: "Total Income", render: (row) => money(row.total_income) },
              { key: "expenses", header: "Expenses", render: (row) => money(row.expenses) },
              { key: "net_profit", header: "Net Profit", render: (row) => <strong className={row.net_profit < 0 ? styles.out : undefined}>{money(row.net_profit)}</strong> },
              { key: "profit_expense_ratio", header: "Profit vs Expense", value: (row) => row.profit_expense_ratio ?? 0, render: (row) => orDash(row.profit_expense_ratio, (value) => `${value}x`) },
              { key: "loans_issued", header: "Loans Issued" },
              { key: "cost_per_loan", header: "Cost per Loan", value: (row) => row.cost_per_loan ?? 0, render: (row) => orDash(row.cost_per_loan) },
              { key: "staff", header: "Staff" },
              { key: "revenue_per_staff", header: "Revenue per Staff", value: (row) => row.revenue_per_staff ?? 0, render: (row) => orDash(row.revenue_per_staff) },
              { key: "expense_income_percent", header: "Expense / Income", value: (row) => row.expense_income_percent ?? 0, render: (row) => orDash(row.expense_income_percent, percent) },
              { key: "default_rate", header: "Default Rate", render: (row) => percent(row.default_rate) },
            ]}
          />
          <p className={styles.note}>
            Ranked by net profit (after loss carry forward), then by profit vs expense ratio. Cost per loan = expenses / loans issued in the period; revenue per staff = total income / active staff;
            default rate = defaulted or written-off loans / loans disbursed.
          </p>
        </>
      )}
    </ReportFrame>
  );
}
