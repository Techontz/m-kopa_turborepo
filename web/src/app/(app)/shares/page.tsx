"use client";

import Link from "next/link";

import { SummaryTiles, styles } from "@/components/financial-reports/ReportShell";
import { OwnershipChart } from "@/components/shares/OwnershipChart";
import { ShareTransactionsTable } from "@/components/shares/ShareTransactionsTable";
import { SharesAccess } from "@/components/shares/SharesAccess";
import { SharesNav } from "@/components/shares/SharesNav";
import { sharesLabel } from "@/components/shares/shares";
import type { SharesOverview } from "@/components/shares/types";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import { money, percent } from "@/lib/format";
import { useApi } from "@/lib/hooks";

/**
 * Shares → Overview: total issued and available shares, current share value, company share valuation (shares × value —
 * not cash), shareholders, recent movements and value changes, and the ownership distribution from the share register.
 */
export default function SharesOverviewPage() {
  const { can } = useAuth();
  const { data, isLoading } = useApi<SharesOverview>(can("shares.view") ? "shares/overview" : null);

  return (
    <SharesAccess crumbs={["Shares", "Overview"]}>
      <PageHeader
        crumbs={["Shares", "Overview"]}
        right={
          data?.has_structure && (
            <>
              {can("shares.issue") && <Link href="/shares/issue" className="btn btn-primary mr-1"><i className="icon-plus" /> Issue Shares</Link>}
              {can("shares.transfer") && <Link href="/shares/transfer" className="btn btn-info"><i className="icon-shuffle" /> Transfer Shares</Link>}
            </>
          )
        }
      />
      <SharesNav />

      {isLoading && <Card><div className="mf-loading">Loading...</div></Card>}

      {data && !data.has_structure && (
        <Card title="Share Structure">
          <p>No share structure has been set up yet. Ownership is taken only from the share register, so every shareholder currently owns 0%.</p>
          {can("shares.manage") ? (
            <Link href="/shares/setup" className="btn btn-primary"><i className="icon-settings" /> Set Up Share Structure &amp; Initial Allocation</Link>
          ) : (
            <p className="text-muted mb-0">Ask a user with the “Set up the share structure” permission to create it.</p>
          )}
        </Card>
      )}

      {data?.has_structure && (
        <>
          <Card title="Share Position">
            <SummaryTiles
              items={[
                { label: "Total Issued Shares", value: sharesLabel(data.total_issued_shares) },
                { label: "Available / Unissued", value: data.available_shares === null ? "No limit" : sharesLabel(data.available_shares) },
                { label: "Current Share Value", value: data.current_share_value },
                { label: "Company Share Valuation", value: data.total_valuation },
                { label: "Shareholders", value: `${data.shareholders_with_shares} of ${data.registered_shareholders}` },
              ]}
            />
            <p className={styles.note}>
              Company share valuation = total issued shares × current share value. It is a valuation of ownership units, not cash or a bank balance.
              {data.authorised_shares !== null && <> Authorised limit: {sharesLabel(data.authorised_shares)} shares.</>}
              {" "}Structure: {money(data.structure?.initial_capital_basis)} ÷ {sharesLabel(data.structure?.initial_shares)} shares = {money(data.structure?.initial_share_value)} per share on {data.structure?.established_on}.
              {!data.register_consistent && <span className="text-danger"> Warning: share positions do not match the transaction history.</span>}
            </p>
          </Card>

          <Card title="Ownership Distribution">
            <OwnershipChart rows={data.distribution} />
            <DataTable
              rows={data.distribution}
              rowKey={(row) => row.share_holder_id}
              searchable={false}
              pageSize={100}
              columns={[
                { key: "name", header: "Shareholder", render: (row) => <Link href={`/shares/share-holders/${row.share_holder_id}`}>{row.name}</Link> },
                { key: "shares", header: "Shares", className: "text-right", render: (row) => sharesLabel(row.shares) },
                { key: "ownership_percent", header: "Ownership %", className: "text-right", render: (row) => percent(row.ownership_percent) },
                { key: "share_value", header: "Current Share Value", className: "text-right", render: (row) => money(row.share_value) },
                { key: "holding_value", header: "Holding Value", className: "text-right", render: (row) => money(row.holding_value) },
              ]}
              footer={
                <tr>
                  <th>TOTAL</th>
                  <th className="text-right">{sharesLabel(data.total_issued_shares)}</th>
                  <th className="text-right">{data.total_issued_shares > 0 ? "100%" : "0%"}</th>
                  <th className="text-right">{money(data.current_share_value)}</th>
                  <th className="text-right">{money(data.total_valuation)}</th>
                </tr>
              }
            />
          </Card>

          <div className="row clearfix">
            <div className="col-12">
              <Card title="Recent Share Transactions" actions={<Link href="/shares/transactions">View all</Link>}>
                <ShareTransactionsTable rows={data.recent_transactions} compact pageSize={8} />
              </Card>
            </div>
            <div className="col-12">
              <Card title="Recent Value Changes" actions={<Link href="/shares/valuations">View all</Link>}>
                <DataTable
                  rows={data.recent_valuations}
                  rowKey={(row) => row.id}
                  searchable={false}
                  emptyMessage="No valuations yet"
                  columns={[
                    { key: "valuation_date", header: "Date" },
                    { key: "previous_value", header: "Previous", className: "text-right", render: (row) => (row.previous_value === null ? "—" : money(row.previous_value)) },
                    { key: "new_value", header: "New Value", className: "text-right", render: (row) => money(row.new_value) },
                    { key: "status", header: "Status", render: (row) => (row.status === "effective" ? row.kind === "initial" ? "Initial" : "Effective" : "Reversed") },
                  ]}
                />
              </Card>
            </div>
          </div>
        </>
      )}
    </SharesAccess>
  );
}
