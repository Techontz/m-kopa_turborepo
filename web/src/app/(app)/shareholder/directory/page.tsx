"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ownership, type DirectoryRow, type PortalDirectory } from "@/components/shareholders/portal";
import { Tile } from "@/components/shareholders/Tile";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

/**
 * All Shareholders (read-only): every shareholder's public holding — number, name, shares, ownership % (share register)
 * and approved capital — with totals and the share distribution chart. No contact, identity or transaction data.
 */
export default function ShareholderDirectoryPage() {
  const { can } = useAuth();
  const { data, isLoading } = useApi<PortalDirectory>(can("shareholder.directory") ? "portal/shareholder/directory" : null);
  const chartHeight = Math.max(220, (data?.distribution.length ?? 0) * 36 + 40);

  return (
    <>
      <PageHeader crumbs={["Shareholder", "All Shareholders"]} />
      <div className="row sh-tiles">
        <Tile label="Shareholders" value={(data?.totals.shareholders ?? 0).toLocaleString("en-US")} className="col-md-4" />
        <Tile label="Total shares" value={(data?.totals.total_shares ?? 0).toLocaleString("en-US")} tone="info" className="col-md-4" />
        <Tile label="Total capital (TZS)" value={money(data?.totals.total_capital)} tone="success" className="col-md-4" />
      </div>

      <Card title="Shareholders">
        <DataTable<DirectoryRow>
          rows={data?.rows}
          loading={isLoading}
          rowKey={(row) => row.holder_number}
          columns={[
            { key: "holder_number", header: "Shareholder No." },
            { key: "name", header: "Name", render: (row) => (row.is_me ? <b>{row.name} (me)</b> : row.name) },
            { key: "shares", header: "Shares", className: "text-right", render: (row) => row.shares.toLocaleString("en-US") },
            { key: "ownership_percent", header: "Ownership %", className: "text-right", render: (row) => ownership(row.ownership_percent) },
            { key: "capital_contributed", header: "Capital contributed (TZS)", className: "text-right", render: (row) => money(row.capital_contributed) },
          ]}
          footer={
            data && (
              <tr>
                <th colSpan={2}>TOTAL</th>
                <th className="text-right">{data.totals.total_shares.toLocaleString("en-US")}</th>
                <th className="text-right">{data.totals.total_shares > 0 ? "100%" : "0%"}</th>
                <th className="text-right">{money(data.totals.total_capital)}</th>
              </tr>
            )
          }
        />
      </Card>

      <Card title="Share distribution (ownership %)">
        {data && data.distribution.length === 0 ? (
          <p className="text-muted mb-0">No shares have been issued yet.</p>
        ) : (
          <div style={{ width: "100%", height: chartHeight }} data-testid="distribution-chart">
            <ResponsiveContainer>
              <BarChart data={data?.distribution ?? []} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 10 }}>
                <CartesianGrid stroke="#eee" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 11, fill: "#777" }} tickLine={false} axisLine={{ stroke: "#ddd" }} />
                <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 11, fill: "#777" }} tickLine={false} axisLine={{ stroke: "#ddd" }} />
                <Tooltip formatter={(value, _name, item) => [`${ownership(Number(value))} · ${Number((item?.payload as { shares?: number })?.shares ?? 0).toLocaleString("en-US")} shares`, "Ownership"]} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                <Bar dataKey="ownership_percent" name="Ownership %" fill="#3c89da" radius={[0, 4, 4, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </>
  );
}
