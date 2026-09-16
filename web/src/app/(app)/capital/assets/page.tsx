"use client";

import Link from "next/link";
import { useState } from "react";

import { AssetActionModal, type AssetAction } from "@/components/capital/assets/AssetActionModal";
import { isAwaitingApproval, isTerminal, labelLines, registryRow, type AssetConfig, type AssetRow } from "@/components/capital/assets/assets";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { backendUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

/**
 * Capital → Assets: the Asset Registry of assets contributed as capital. Contribution values are permanent; branch,
 * status and current value change only through Transfer, Status and Revalue (each recorded in history).
 */
export default function AssetRegistryPage() {
  const { can } = useAuth();
  const canView = can("capital.view") || can("capital.manage");
  const canManage = can("capital.manage");
  const [filters, setFilters] = useState({ asset_type: "", status: "", branch_id: "", share_holder_id: "", search: "" });
  const [selected, setSelected] = useState<{ asset: AssetRow; action: AssetAction } | null>(null);
  const { data: config } = useApi<AssetConfig>(canView ? "capital/assets/config" : null);
  const { data: assets, isLoading } = useApi<AssetRow[]>(canView ? "capital/assets" : null, filters);

  if (!canView) {
    return (
      <>
        <PageHeader crumbs={["Capital", "Assets"]} />
        <Card><p className="mb-0">You do not have permission to view the asset registry.</p></Card>
      </>
    );
  }

  const act = (asset: AssetRow, action: AssetAction) => setSelected({ asset, action });
  const totals = (assets ?? []).reduce((sum, asset) => ({ contribution: sum.contribution + asset.contribution_value, current: sum.current + asset.current_value }), { contribution: 0, current: 0 });

  return (
    <>
      <PageHeader crumbs={["Capital", "Assets"]} right={canManage && <Link href="/capital/capitals" className="btn btn-primary"><i className="icon-plus" /> Add Asset Capital</Link>} />
      <Card title="Asset Registry">
        <div className="row mb-2">
          <div className="col-lg-2 col-md-4 mb-1">
            <select id="filter-asset-type" className="form-control" value={filters.asset_type} onChange={(e) => setFilters({ ...filters, asset_type: e.target.value })}>
              <option value="">Type: all</option>
              {(config?.types ?? []).map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </div>
          <div className="col-lg-2 col-md-4 mb-1">
            <select id="filter-asset-status" className="form-control" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">Status: all</option>
              {(config?.statuses ?? []).map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
              <option value="reversed">Reversed</option>
            </select>
          </div>
          <div className="col-lg-2 col-md-4 mb-1">
            <SelectBox inputId="filter-asset-branch" placeholder="Branch: all" optionsUrl="options/branches" value={filters.branch_id} isClearable onChange={(value) => setFilters({ ...filters, branch_id: value ?? "" })} />
          </div>
          <div className="col-lg-3 col-md-6 mb-1">
            <SelectBox inputId="filter-asset-holder" placeholder="Shareholder: all" optionsUrl="capital/options/share-holders" value={filters.share_holder_id} isClearable onChange={(value) => setFilters({ ...filters, share_holder_id: value ?? "" })} />
          </div>
          <div className="col-lg-3 col-md-6 mb-1">
            <input id="filter-asset-search" className="form-control" placeholder="Search ID, name, serial, registration…" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          </div>
        </div>
        <DataTable
          rows={assets}
          loading={isLoading}
          rowKey={(row) => row.id}
          emptyMessage="No assets contributed yet"
          columns={[
            { key: "asset_code", header: "Asset ID", render: (row) => <Link href={`/capital/assets/${row.id}`}><b>{row.asset_code}</b></Link> },
            { key: "name", header: "Asset Name", value: (row) => registryRow(row).search, render: (row) => { const identifier = labelLines(row).identifier; return <span title={registryRow(row).identifiers}>{row.name}{identifier && <><br /><small className="text-muted text-nowrap">{identifier.label}: {identifier.value}</small></>}</span>; } },
            { key: "asset_type_label", header: "Asset Type" },
            { key: "description", header: "Description", render: (row) => <span title={row.description}>{registryRow(row).description}</span> },
            { key: "share_holder", header: "Contributor", render: (row) => row.share_holder ?? "—" },
            { key: "contribution_value", header: "Contribution Value", className: "text-right", render: (row) => money(row.contribution_value) },
            { key: "current_value", header: "Current Value", className: "text-right", render: (row) => (registryRow(row).valueChanged ? <b title="Revalued">{money(row.current_value)}</b> : money(row.current_value)) },
            { key: "branch", header: "Branch", render: (row) => row.branch ?? "—" },
            { key: "location", header: "Location", render: (row) => row.location ?? "—" },
            { key: "condition_label", header: "Condition", render: (row) => row.condition_label ?? "—" },
            { key: "status", header: "Status", value: (row) => row.status_label, render: (row) => <Badge tone={registryRow(row).statusTone}>{row.status_label.toUpperCase()}</Badge> },
            { key: "contributed_on", header: "Contribution Date" },
            {
              key: "qr",
              header: "QR",
              sortable: false,
              render: (row) => (
                <button type="button" className="btn btn-link p-0" title="View QR" onClick={() => act(row, "qr")}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- authorised API image stream */}
                  <img src={backendUrl(`${row.qr_endpoint}?size=96`)} alt={`QR ${row.asset_code}`} width={40} height={40} loading="lazy" />
                </button>
              ),
            },
            {
              key: "actions",
              header: "Action",
              sortable: false,
              render: (row) => (
                <div className="text-nowrap">
                  <Link href={`/capital/assets/${row.id}`} className="btn btn-sm btn-icon btn-info mr-1" title="View"><i className="icon-eye" /></Link>
                  <button type="button" className="btn btn-sm btn-icon btn-info mr-1" title="History" onClick={() => act(row, "history")}><i className="icon-list" /></button>
                  <Link href={`/capital/assets/${row.id}/label`} className="btn btn-sm btn-icon btn-secondary mr-1" title="Print Label"><i className="icon-printer" /></Link>
                  <a href={backendUrl(`${row.qr_endpoint}?download=1`)} className="btn btn-sm btn-icon btn-secondary mr-1" title="Download QR"><i className="icon-cloud-download" /></a>
                  {isAwaitingApproval(row.status) && <Link href={`/capital/assets/${row.id}`} className="btn btn-sm btn-outline-warning" title="Awaiting approval by another authorised user">Awaiting approval</Link>}
                  {canManage && !isTerminal(row.status) && !isAwaitingApproval(row.status) && (
                    <>
                      <button type="button" className="btn btn-sm btn-icon btn-primary mr-1" title="Edit" onClick={() => act(row, "edit")}><i className="icon-pencil" /></button>
                      <button type="button" className="btn btn-sm btn-icon btn-primary mr-1" title="Transfer branch" onClick={() => act(row, "transfer")}><i className="icon-shuffle" /></button>
                      <button type="button" className="btn btn-sm btn-icon btn-warning mr-1" title="Change status" onClick={() => act(row, "status")}><i className="icon-flag" /></button>
                      <button type="button" className="btn btn-sm btn-icon btn-success" title="Revalue" onClick={() => act(row, "revalue")}><i className="icon-graph" /></button>
                    </>
                  )}
                </div>
              ),
            },
          ]}
          footer={
            assets && assets.length > 0 && (
              <tr>
                <th colSpan={5}>TOTAL ({assets.length} assets)</th>
                <th className="text-right">{money(totals.contribution)}</th>
                <th className="text-right">{money(totals.current)}</th>
                <th colSpan={8} />
              </tr>
            )
          }
        />
        <small className="text-muted">Contribution value = contributed capital (permanent). Current value changes only through revaluation (memo; ledger and ownership unchanged).</small>
      </Card>
      <AssetActionModal asset={selected?.asset ?? null} action={selected?.action ?? null} config={config} onClose={() => setSelected(null)} />
    </>
  );
}
