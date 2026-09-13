"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ReportFrame, SERIES, short, styles, SummaryTiles, useDefaultFilter, useFinancialReport, yearStartIso } from "@/components/financial-reports/ReportShell";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { money, percent, todayIso } from "@/lib/format";

interface HoldRow {
  id: number;
  month: string;
  branch_id: string;
  branch: string;
  gross_profit: number;
  loss_brought_forward: number;
  net_profit: number;
  hq_hold_percent: number;
  hq_hold_amount: number;
  distributable_profit: number;
  status: "CLOSED" | "PROVISIONAL";
  accumulated: number;
}

interface HqHold {
  rows: HoldRow[];
  branches: Array<{ branch_id: string; branch: string; net_profit: number; held: number; provisional: number; accumulated: number }>;
  months: Array<{ month: string; held: number }>;
  total_held: number;
  total_provisional: number;
  total_accumulated: number;
}

export default function HqHoldPage() {
  const [filter, setFilter] = useDefaultFilter(yearStartIso(), todayIso());
  const { data, isLoading, error } = useFinancialReport<HqHold>("hq-hold", filter);

  return (
    <ReportFrame title="HQ 2% Hold" filter={filter} onFilter={setFilter} error={error} loading={isLoading}>
      {data && (
        <>
          <SummaryTiles
            items={[
              { label: "Held in Period (closed)", value: data.total_held },
              { label: "Provisional (open months)", value: data.total_provisional },
              { label: "Total HQ Reserve Accumulated", value: data.total_accumulated },
            ]}
          />

          {data.months.length > 0 && (
            <>
              <div className={styles.chartTitle}>2% held per month</div>
              <div className={styles.chart}>
                <ResponsiveContainer>
                  <BarChart data={data.months} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="#eee" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#777" }} tickLine={false} axisLine={{ stroke: "#ddd" }} />
                    <YAxis tickFormatter={short} tick={{ fontSize: 11, fill: "#777" }} tickLine={false} axisLine={false} width={60} />
                    <Tooltip formatter={(value) => money(Number(value))} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                    <Bar dataKey="held" name="2% Held" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          <div className={styles.subhead}>Per branch</div>
          <DataTable
            rows={data.branches}
            rowKey={(row) => row.branch_id}
            searchable={false}
            pageSize={100}
            columns={[
              { key: "branch", header: "Branch Name" },
              { key: "net_profit", header: "Profit (Net)", render: (row) => money(row.net_profit) },
              { key: "held", header: "2% Held", render: (row) => money(row.held) },
              { key: "provisional", header: "Provisional", render: (row) => money(row.provisional) },
              { key: "accumulated", header: "Accumulated Reserve", render: (row) => <strong>{money(row.accumulated)}</strong> },
            ]}
          />

          <div className={styles.subhead}>Per month</div>
          <DataTable
            rows={data.rows}
            rowKey={(row) => row.id}
            pageSize={25}
            columns={[
              { key: "month", header: "Month" },
              { key: "branch", header: "Branch Name" },
              { key: "gross_profit", header: "Gross Profit", render: (row) => money(row.gross_profit) },
              { key: "loss_brought_forward", header: "Loss B/F", render: (row) => money(row.loss_brought_forward) },
              { key: "net_profit", header: "Profit (Net)", render: (row) => <span className={row.net_profit < 0 ? styles.out : undefined}>{money(row.net_profit)}</span> },
              { key: "hq_hold_percent", header: "Rate", render: (row) => percent(row.hq_hold_percent) },
              { key: "hq_hold_amount", header: "2% Held", render: (row) => money(row.hq_hold_amount) },
              { key: "distributable_profit", header: "Distributable", render: (row) => money(row.distributable_profit) },
              { key: "accumulated", header: "Accumulated", render: (row) => money(row.accumulated) },
              { key: "status", header: "Status", render: (row) => <Badge tone={row.status === "CLOSED" ? "success" : "warning"}>{row.status}</Badge> },
            ]}
          />
          <p className={styles.note}>From the month-end results (Accounting → Month End). Provisional months are calculated but not yet closed and are not in the accumulated reserve.</p>
        </>
      )}
    </ReportFrame>
  );
}
