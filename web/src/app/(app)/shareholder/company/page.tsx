"use client";

import Link from "next/link";

import type { PortalStructure } from "@/components/shareholders/portal";
import { Tile } from "@/components/shareholders/Tile";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

/** Company Information / Share Structure (read-only): authorised, issued and available shares, par and current share value. */
export default function ShareholderCompanyPage() {
  const { can } = useAuth();
  const { data, isLoading } = useApi<PortalStructure>(can("shareholder.directory") ? "portal/shareholder/share-structure" : null);
  const number = (value: number | null | undefined) => (value === null || value === undefined ? "Not set" : value.toLocaleString("en-US"));

  return (
    <>
      <PageHeader crumbs={["Shareholder", "Company Shares"]} right={<Link href="/shareholder/directory" className="btn btn-info btn-sm">Share distribution</Link>} />
      {isLoading || !data ? (
        <div className="mf-loading">Loading...</div>
      ) : (
        <>
          <div className="row sh-tiles">
            <Tile label="Authorised shares" value={number(data.authorised_shares)} />
            <Tile label="Issued shares" value={number(data.issued_shares)} tone="info" />
            <Tile label="Available shares" value={number(data.available_shares)} tone="warning" />
            <Tile label="Shareholders" value={number(data.shareholders)} tone="success" />
          </div>
          <Card title="Company share structure">
            {!data.has_structure && <p className="text-muted">The company share structure has not been set up yet.</p>}
            <dl className="sh-kv">
              <dt>Par (initial) share value</dt><dd>{data.par_value === null ? "Not set" : `TZS ${money(data.par_value)}`}</dd>
              <dt>Current share value</dt><dd>TZS {money(data.current_share_value)}</dd>
              <dt>Company share valuation</dt><dd>TZS {money(data.total_valuation)}</dd>
              <dt>Initial shares</dt><dd>{number(data.initial_shares)}</dd>
              <dt>Established on</dt><dd>{data.established_on ?? "-"}</dd>
            </dl>
          </Card>
        </>
      )}
    </>
  );
}
