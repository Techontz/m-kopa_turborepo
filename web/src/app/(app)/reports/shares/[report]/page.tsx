"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useState } from "react";

import { SummaryTiles, styles } from "@/components/financial-reports/ReportShell";
import { OwnershipChart } from "@/components/shares/OwnershipChart";
import { ShareTransactionsTable } from "@/components/shares/ShareTransactionsTable";
import { SharesAccess } from "@/components/shares/SharesAccess";
import { SharesNav } from "@/components/shares/SharesNav";
import { sharesLabel } from "@/components/shares/shares";
import type { RegisterRow, ShareTransaction, ShareValuation } from "@/components/shares/types";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import { money, percent, todayIso } from "@/lib/format";
import { useApi } from "@/lib/hooks";

const REPORTS = {
  ownership: { title: "Share Ownership", dates: "asOf" },
  distribution: { title: "Ownership Distribution", dates: "none" },
  valuations: { title: "Share Valuation History", dates: "range" },
  transactions: { title: "Share Transaction History", dates: "range" },
  issuances: { title: "Share Issuances", dates: "range" },
  transfers: { title: "Share Transfers", dates: "range" },
} as const;

type Slug = keyof typeof REPORTS;

interface OwnershipReport { as_of: string; total_shares: number; share_value: number; total_valuation: number; shareholders_with_shares: number; rows: RegisterRow[] }
interface DistributionReport { total_shares: number; holders: number; largest_percent: number; top_three_percent: number; bands: { band: string; holders: number; shares: number; percent: number }[]; rows: RegisterRow[] }
interface MovementReport { rows: ShareTransaction[]; totals: Record<string, number> }

function RegisterTable({ rows, ranked = false }: { rows: RegisterRow[]; ranked?: boolean }) {
  return (
    <DataTable
      rows={rows}
      rowKey={(row) => row.share_holder_id}
      pageSize={50}
      columns={[
        ...(ranked ? [{ key: "rank", header: "Rank", render: (row: RegisterRow) => `${row.rank}.` }] : []),
        { key: "name", header: "Shareholder", render: (row) => <Link href={`/shares/share-holders/${row.share_holder_id}`}>{row.name}</Link> },
        { key: "shares", header: "Shares", className: "text-right", render: (row) => sharesLabel(row.shares) },
        { key: "ownership_percent", header: "Ownership %", className: "text-right", render: (row) => percent(row.ownership_percent) },
        ...(ranked ? [{ key: "cumulative_percent", header: "Cumulative %", className: "text-right", render: (row: RegisterRow) => percent(row.cumulative_percent ?? 0) }] : []),
        { key: "share_value", header: "Share Value", className: "text-right", render: (row) => money(row.share_value) },
        { key: "holding_value", header: "Holding Value", className: "text-right", render: (row) => money(row.holding_value) },
      ]}
    />
  );
}

