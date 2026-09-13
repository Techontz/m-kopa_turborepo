"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ReportFrame, SERIES, short, styles, SummaryTiles, useDefaultFilter, useFinancialReport, yearStartIso } from "@/components/financial-reports/ReportShell";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { money, todayIso } from "@/lib/format";

interface LossRow {
  id: number;
  month: string;
  branch_id: string;
  branch: string;
  gross_profit: number;
  previous_loss: number;
  loss_offset: number;
  loss_added: number;
  current_adjustment: number;
  remaining_loss: number;
  net_profit: number;
  loss_streak: number;
  commission_eligible: boolean;
  blocked_reason: string | null;
  status: string;
}

interface LossReport {
  rows: LossRow[];
  branches: Array<{ branch_id: string; branch: string; latest_month: string; loss_offset: number; loss_added: number; remaining_loss: number; loss_streak: number; commission_eligible: boolean }>;
  branches_in_loss: number;
  total_remaining_loss: number;
}

const eligibility = (eligible: boolean, reason?: string | null) => (eligible ? <Badge tone="success">ELIGIBLE</Badge> : <Badge tone="danger">{reason ? `BLOCKED: ${reason}` : "BLOCKED"}</Badge>);

export default function LossCarryForwardPage() {
  const [filter, setFilter] = useDefaultFilter(yearStartIso(), todayIso());
  const { data, isLoading, error } = useFinancialReport<LossReport>("loss-carry-forward", filter);

  return (
    <ReportFrame title="Loss Carry Forward" filter={filter} onFilter={setFilter} error={error} loading={isLoading}>
      {data && (
        <>
          <SummaryTiles
            items={[
              { label: "Branches with Losses", value: String(data.branches_in_loss) },
              { label: "Remaining Loss (all branches)", value: data.total_remaining_loss, tone: data.total_remaining_loss > 0 ? "out" : undefined },
            ]}
          />

          {data.branches.length > 0 && (
            <>
              <div className={styles.chartTitle}>Remaining loss per branch</div>
              <div className={styles.chart}>
                <ResponsiveContainer>
                  <BarChart data={data.branches} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="#eee" vertical={false} />
                    <XAxis dataKey="branch" tick={{ fontSize: 11, fill: "#777" }} tickLine={false} axisLine={{ stroke: "#ddd" }} />
                    <YAxis tickFormatter={short} tick={{ fontSize: 11, fill: "#777" }} tickLine={false} axisLine={false} width={60} />
                    <Tooltip formatter={(value) => money(Number(value))} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                    <Bar dataKey="remaining_loss" name="Remaining Loss" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          <div className={styles.subhead}>Per branch (latest month)</div>
          <DataTable
            rows={data.branches}
            rowKey={(row) => row.branch_id}
            searchable={false}
            pageSize={100}
            columns={[
              { key: "branch", header: "Branch Name" },
              { key: "latest_month", header: "Latest Month" },
              { key: "loss_added", header: "Loss Added", render: (row) => money(row.loss_added) },
              { key: "loss_offset", header: "Loss Recovered", render: (row) => money(row.loss_offset) },
              { key: "remaining_loss", header: "Remaining Loss", render: (row) => <strong className={row.remaining_loss > 0 ? styles.out : undefined}>{money(row.remaining_loss)}</strong> },
              { key: "loss_streak", header: "Months in Loss Streak" },
              { key: "commission_eligible", header: "Commission", render: (row) => eligibility(row.commission_eligible) },
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
              { key: "previous_loss", header: "Previous Loss", render: (row) => money(row.previous_loss) },
              { key: "gross_profit", header: "Month Profit / Loss", render: (row) => <span className={row.gross_profit < 0 ? styles.out : undefined}>{money(row.gross_profit)}</span> },
              {
                key: "current_adjustment",
                header: "Current Adjustment",
                render: (row) => (row.loss_offset > 0 ? `- ${money(row.loss_offset)} offset` : row.loss_added > 0 ? `+ ${money(row.loss_added)} added` : "0"),
              },
              { key: "remaining_loss", header: "Remaining Loss", render: (row) => <strong>{money(row.remaining_loss)}</strong> },
              { key: "net_profit", header: "Net Profit", render: (row) => money(row.net_profit) },
              { key: "loss_streak", header: "Loss Streak" },
              { key: "commission_eligible", header: "Commission", render: (row) => eligibility(row.commission_eligible, row.blocked_reason) },
              { key: "status", header: "Status", render: (row) => <Badge tone={row.status === "CLOSED" ? "success" : "warning"}>{row.status}</Badge> },
            ]}
          />
        </>
      )}
    </ReportFrame>
  );
}
