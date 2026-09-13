"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ReportFrame, SERIES, short, styles, SummaryTiles, useDefaultFilter, useFinancialReport } from "@/components/financial-reports/ReportShell";
import { DataTable } from "@/components/ui/DataTable";
import { money, todayIso } from "@/lib/format";

interface PositionRow {
  opening: number;
  cash_in: number;
  cash_out: number;
  net: number;
  closing: number;
}

interface DailyPosition extends PositionRow {
  days: Array<PositionRow & { date: string }>;
  branches: Array<PositionRow & { branch_id: string; branch: string }>;
}

const netCell = (value: number) => <span className={value < 0 ? styles.out : styles.in}>{money(value)}</span>;

export default function DailyPositionPage() {
  const [filter, setFilter] = useDefaultFilter(todayIso(), todayIso());
  const { data, isLoading, error } = useFinancialReport<DailyPosition>("daily-position", filter);

  return (
    <ReportFrame title="Daily Position" filter={filter} onFilter={setFilter} error={error} loading={isLoading}>
      {data && (
        <>
          <SummaryTiles
            items={[
              { label: "Opening", value: data.opening },
              { label: "Cash In", value: data.cash_in, tone: "in" },
              { label: "Cash Out", value: data.cash_out, tone: "out" },
              { label: "Net Position", value: data.net },
              { label: "Closing", value: data.closing },
            ]}
          />

          <div className={styles.subhead}>Per branch</div>
          <DataTable
            rows={data.branches}
            rowKey={(row) => row.branch_id}
            searchable={false}
            pageSize={100}
            columns={[
              { key: "branch", header: "Branch" },
              { key: "opening", header: "Opening", render: (row) => money(row.opening) },
              { key: "cash_in", header: "Cash In", render: (row) => money(row.cash_in) },
              { key: "cash_out", header: "Cash Out", render: (row) => money(row.cash_out) },
              { key: "net", header: "Net Position", render: (row) => netCell(row.net) },
              { key: "closing", header: "Closing", render: (row) => money(row.closing) },
            ]}
            footer={
              <tr className={styles.total}>
                <td>TOTAL</td>
                <td>{money(data.opening)}</td>
                <td>{money(data.cash_in)}</td>
                <td>{money(data.cash_out)}</td>
                <td>{netCell(data.net)}</td>
                <td>{money(data.closing)}</td>
              </tr>
            }
          />
          {filter.branch_id === "all" && <p className={styles.note}>Branch rows include transfers between HQ and branches; the total row is company-wide, where internal transfers cancel out.</p>}

          {data.days.length > 1 && (
            <>
              <div className={styles.subhead}>Per day</div>
              <div className={styles.chart}>
                <ResponsiveContainer>
                  <BarChart data={data.days} margin={{ top: 10, right: 10, bottom: 0, left: 0 }} barGap={2}>
                    <CartesianGrid stroke="#eee" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#777" }} tickLine={false} axisLine={{ stroke: "#ddd" }} />
                    <YAxis tickFormatter={short} tick={{ fontSize: 11, fill: "#777" }} tickLine={false} axisLine={false} width={60} />
                    <Tooltip formatter={(value) => money(Number(value))} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                    <Legend />
                    <Bar dataKey="cash_in" name="Cash In" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="cash_out" name="Cash Out" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <DataTable
                rows={data.days}
                rowKey={(row) => row.date}
                pageSize={31}
                columns={[
                  { key: "date", header: "Date" },
                  { key: "opening", header: "Opening", render: (row) => money(row.opening) },
                  { key: "cash_in", header: "Cash In", render: (row) => money(row.cash_in) },
                  { key: "cash_out", header: "Cash Out", render: (row) => money(row.cash_out) },
                  { key: "net", header: "Net Position", render: (row) => netCell(row.net) },
                  { key: "closing", header: "Closing", render: (row) => money(row.closing) },
                ]}
              />
            </>
          )}
        </>
      )}
    </ReportFrame>
  );
}
