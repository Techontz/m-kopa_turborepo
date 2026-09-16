"use client";

import { Fragment } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ReportFrame, SERIES, short, styles, SummaryTiles, useDefaultFilter, useFinancialReport } from "@/components/financial-reports/ReportShell";
import { money } from "@/lib/format";

interface Line {
  key: string;
  code: string;
  label: string;
  amount: number;
  breakdown?: Array<{ label: string; amount: number }>;
}

interface ConsolidatedPnl {
  income: Line[];
  gross_income: number;
  reserve_amount: number;
  total_income: number;
  expenses: Line[];
  total_expenses: number;
  net_profit: number;
  insurance_income?: Line & { note?: string; legacy_income_amount?: number; reserve_amount?: number };
  months: Array<{ month: string; income: number; expenses: number; net_profit: number }>;
}

export default function ConsolidatedProfitLossPage() {
  const [filter, setFilter] = useDefaultFilter();
  const { data, isLoading, error } = useFinancialReport<ConsolidatedPnl>("profit-loss", filter);

  return (
    <ReportFrame title="Consolidated Profit & Loss" filter={filter} onFilter={setFilter} error={error} loading={isLoading}>
      {data && (
        <>
          <SummaryTiles
            items={[
              { label: "Total Income", value: data.total_income, tone: "in" },
              { label: "Total Expenses", value: data.total_expenses, tone: "out" },
              { label: "Net Profit", value: data.net_profit },
            ]}
          />

          {data.months.length > 0 && (
            <div className={styles.chart}>
              <ResponsiveContainer>
                <BarChart data={data.months} margin={{ top: 10, right: 10, bottom: 0, left: 0 }} barGap={2}>
                  <CartesianGrid stroke="#eee" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#777" }} tickLine={false} axisLine={{ stroke: "#ddd" }} />
                  <YAxis tickFormatter={short} tick={{ fontSize: 11, fill: "#777" }} tickLine={false} axisLine={false} width={60} />
                  <Tooltip formatter={(value) => money(Number(value))} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                  <Legend />
                  <Bar dataKey="income" name="Income" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="expenses" name="Expenses" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="net_profit" name="Net Profit" fill={SERIES[2]} radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="table-responsive">
            <table className={`table table-hover table-custom ${styles.statement}`}>
              <thead className="thead-info">
                <tr>
                  <th>CODE</th>
                  <th>DESCRIPTION</th>
                  <th>AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                <tr className={styles.group}>
                  <td colSpan={3}>INCOME</td>
                </tr>
                {data.income.map((line) => (
                  <tr key={line.key}>
                    <td>{line.code}</td>
                    <td className={styles.indent}>{line.label}</td>
                    <td>{money(line.amount)}</td>
                  </tr>
                ))}
                <tr>
                  <td />
                  <td className={styles.indent}>LESS: INTEREST RESERVE (CUT FROM INTEREST, NOT INCOME)</td>
                  <td>({money(data.reserve_amount)})</td>
                </tr>
                <tr className={styles.total}>
                  <td />
                  <td className={styles.in}>TOTAL INCOME</td>
                  <td className={styles.in}>{money(data.total_income)}</td>
                </tr>
                <tr className={styles.group}>
                  <td colSpan={3}>EXPENSES</td>
                </tr>
                {data.expenses.map((line) => (
                  <Fragment key={line.key}>
                    <tr>
                      <td>{line.code}</td>
                      <td className={styles.indent}>{line.label}</td>
                      <td>{money(line.amount)}</td>
                    </tr>
                    {(line.breakdown ?? []).map((item) => (
                      <tr key={`${line.key}-${item.label}`}>
                        <td />
                        <td className={styles.indent} style={{ paddingLeft: 56 }}>
                          {item.label}
                        </td>
                        <td>{money(item.amount)}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
                <tr className={styles.total}>
                  <td />
                  <td className={styles.out}>TOTAL EXPENSES</td>
                  <td className={styles.out}>{money(data.total_expenses)}</td>
                </tr>
                <tr className={styles.total}>
                  <td />
                  <td>NET PROFIT</td>
                  <td className={data.net_profit < 0 ? styles.out : undefined}>{money(data.net_profit)}</td>
                </tr>
                {data.insurance_income && (
                  <tr>
                    <td>{data.insurance_income.code}</td>
                    <td className={styles.indent}>
                      {data.insurance_income.label} <small className="text-muted">({data.insurance_income.note ?? "Not distributable: closed to INSURANCE RESERVE at month end."})</small>
                      {data.insurance_income.legacy_income_amount !== undefined && (
                        <small className="d-block text-muted">
                          Legacy insurance income {money(data.insurance_income.legacy_income_amount)} · Collected to insurance reserve {money(data.insurance_income.reserve_amount ?? 0)}
                        </small>
                      )}
                    </td>
                    <td>{money(data.insurance_income.amount)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className={styles.note}>Ledger movements of income and expense accounts in the period, excluding month-end closing entries.</p>
        </>
      )}
    </ReportFrame>
  );
}
