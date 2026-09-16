"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { identifierSummary, statusTone, type AssetRow } from "@/components/capital/assets/assets";
import { Badge } from "@/components/ui/Badge";
import { Loading } from "@/components/ui/Loading";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

/**
 * QR scan landing page (/capital/assets/scan/{qr_token}). Requires a signed-in user (the app shell redirects to login)
 * with capital access; the API resolves the opaque token to the asset summary and returns 404 for unknown tokens.
 */
export default function AssetScanPage() {
  const { token } = useParams<{ token: string }>();
  const { can } = useAuth();
  const canView = can("capital.view") || can("capital.manage");
  const { data: asset, isLoading, error } = useApi<AssetRow>(canView ? `capital/assets/scan/${encodeURIComponent(token)}` : null);
  const status = error instanceof ApiError ? error.status : null;

  return (
    <>
      <PageHeader crumbs={["Capital", "Assets", "Scan"]} />
      <div className="row clearfix justify-content-center">
        <div className="col-lg-6 col-md-8">
          {!canView && <Card title="Asset Scan"><p className="mb-0">You do not have permission to view assets.</p></Card>}
          {isLoading && <Card><Loading /></Card>}
          {status !== null && <Card title="Asset Scan"><p className="mb-0">{status === 404 ? "No asset matches this QR code." : status === 403 ? "You do not have permission to view assets." : "The asset could not be loaded."}</p></Card>}
          {asset && (
            <Card title={<>{asset.asset_code} <Badge tone={statusTone(asset.status)}>{asset.status_label.toUpperCase()}</Badge></>}>
              <table className="table table-sm mb-3">
                <tbody>
                  <tr><th>Asset Name</th><td><b>{asset.name}</b></td></tr>
                  <tr><th>Asset Type</th><td>{asset.asset_type_label}</td></tr>
                  <tr><th>Contributor</th><td>{asset.share_holder}</td></tr>
                  <tr><th>Current Value</th><td>{money(asset.current_value)}</td></tr>
                  <tr><th>Branch</th><td>{asset.branch}</td></tr>
                  <tr><th>Location</th><td>{asset.location ?? "—"}</td></tr>
                  <tr><th>Contribution Date</th><td>{asset.contributed_on}</td></tr>
                  <tr><th>Identifiers</th><td>{identifierSummary(asset.identifiers) || "—"}</td></tr>
                </tbody>
              </table>
              <Link href={`/capital/assets/${asset.id}`} className="btn btn-primary btn-block">Open Asset</Link>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
