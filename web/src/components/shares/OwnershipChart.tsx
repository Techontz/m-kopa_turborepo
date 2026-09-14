"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { SERIES, styles } from "@/components/financial-reports/ReportShell";
import { money } from "@/lib/format";

import { sharesLabel } from "./shares";
import type { RegisterRow } from "./types";

/** Ownership % per shareholder (one series, ranked), with shares and holding value in the tooltip. */
export function OwnershipChart({ rows }: { rows: RegisterRow[] }) {
  const data = [...rows].filter((row) => row.shares > 0).sort((a, b) => b.shares - a.shares);
  if (data.length === 0) {
    return null;
  }

  return (
    <>
      <div className={styles.chartTitle}>Ownership % by shareholder</div>
      <div className={styles.chart} style={{ height: Math.max(160, data.length * 44 + 40) }}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 10 }}>
            <CartesianGrid stroke="#eee" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 11, fill: "#777" }} tickLine={false} axisLine={{ stroke: "#ddd" }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#777" }} tickLine={false} axisLine={false} width={150} />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
              formatter={(value, _name, item) => {
                const row = item.payload as RegisterRow;
                return [`${Number(value)}% · ${sharesLabel(row.shares)} shares · ${money(row.holding_value)}`, "Ownership"];
              }}
            />
            <Bar dataKey="ownership_percent" name="Ownership %" fill={SERIES[0]} radius={[0, 4, 4, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
