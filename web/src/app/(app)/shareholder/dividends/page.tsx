"use client";

import { Fragment } from "react";

import { ownership, type PortalDividends } from "@/components/shareholders/portal";
import { Tile } from "@/components/shareholders/Tile";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

/** My dividends: entitlement per declaration (share-register snapshot) and the payments made against it. */
export default function ShareholderDividendsPage() {
  const { can } = useAuth();
  const { data, isLoading } = useApi<PortalDividends>(can("shareholder.dividends.view") ? "portal/shareholder/dividends" : null);

  return (
    <>
      <PageHeader crumbs={["Shareholder", "Dividends"]} />
      <div className="row sh-tiles">
        <Tile label="Entitled (TZS)" value={money(data?.totals.entitled)} className="col-md-4" />
        <Tile label="Paid (TZS)" value={money(data?.totals.paid)} tone="success" className="col-md-4" />
        <Tile label="Outstanding (TZS)" value={money(data?.totals.outstanding)} tone="warning" className="col-md-4" />
      </div>
      <Card title="Dividend history">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="thead-info">
              <tr><th>Period</th><th>Shares held</th><th>Share %</th><th className="text-right">Entitled</th><th className="text-right">Paid</th><th className="text-right">Outstanding</th><th>Status</th></tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} className="text-center">Loading...</td></tr>}
              {data?.rows.length === 0 && <tr><td colSpan={7} className="text-center text-muted">No dividends declared for you yet</td></tr>}
              {data?.rows.map((row) => (
                <Fragment key={row.id}>
                  <tr>
                    <td>{row.period_label ?? row.period}</td>
                    <td>{row.shares_held?.toLocaleString("en-US") ?? "-"}</td>
                    <td>{ownership(row.share_percent)}</td>
                    <td className="text-right">{money(row.entitled)}</td>
                    <td className="text-right">{money(row.paid)}</td>
                    <td className="text-right">{money(row.outstanding)}</td>
                    <td><Badge tone={row.status === "PAID" ? "success" : row.status === "UNPAID" ? "warning" : "info"}>{row.status}</Badge></td>
                  </tr>
                  {row.payments.map((payment) => (
                    <tr key={`p${payment.id}`} className="small text-muted">
                      <td colSpan={3} className="pl-4">↳ Payment {payment.paid_at?.slice(0, 10)} · {payment.pay_method}{payment.reference ? ` · ${payment.reference}` : ""}</td>
                      <td />
                      <td className="text-right">{payment.status === "reversed" ? <s>{money(payment.amount)}</s> : money(payment.amount)}</td>
                      <td />
                      <td>{payment.status === "reversed" ? "REVERSED" : "PAID"}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
