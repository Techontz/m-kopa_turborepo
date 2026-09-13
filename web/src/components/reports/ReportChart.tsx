"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { money } from "@/lib/format";

/** Fixed categorical order (validated reference palette): blue, orange. */
export const SERIES_COLORS = ["#2a78d6", "#eb6834"];

interface BarSeries {
  key: string;
  label: string;
}

interface ReportBarChartProps {
  data: object[] | undefined;
  xKey: string;
  series: BarSeries[];
  height?: number;
  /** Value formatter for axis ticks and tooltip. */
  format?: (value: number) => string;
}

const compact = (value: number) => (Math.abs(value) >= 1_000_000 ? `${Math.round(value / 100_000) / 10}M` : Math.abs(value) >= 1000 ? `${Math.round(value / 1000)}K` : String(value));

/**
 * Bar chart for the Portfolio & Risk reports: one value axis, thin rounded bars, recessive grid, hover tooltip,
 * legend only for two series (a single series is named by the card title). The data is also shown in the table below.
 */
export function ReportBarChart({ data, xKey, series, height = 260, format = money }: ReportBarChartProps) {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div style={{ width: "100%", height }} className="mb-3">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#6c757d" }} tickLine={false} axisLine={{ stroke: "#d0d0d0" }} />
          <YAxis tick={{ fontSize: 11, fill: "#6c757d" }} tickLine={false} axisLine={false} tickFormatter={(value: number) => (format === money ? compact(value) : format(value))} width={56} />
          <Tooltip formatter={(value) => format(Number(value))} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {series.map((item, index) => (
            <Bar key={item.key} dataKey={item.key} name={item.label} fill={SERIES_COLORS[index % SERIES_COLORS.length]} radius={[4, 4, 0, 0]} maxBarSize={36} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
