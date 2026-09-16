"use client";

import Link from "next/link";

import { STATUS_LABEL, STATUS_TONE, ownership, type PortalCapital, type PortalDashboard } from "@/components/shareholders/portal";
import { Tile } from "@/components/shareholders/Tile";
import { Badge } from "@/components/ui/Badge";
import { Loading } from "@/components/ui/Loading";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/lib/auth";
import { date, money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

/** Shareholder Portal dashboard: welcome, my holding and capital, company totals, dividends and recent contributions. */
export default function ShareholderDashboardPage() {
  const { can } = useAuth();
  const { data, isLoading, error } = useApi<PortalDashboard>(can("shareholder.portal") ? "portal/shareholder/dashboard" : null);
  const { data: capital } = useApi<PortalCapital>(can("shareholder.capital.view") ? "portal/shareholder/capital" : null);

  if (!can("shareholder.portal")) {
    return <Card title="Shareholder Portal"><p className="mb-0">Your account has no access to the shareholder dashboard.</p></Card>;
  }
  if (isLoading || !data) {
    return <Loading message={error ? "Unable to load your dashboard." : "Loading..."} />;
  }

  return (
    <>
      <div className="sh-welcome">
        <h1>Welcome, {data.share_holder.name}</h1>
        <p>Shareholder {data.share_holder.holder_number} · all figures come from the company share register and approved capital.</p>
      </div>

      <div className="row sh-tiles">
        <Tile label="My shares" value={data.my_shares.toLocaleString("en-US")} note={`of ${data.total_company_shares.toLocaleString("en-US")} issued shares`} />
        <Tile label="My ownership" value={ownership(data.my_ownership_percent)} tone="info" note="Share register" />
        <Tile label="My capital (TZS)" value={money(data.my_capital)} tone="success" note={data.pending_contributions > 0 ? `${data.pending_contributions} pending · ${money(data.pending_contributions_amount)}` : "Approved contributions"} />
        <Tile label="Holding value (TZS)" value={money(data.holding_value)} note={`Share value ${money(data.share_value)}`} />
        <Tile label="Total company shares" value={data.total_company_shares.toLocaleString("en-US")} tone="info" />
        <Tile label="Total shareholder capital (TZS)" value={money(data.total_shareholder_capital)} tone="success" />
        <Tile label="Dividends paid (TZS)" value={money(data.dividends.paid)} tone="success" note={`Entitled ${money(data.dividends.entitled)}`} />
        <Tile label="Dividends outstanding (TZS)" value={money(data.dividends.outstanding)} tone={data.dividends.outstanding > 0 ? "warning" : "primary"} />
      </div>

      <div className="row">
        <div className="col-lg-8">
          <Card
            title="Recent capital contributions"
            actions={
              <>
                {can("shareholder.capital.submit") && <Link href="/shareholder/capital/add" className="btn btn-sm btn-primary mr-1"><i className="icon-plus" /> Add Capital</Link>}
                {can("shareholder.capital.view") && <Link href="/shareholder/capital" className="btn btn-sm btn-info">History</Link>}
              </>
            }
          >
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="thead-info">
                  <tr><th>Date</th><th>Method</th><th>Reference</th><th className="text-right">Amount</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {(capital?.rows ?? []).slice(0, 5).map((row) => (
                    <tr key={row.id}>
                      <td>{date(row.date)}</td>
                      <td>{row.payment_method}{row.bank_account ? ` · ${row.bank_account}` : ""}</td>
                      <td>{row.reference ?? "-"}</td>
                      <td className="text-right">{money(row.amount)}</td>
                      <td><Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge></td>
                    </tr>
                  ))}
                  {capital && capital.rows.length === 0 && <tr><td colSpan={5} className="text-center text-muted">No contributions yet</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
        <div className="col-lg-4">
          <Card title="My capital by method">
            <dl className="sh-kv">
              <dt>Cash</dt><dd>{money(data.my_capital_breakdown.cash)}</dd>
              <dt>Bank</dt><dd>{money(data.my_capital_breakdown.bank)}</dd>
              <dt>Asset</dt><dd>{money(data.my_capital_breakdown.asset)}</dd>
              <dt>Total</dt><dd><b>{money(data.my_capital)}</b></dd>
            </dl>
          </Card>
          <Card title="Quick links">
            <div className="d-flex flex-wrap" style={{ gap: 6 }}>
              {can("shareholder.dividends.view") && <Link href="/shareholder/dividends" className="btn btn-sm btn-outline-primary">Dividends</Link>}
              {can("shareholder.statements") && <Link href="/shareholder/statements" className="btn btn-sm btn-outline-primary">Statements</Link>}
              {can("shareholder.directory") && <Link href="/shareholder/directory" className="btn btn-sm btn-outline-primary">All Shareholders</Link>}
              {can("shareholder.directory") && <Link href="/shareholder/company" className="btn btn-sm btn-outline-primary">Company Shares</Link>}
              <Link href="/shareholder/security" className="btn btn-sm btn-outline-primary">Change password</Link>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
