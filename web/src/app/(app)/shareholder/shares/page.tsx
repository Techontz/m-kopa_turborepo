"use client";

import { ownership, type PortalShares, type PortalShareTransaction } from "@/components/shareholders/portal";
import { Tile } from "@/components/shareholders/Tile";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

/** My Shares: current share-register holding and my share movements. */
export default function ShareholderSharesPage() {
  const { can } = useAuth();
  const { data, isLoading } = useApi<PortalShares>(can("shareholder.capital.view") ? "portal/shareholder/shares" : null);

  return (
    <>
      <PageHeader crumbs={["Shareholder", "My Shares"]} />
      <div className="row sh-tiles">
        <Tile label="My shares" value={(data?.shares ?? 0).toLocaleString("en-US")} />
        <Tile label="My ownership" value={ownership(data?.ownership_percent)} tone="info" note={`of ${(data?.total_shares ?? 0).toLocaleString("en-US")} issued shares`} />
        <Tile label="Share value (TZS)" value={money(data?.share_value)} />
        <Tile label="Holding value (TZS)" value={money(data?.holding_value)} tone="success" />
      </div>
      <Card title="Share movements">
        <DataTable<PortalShareTransaction>
          rows={data?.transactions}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "transacted_at", header: "Date", render: (row) => row.transacted_at?.slice(0, 10) ?? "" },
            { key: "reference", header: "Reference" },
            { key: "type_label", header: "Type" },
            { key: "counterparty", header: "From / To" },
            { key: "signed_shares", header: "Shares", className: "text-right", render: (row) => <span className={row.signed_shares < 0 ? "text-danger" : "text-success"}>{row.signed_shares > 0 ? "+" : ""}{row.signed_shares.toLocaleString("en-US")}</span> },
            { key: "share_value", header: "Share value", className: "text-right", render: (row) => money(row.share_value) },
            { key: "total_amount", header: "Amount", className: "text-right", render: (row) => (row.total_amount === null ? "-" : money(row.total_amount)) },
            { key: "status", header: "Status", render: (row) => <Badge tone={row.status === "completed" ? "success" : "dark"}>{row.status.toUpperCase()}</Badge> },
          ]}
        />
      </Card>
    </>
  );
}
