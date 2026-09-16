"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ReportFrame, SERIES, short, styles, SummaryTiles, useDefaultFilter, useFinancialReport } from "@/components/financial-reports/ReportShell";
import { DataTable } from "@/components/ui/DataTable";
import { money } from "@/lib/format";

interface PnlFigures {
  interest_income: number;
  reserve_amount: number;
  fee_income: number;
  penalty_income: number;
  recovery_income: number;
  salary_advance_income: number;
  total_income: number;
  expenses: number;
  gross_profit: number;
  loss_brought_forward: number;
  net_profit: number;
  loss_carried_forward: number;
  hq_hold_amount: number;
  distributable_profit: number;
}

interface BranchPnl {
  rows: Array<PnlFigures & { branch_id: string; branch: string }>;
  totals: PnlFigures;
}

const signed = (value: number) => <span className={value < 0 ? styles.out : undefined}>{money(value)}</span>;

const COLUMNS: Array<[keyof PnlFigures, string, boolean?]> = [
  ["interest_income", "+ Interest"],
  ["fee_income", "+ Fees"],
  ["penalty_income", "+ Penalties"],
  ["salary_advance_income", "+ Salary advance income"],
  ["recovery_income", "+ Recoveries"],
  ["total_income", "= Total Income", true],
  ["expenses", "- Expenses"],
  ["gross_profit", "= Gross Profit", true],
  ["loss_brought_forward", "- Loss Carry Forward"],
  ["net_profit", "= Net Profit", true],
  ["hq_hold_amount", "HQ 2% Hold"],
  ["distributable_profit", "Distributable"],
];

export default function BranchProfitLossPage() {
  const [filter, setFilter] = useDefaultFilter();
  const { data, isLoading, error } = useFinancialReport<BranchPnl>("branch-pnl", filter);

  return (
    <ReportFrame title="Branch Profit & Loss" filter={filter} onFilter={setFilter} error={error} loading={isLoading}>
      {data && (
        <>
          <SummaryTiles
            items={[
              { label: "Total Income", value: data.totals.total_income ?? 0, tone: "in" },
              { label: "Expenses", value: data.totals.expenses ?? 0, tone: "out" },
              { label: "Gross Profit", value: data.totals.gross_profit ?? 0 },
              { label: "Net Profit", value: data.totals.net_profit ?? 0 },
              { label: "HQ 2% Hold", value: data.totals.hq_hold_amount ?? 0 },
            ]}
          />

          <div className={styles.chart}>
            <ResponsiveContainer>
              <BarChart data={data.rows} margin={{ top: 10, right: 10, bottom: 0, left: 0 }} barGap={2}>
                <CartesianGrid stroke="#eee" vertical={false} />
                <XAxis dataKey="branch" tick={{ fontSize: 11, fill: "#777" }} tickLine={false} axisLine={{ stroke: "#ddd" }} />
                <YAxis tickFormatter={short} tick={{ fontSize: 11, fill: "#777" }} tickLine={false} axisLine={false} width={60} />
                <Tooltip formatter={(value) => money(Number(value))} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                <Legend />
                <Bar dataKey="total_income" name="Total Income" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="expenses" name="Expenses" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="net_profit" name="Net Profit" fill={SERIES[2]} radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <DataTable
            rows={data.rows}
            rowKey={(row) => row.branch_id}
            pageSize={50}
            columns={[
              { key: "branch", header: "Branch Name" },
              ...COLUMNS.map(([key, header, strong]) => ({
                key,
                header,
                value: (row: BranchPnl["rows"][number]) => row[key],
                render: (row: BranchPnl["rows"][number]) => (strong ? <strong>{signed(row[key])}</strong> : signed(row[key])),
              })),
            ]}
            footer={
              <tr className={styles.total}>
                <td>TOTAL</td>
                {COLUMNS.map(([key]) => (
                  <td key={key}>{signed(data.totals[key] ?? 0)}</td>
                ))}
              </tr>
            }
          />
          <p className={styles.note}>
            Interest is shown after the Reserve cut ({money(data.totals.reserve_amount ?? 0)}). Loss carry forward is the loss carried out of the last month-end close before the start date. Month-end
            closing entries are excluded.
          </p>
        </>
      )}
    </ReportFrame>
  );
}
