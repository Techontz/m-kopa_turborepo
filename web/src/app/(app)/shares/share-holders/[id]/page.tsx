"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { SummaryTiles } from "@/components/financial-reports/ReportShell";
import { holdingDetail, StepValueChart } from "@/components/shares/HoldingHistoryChart";
import { ShareTransactionsTable } from "@/components/shares/ShareTransactionsTable";
import { SharesAccess } from "@/components/shares/SharesAccess";
import { SharesNav } from "@/components/shares/SharesNav";
import { sharesLabel } from "@/components/shares/shares";
import type { ShareProfile } from "@/components/shares/types";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { backendUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { money, percent } from "@/lib/format";
import { useApi } from "@/lib/hooks";

/**
 * Shareholder share profile: personal information, current shares, ownership %, share value and holding value, the
 * holding value history, every share movement and (for capital users) the capital contribution history.
 */
export default function ShareProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const { data, isLoading } = useApi<ShareProfile>(can("shares.view") ? `shares/share-holders/${id}` : null);
  const holder = data?.share_holder;

  return (
    <SharesAccess crumbs={["Shares", "Share Profile"]}>
      <PageHeader crumbs={["Shares", "Shareholders", holder?.name ?? "Share Profile"]} right={<Link href="/shares/share-holders" className="btn btn-secondary"><i className="icon-arrow-left" /> Shareholders</Link>} />
      <SharesNav />
      {isLoading && <Card><div className="mf-loading">Loading...</div></Card>}
      {data && holder && (
        <>
          <div className="row clearfix">
            <div className="col-lg-4">
              <Card title="Personal Information">
                <div className="text-center mb-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- authorised API image stream */}
                  <img src={holder.photo_endpoint ? backendUrl(holder.photo_endpoint) : "/assets/img/user.png"} alt={holder.name} className="img-thumbnail" style={{ maxWidth: 140 }} />
                </div>
                <table className="table table-sm mb-0">
                  <tbody>
                    <tr><th>Name</th><td>{holder.name}</td></tr>
                    <tr><th>Phone</th><td>{holder.mobile ?? "—"}</td></tr>
                    <tr><th>Email</th><td>{holder.email ?? "—"}</td></tr>
                    <tr><th>Gender</th><td>{holder.gender ?? "—"}</td></tr>
                    <tr><th>Date of Birth</th><td>{holder.date_of_birth ?? "—"}</td></tr>
                    <tr><th>Date Acquired</th><td>{data.holding.date_acquired ?? "—"}</td></tr>
                  </tbody>
                </table>
              </Card>
            </div>
            <div className="col-lg-8">
              <Card title="Current Holding">
                <SummaryTiles
                  items={[
                    { label: "Shares", value: sharesLabel(data.holding.shares) },
                    { label: "Ownership", value: percent(data.holding.ownership_percent) },
                    { label: "Current Share Value", value: data.holding.share_value },
                    { label: "Holding Value", value: data.holding.holding_value },
                  ]}
                />
                <small className="text-muted">
                  {sharesLabel(data.holding.shares)} of {sharesLabel(data.holding.total_shares)} issued shares · holding value = shares × current share value (not cash).
                </small>
                <StepValueChart
                  title="Holding value history"
                  points={data.history.map((point) => ({ date: point.date, value: point.holding_value, detail: holdingDetail(point.shares, point.share_value) }))}
                />
              </Card>
            </div>
          </div>

          <Card title="Holding History">
            <DataTable
              rows={[...data.history].reverse()}
              rowKey={(row) => row.date}
              searchable={false}
              emptyMessage="No shares held yet"
              columns={[
                { key: "date", header: "Date" },
                { key: "shares", header: "Shares", className: "text-right", render: (row) => sharesLabel(row.shares) },
                { key: "total_shares", header: "Total Issued", className: "text-right", render: (row) => sharesLabel(row.total_shares) },
                { key: "ownership_percent", header: "Ownership %", className: "text-right", render: (row) => percent(row.ownership_percent) },
                { key: "share_value", header: "Share Value", className: "text-right", render: (row) => money(row.share_value) },
                { key: "holding_value", header: "Holding Value", className: "text-right", render: (row) => money(row.holding_value) },
              ]}
            />
          </Card>

          <Card title="Acquisition, Issuance and Transfer History">
            <ShareTransactionsTable rows={data.transactions} />
          </Card>

          {data.can_view_contributions && data.contributions && (
            <Card title={`Capital Contribution History — total ${money(data.total_contributed)}`}>
              {data.contribution_breakdown && (
                <SummaryTiles
                  items={[
                    { label: "Cash Contributions", value: data.contribution_breakdown.cash },
                    { label: "Bank Contributions", value: data.contribution_breakdown.bank },
                    { label: "Asset Contributions", value: data.contribution_breakdown.asset },
                    { label: "Total Contributions", value: data.contribution_breakdown.total },
                  ]}
                />
              )}
              <DataTable
                rows={data.contributions}
                rowKey={(row) => row.id}
                searchable={false}
                emptyMessage="No capital contributions"
                columns={[
                  { key: "contributed_at", header: "Date / Time" },
                  { key: "amount", header: "Amount", className: "text-right", render: (row) => money(row.amount) },
                  {
                    key: "pay_method",
                    header: "Pay Method",
                    render: (row) => (
                      <>
                        {row.pay_method}
                        {row.asset_id && <> · <Link href={`/capital/assets/${row.asset_id}`} title={row.asset_name ?? ""}>{row.asset_code}</Link></>}
                        {row.reversed && " · REVERSED"}
                      </>
                    ),
                  },
                  { key: "receiving_account_label", header: "Receiving Account", render: (row) => row.receiving_account_label ?? "—" },
                  { key: "receipt_number", header: "Receipt No", render: (row) => row.receipt_number || "—" },
                  { key: "journal_reference", header: "Journal Ref", render: (row) => row.journal_reference ?? "—" },
                  { key: "share_transaction_reference", header: "Share Transaction", render: (row) => row.share_transaction_reference ?? "Not linked" },
                  { key: "recorded_by", header: "Recorded By", render: (row) => row.recorded_by ?? "—" },
                ]}
              />
              <small className="text-muted">Contributions are financial records. Ownership comes from the shares above.</small>
            </Card>
          )}
        </>
      )}
    </SharesAccess>
  );
}
