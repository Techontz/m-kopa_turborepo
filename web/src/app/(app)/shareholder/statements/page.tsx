"use client";

import { useState } from "react";

import { defaultStatementRange, ownership, type PortalStatement } from "@/components/shareholders/portal";
import { CsvButton } from "@/components/reports/ReportKit";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { notifyError } from "@/components/ui/notify";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

/**
 * My statement for a date range (capital with running balance, dividends paid, share movements). "Print / Save PDF" logs the
 * download on the API (statement/download) and opens the browser print dialog; CSV export uses the shared report button.
 */
export default function ShareholderStatementsPage() {
  const { can } = useAuth();
  const [range, setRange] = useState(defaultStatementRange);
  const [applied, setApplied] = useState(range);
  const { data, isLoading } = useApi<PortalStatement>(can("shareholder.statements") ? "portal/shareholder/statement" : null, applied);
  const [printing, setPrinting] = useState(false);

  const print = async () => {
    setPrinting(true);
    try {
      await api.get("portal/shareholder/statement/download", applied);
      window.print();
    } catch (error) {
      notifyError(error);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <>
      <PageHeader crumbs={["Shareholder", "Statements"]} />
      <Card title="Statement period" className="mf-no-print">
        <form className="form-inline" style={{ gap: 8 }} onSubmit={(event) => { event.preventDefault(); setApplied(range); }}>
          <label className="mr-1" htmlFor="st-from">From</label>
          <input id="st-from" type="date" className="form-control mr-2" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} required />
          <label className="mr-1" htmlFor="st-to">To</label>
          <input id="st-to" type="date" className="form-control mr-2" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} required />
          <button type="submit" className="btn btn-primary mr-2">Show</button>
          <button type="button" className="btn btn-info mr-2" onClick={print} disabled={!data || printing}><i className="icon-printer" /> Print / Save PDF</button>
          {data && (
            <CsvButton
              filename={`statement-${data.share_holder.holder_number}-${data.from}-${data.to}`}
              header={["Date", "Description", "Reference", "Capital in", "Capital out", "Dividend paid", "Shares", "Capital balance"]}
              rows={data.lines.map((line) => [line.date, line.description, line.reference ?? "", line.capital_in, line.capital_out, line.dividend_paid, line.shares, line.capital_balance])}
            />
          )}
        </form>
      </Card>

      <Card title="Shareholder Statement">
        {isLoading || !data ? (
          <div className="mf-loading">Loading...</div>
        ) : (
          <>
            <div className="row mb-3">
              <div className="col-md-6">
                <dl className="sh-kv">
                  <dt>Company</dt><dd>{data.company}</dd>
                  <dt>Shareholder</dt><dd>{data.share_holder.name} ({data.share_holder.holder_number})</dd>
                  <dt>Period</dt><dd>{data.from} to {data.to}</dd>
                  <dt>Generated</dt><dd>{data.generated_at}</dd>
                </dl>
              </div>
              <div className="col-md-6">
                <dl className="sh-kv">
                  <dt>Opening capital</dt><dd>TZS {money(data.opening_capital)}</dd>
                  <dt>Closing capital</dt><dd><b>TZS {money(data.closing_capital)}</b></dd>
                  <dt>Dividends paid</dt><dd>TZS {money(data.dividends_paid)}</dd>
                  <dt>Shares</dt><dd>{data.opening_shares.toLocaleString("en-US")} → {data.closing_shares.toLocaleString("en-US")} ({ownership(data.closing_ownership_percent)})</dd>
                </dl>
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-sm table-hover mb-0">
                <thead className="thead-info">
                  <tr><th>Date</th><th>Description</th><th>Reference</th><th className="text-right">Capital in</th><th className="text-right">Capital out</th><th className="text-right">Dividend paid</th><th className="text-right">Shares</th><th className="text-right">Capital balance</th></tr>
                </thead>
                <tbody>
                  <tr className="text-muted"><td>{data.from}</td><td colSpan={6}>Opening balance</td><td className="text-right">{money(data.opening_capital)}</td></tr>
                  {data.lines.map((line, index) => (
                    <tr key={`${line.date}-${index}`}>
                      <td>{line.date.slice(0, 10)}</td>
                      <td>{line.description}</td>
                      <td>{line.reference ?? "-"}</td>
                      <td className="text-right">{line.capital_in ? money(line.capital_in) : ""}</td>
                      <td className="text-right">{line.capital_out ? money(line.capital_out) : ""}</td>
                      <td className="text-right">{line.dividend_paid ? money(line.dividend_paid) : ""}</td>
                      <td className="text-right">{line.shares ? line.shares.toLocaleString("en-US") : ""}</td>
                      <td className="text-right">{money(line.capital_balance)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><th colSpan={3}>TOTAL</th><th className="text-right">{money(data.capital_in)}</th><th className="text-right">{money(data.capital_out)}</th><th className="text-right">{money(data.dividends_paid)}</th><th /><th className="text-right">{money(data.closing_capital)}</th></tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
