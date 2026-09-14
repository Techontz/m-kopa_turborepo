"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { AssetLabel, labelSheetClass } from "@/components/capital/assets/AssetLabel";
import type { AssetRow } from "@/components/capital/assets/assets";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/hooks";

const PRINT_CSS = `@media print {
  #left-sidebar, .navbar-fixed-top, .block-header, .mf-no-print, .card > .header { display: none !important; }
  #main-content { margin: 0 !important; padding: 0 !important; width: 100% !important; }
  html, body, #wrapper, #main-content, .container-fluid, .card, .card > .body { background: #fff !important; box-shadow: none !important; border: 0 !important; padding: 0 !important; }
}`;

/** Print-friendly asset label (light label regardless of theme); several copies can be printed on one sheet. */
export default function AssetLabelPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const canView = can("capital.view") || can("capital.manage");
  const { data: asset, isLoading } = useApi<AssetRow>(canView ? `capital/assets/${id}` : null);
  const [copies, setCopies] = useState(1);

  return (
    <>
      <style>{PRINT_CSS}</style>
      <PageHeader crumbs={["Capital", "Assets", asset?.asset_code ?? "Asset", "Label"]} right={<Link href={`/capital/assets/${id}`} className="btn btn-secondary mf-no-print"><i className="icon-arrow-left" /> Asset</Link>} />
      <Card
        title="Print Asset Label"
        actions={
          <div className="form-inline mf-no-print">
            <label htmlFor="label-copies" className="mr-2 mb-0">Copies</label>
            <input id="label-copies" type="number" min={1} max={30} className="form-control mr-2" style={{ width: 80 }} value={copies} onChange={(e) => setCopies(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} />
            <button type="button" className="btn btn-info" onClick={() => window.print()} disabled={!asset}><i className="icon-printer" /> Print</button>
          </div>
        }
      >
        {!canView && <p className="mb-0">You do not have permission to view the asset registry.</p>}
        {isLoading && <div className="mf-loading">Loading...</div>}
        {asset && (
          <div className={labelSheetClass}>
            {Array.from({ length: copies }, (_, index) => <AssetLabel key={index} asset={asset} />)}
          </div>
        )}
      </Card>
    </>
  );
}