/** Reports → Shares: ownership (as of a date), distribution, valuation history, transactions, issuances and transfers. */
export default function ShareReportPage() {
  const { report } = useParams<{ report: string }>();
  const { can } = useAuth();
  const [asOf, setAsOf] = useState(todayIso());
  const [range, setRange] = useState({ from: "", to: "" });

  const known = report in REPORTS;
  const slug = (known ? report : "ownership") as Slug;
  const config = REPORTS[slug];
  const query = config.dates === "asOf" ? { as_of: asOf } : config.dates === "range" ? range : undefined;
  const { data, isLoading } = useApi<unknown>(known && can("shares.view") ? `shares/reports/${slug}` : null, query);

  if (!known) {
    notFound();
  }

  return (
    <SharesAccess crumbs={["Report", config.title]}>
      <PageHeader crumbs={["Report", "Shares", config.title]} />
      <SharesNav />
      <ul className="nav nav-tabs-new profile-tabs mb-3" aria-label="Share reports">
        {(Object.keys(REPORTS) as Slug[]).map((key) => (
          <li className="nav-item my-1" key={key}>
            <Link href={`/reports/shares/${key}`} className={`nav-link ${key === slug ? "active" : ""}`}>{REPORTS[key].title}</Link>
          </li>
        ))}
      </ul>
      <Card
        title={config.title}
        actions={
          <div className="form-inline">
            {config.dates === "asOf" && (
              <>
                <label className="mr-2 mb-0" htmlFor="report-as-of">As of</label>
                <input id="report-as-of" type="date" className="form-control mr-1" max={todayIso()} value={asOf} onChange={(e) => setAsOf(e.target.value)} />
              </>
            )}
            {config.dates === "range" && (
              <>
                <label className="mr-2 mb-0" htmlFor="report-from">From</label>
                <input id="report-from" type="date" className="form-control mr-2" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
                <label className="mr-2 mb-0" htmlFor="report-to">To</label>
                <input id="report-to" type="date" className="form-control mr-1" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
              </>
            )}
            <button type="button" className="btn btn-info" title="print" onClick={() => window.print()}><i className="icon-printer" /></button>
          </div>
        }
      >
        {isLoading && <div className="mf-loading">Loading...</div>}

        {slug === "ownership" && data !== undefined && (() => {
          const ownership = data as OwnershipReport;
          return (
            <>
              <SummaryTiles items={[
                { label: "Total Issued Shares", value: sharesLabel(ownership.total_shares) },
                { label: "Share Value", value: ownership.share_value },
                { label: "Company Share Valuation", value: ownership.total_valuation },
                { label: "Shareholders with Shares", value: String(ownership.shareholders_with_shares) },
              ]} />
              <RegisterTable rows={ownership.rows} />
              <p className={styles.note}>Ownership % = shares ÷ total issued shares × 100 on {ownership.as_of}; holding value = shares × share value effective that day.</p>
            </>
          );
        })()}

        {slug === "distribution" && data !== undefined && (() => {
          const distribution = data as DistributionReport;
          return (
            <>
              <SummaryTiles items={[
                { label: "Shareholders", value: String(distribution.holders) },
                { label: "Total Issued Shares", value: sharesLabel(distribution.total_shares) },
                { label: "Largest Holding", value: percent(distribution.largest_percent) },
                { label: "Top 3 Holdings", value: percent(distribution.top_three_percent) },
              ]} />
              <OwnershipChart rows={distribution.rows} />
              <RegisterTable rows={distribution.rows} ranked />
              <div className={styles.subhead}>Concentration bands</div>
              <DataTable
                rows={distribution.bands}
                rowKey={(row) => row.band}
                searchable={false}
                columns={[
                  { key: "band", header: "Ownership band" },
                  { key: "holders", header: "Shareholders", className: "text-right" },
                  { key: "shares", header: "Shares", className: "text-right", render: (row) => sharesLabel(row.shares) },
                  { key: "percent", header: "Share of Total", className: "text-right", render: (row) => percent(row.percent) },
                ]}
              />
            </>
          );
        })()}

        {slug === "valuations" && Array.isArray(data) && (
          <DataTable
            rows={data as ShareValuation[]}
            rowKey={(row) => row.id}
            columns={[
              { key: "valuation_date", header: "Valuation Date" },
              { key: "reference", header: "Reference" },
              { key: "previous_value", header: "Previous Value", className: "text-right", render: (row) => (row.previous_value === null ? "—" : money(row.previous_value)) },
              { key: "new_value", header: "New Value", className: "text-right", render: (row) => money(row.new_value) },
              { key: "total_shares", header: "Total Shares", className: "text-right", render: (row) => sharesLabel(row.total_shares) },
              { key: "previous_total_valuation", header: "Previous Valuation", className: "text-right", render: (row) => (row.previous_total_valuation === null ? "—" : money(row.previous_total_valuation)) },
              { key: "new_total_valuation", header: "New Valuation", className: "text-right", render: (row) => money(row.new_total_valuation) },
              { key: "reason", header: "Reason" },
              { key: "performed_by", header: "Performed By", render: (row) => row.performed_by ?? "—" },
              { key: "status", header: "Status", render: (row) => row.status.toUpperCase() },
            ]}
          />
        )}

        {slug === "transactions" && Array.isArray(data) && <ShareTransactionsTable rows={data as ShareTransaction[]} />}

        {(slug === "issuances" || slug === "transfers") && data !== undefined && !Array.isArray(data) && (() => {
          const movements = data as MovementReport;
          return (
            <>
              <SummaryTiles
                items={slug === "issuances"
                  ? [
                      { label: "Shares Issued", value: sharesLabel(movements.totals.shares) },
                      { label: "Subscription Amount", value: movements.totals.amount },
                      { label: "Paid Now (journal posted)", value: movements.totals.paid_amount },
                      { label: "Linked Contributions", value: movements.totals.linked_amount },
                      { label: "Non-cash Shares", value: sharesLabel(movements.totals.non_cash_shares) },
                    ]
                  : [
                      { label: "Shares Transferred", value: sharesLabel(movements.totals.shares) },
                      { label: "Consideration (information only)", value: movements.totals.consideration },
                    ]}
              />
              <ShareTransactionsTable rows={movements.rows} />
              <p className={styles.note}>Reversed rows are listed but excluded from the totals.</p>
            </>
          );
        })()}
      </Card>
    </SharesAccess>
  );
}
