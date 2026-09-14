"use client";

import Link from "next/link";
import { useState } from "react";

import { SummaryTiles } from "@/components/financial-reports/ReportShell";
import { SharesAccess } from "@/components/shares/SharesAccess";
import { SharesNav } from "@/components/shares/SharesNav";
import { sharesLabel } from "@/components/shares/shares";
import type { RegisterResponse } from "@/components/shares/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import { money, percent, todayIso } from "@/lib/format";
import { useApi } from "@/lib/hooks";

/** Shares → Share Register, now or as of a past date (replayed from the share transaction history). */
export default function ShareRegisterPage() {
  const { can } = useAuth();
  const [asOf, setAsOf] = useState("");
  const { data, isLoading } = useApi<RegisterResponse>(can("shares.view") ? "shares/register" : null, { as_of: asOf || undefined });

  return (
    <SharesAccess crumbs={["Shares", "Share Register"]}>
      <PageHeader crumbs={["Shares", "Share Register"]} />
      <SharesNav />
      <Card
        title={`Share Register${asOf ? ` as of ${asOf}` : ""}`}
        actions={
          <div className="form-inline">
            <label className="mr-2 mb-0" htmlFor="register-as-of">As of</label>
            <input id="register-as-of" type="date" className="form-control mr-1" max={todayIso()} value={asOf} onChange={(e) => setAsOf(e.target.value)} />
            {asOf && <button type="button" className="btn btn-outline-secondary" onClick={() => setAsOf("")}>Today</button>}
            <button type="button" className="btn btn-info ml-1" title="print" onClick={() => window.print()}><i className="icon-printer" /></button>
          </div>
        }
      >
        {data && (
          <SummaryTiles
            items={[
              { label: "Total Issued Shares", value: sharesLabel(data.total_shares) },
              { label: asOf ? "Share Value on Date" : "Current Share Value", value: data.share_value },
              { label: "Company Share Valuation", value: data.total_valuation },
            ]}
          />
        )}
        <DataTable
          rows={data?.rows}
          loading={isLoading}
          rowKey={(row) => row.share_holder_id}
          columns={[
            { key: "name", header: "Shareholder", render: (row) => <Link href={`/shares/share-holders/${row.share_holder_id}`}>{row.name}</Link> },
            { key: "shares", header: "Shares Owned", className: "text-right", render: (row) => sharesLabel(row.shares) },
            { key: "ownership_percent", header: "Ownership %", className: "text-right", render: (row) => percent(row.ownership_percent) },
            { key: "share_value", header: asOf ? "Share Value" : "Current Share Value", className: "text-right", render: (row) => money(row.share_value) },
            { key: "holding_value", header: "Total Holding Value", className: "text-right", render: (row) => money(row.holding_value) },
            { key: "date_acquired", header: "Date Acquired", render: (row) => row.date_acquired ?? "—" },
            { key: "status", header: "Status", render: (row) => <Badge tone={row.status === "active" ? "success" : "default"}>{row.status === "active" ? "ACTIVE" : "NO SHARES"}</Badge> },
          ]}
          footer={
            data && (
              <tr>
                <th>TOTAL</th>
                <th className="text-right">{sharesLabel(data.total_shares)}</th>
                <th className="text-right">{data.total_shares > 0 ? "100%" : "0%"}</th>
                <th className="text-right">{money(data.share_value)}</th>
                <th className="text-right">{money(data.total_valuation)}</th>
                <th colSpan={2} />
              </tr>
            )
          }
        />
      </Card>
    </SharesAccess>
  );
}
