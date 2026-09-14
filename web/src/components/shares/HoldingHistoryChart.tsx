"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { SERIES, short, styles } from "@/components/financial-reports/ReportShell";
import { money } from "@/lib/format";

import { sharesLabel } from "./shares";

export interface ValuePoint {
  date: string;
  value: number;
  detail?: string;
}

/** A value over time that changes on event dates (drawn as steps), e.g. holding value or company share valuation. */
export function StepValueChart({ title, points }: { title: string; points: ValuePoint[] }) {
  if (points.length === 0) {
    return null;
  }

  return (
    <>
      <div className={styles.chartTitle}>{title}</div>
      <div className={styles.chart}>
        <ResponsiveContainer>
          <LineChart data={points} margin={{ top: 8, right: 20, bottom: 0, left: 10 }}>
            <CartesianGrid stroke="#eee" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#777" }} tickLine={false} axisLine={{ stroke: "#ddd" }} minTickGap={24} />
            <YAxis tickFormatter={short} tick={{ fontSize: 11, fill: "#777" }} tickLine={false} axisLine={false} width={60} />
            <Tooltip
              formatter={(value, _name, item) => {
                const point = item.payload as ValuePoint;
                return [`${money(Number(value))}${point.detail ? ` (${point.detail})` : ""}`, title];
              }}
            />
            <Line type="stepAfter" dataKey="value" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

export function holdingDetail(shares: number, shareValue: number): string {
  return `${sharesLabel(shares)} shares × ${money(shareValue)}`;
}
