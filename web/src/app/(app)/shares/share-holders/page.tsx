"use client";

import Link from "next/link";

import { SharesAccess } from "@/components/shares/SharesAccess";
import { SharesNav } from "@/components/shares/SharesNav";
import { sharesLabel } from "@/components/shares/shares";
import type { ShareHolderRow } from "@/components/shares/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { backendUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { money, percent } from "@/lib/format";
import { useApi } from "@/lib/hooks";

/**
 * Shares → Shareholders: every registered shareholder with their share data. Registration stays in Capital →
 * Shareholders (one shareholder record for both modules).
 */
export default function ShareHoldersSharesPage() {
  const { can } = useAuth();
  const { data, isLoading } = useApi<ShareHolderRow[]>(can("shares.view") ? "shares/share-holders" : null);

  return (
    <SharesAccess crumbs={["Shares", "Shareholders"]}>
      <PageHeader crumbs={["Shares", "Shareholders"]} right={can("capital.manage") && <Link href="/capital/share-holders" className="btn btn-primary"><i className="icon-user-follow" /> Register Shareholder</Link>} />
      <SharesNav />
      <Card title="Shareholders">
        <DataTable
          rows={data}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", sortable: false, render: (_, index) => `${index + 1}.` },
            {
              key: "photo",
              header: "Photo",
              sortable: false,
              render: (row) => (
                // eslint-disable-next-line @next/next/no-img-element -- authorised API image stream
                <img src={row.photo_endpoint ? backendUrl(row.photo_endpoint) : "/assets/img/user.png"} alt={row.photo_endpoint ? row.name : "No photo"} className="img-thumbnail mf-passport-thumb" />
              ),
            },
            { key: "name", header: "Shareholder", render: (row) => <Link href={`/shares/share-holders/${row.id}`}>{row.name}</Link> },
            { key: "mobile", header: "Phone number" },
            { key: "shares", header: "Shares", className: "text-right", render: (row) => sharesLabel(row.shares) },
            { key: "ownership_percent", header: "Ownership %", className: "text-right", render: (row) => percent(row.ownership_percent) },
            { key: "share_value", header: "Current Share Value", className: "text-right", render: (row) => money(row.share_value) },
            { key: "holding_value", header: "Holding Value", className: "text-right", render: (row) => money(row.holding_value) },
            { key: "date_acquired", header: "Date Acquired", render: (row) => row.date_acquired ?? "—" },
            { key: "status", header: "Status", render: (row) => <Badge tone={row.status === "active" ? "success" : "default"}>{row.status === "active" ? "ACTIVE" : "NO SHARES"}</Badge> },
            { key: "action", header: "Action", sortable: false, render: (row) => <Link href={`/shares/share-holders/${row.id}`} className="btn btn-sm btn-icon btn-info" title="Share profile"><i className="icon-eye" /></Link> },
          ]}
        />
      </Card>
    </SharesAccess>
  );
}
