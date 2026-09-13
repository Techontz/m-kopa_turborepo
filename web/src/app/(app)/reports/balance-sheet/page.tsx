"use client";

import { Fragment } from "react";

import { ReportFrame, styles, SummaryTiles, useDefaultFilter, useFinancialReport } from "@/components/financial-reports/ReportShell";
import { Badge } from "@/components/ui/Badge";
import { money, todayIso } from "@/lib/format";

interface Line {
  key: string;
  code: string;
  label: string;
  amount: number;
}

interface BalanceSheet {
  as_of: string;
  assets: Array<{ group: string; lines: Line[]; total: number }>;
  total_assets: number;
  liabilities: Line[];
  total_liabilities: number;
  equity: Line[];
  total_equity: number;
  total_liabilities_equity: number;
  difference: number;
  balanced: boolean;
}

function Lines({ lines }: { lines: Line[] }) {
  return (
    <>
      {lines.map((line) => (
        <tr key={line.key}>
          <td>{line.code}</td>
          <td className={styles.indent}>{line.label}</td>
          <td className={line.amount < 0 ? styles.out : undefined}>{money(line.amount)}</td>
        </tr>
      ))}
    </>
  );
}

export default function BalanceSheetPage() {
  const [filter, setFilter] = useDefaultFilter(todayIso(), todayIso());
  const { data, isLoading, error } = useFinancialReport<BalanceSheet>("balance-sheet", filter);

  return (
    <ReportFrame title="Balance Sheet" filter={filter} onFilter={setFilter} dates="asOf" error={error} loading={isLoading}>
      {data && (
        <>
          <SummaryTiles
            items={[
              { label: "Total Assets", value: data.total_assets },
              { label: "Total Liabilities", value: data.total_liabilities },
              { label: "Total Equity", value: data.total_equity },
            ]}
          />
          <p>{data.balanced ? <Badge tone="success">BALANCED</Badge> : <Badge tone="danger">OUT OF BALANCE BY {money(data.difference)}</Badge>}</p>

          <div className="table-responsive">
            <table className={`table table-hover table-custom ${styles.statement}`}>
              <thead className="thead-info">
                <tr>
                  <th>CODE</th>
                  <th>DESCRIPTION</th>
                  <th>AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                <tr className={styles.group}>
                  <td colSpan={3}>ASSETS</td>
                </tr>
                {data.assets.filter((group) => group.lines.length > 0).map((group) => (
                  <Fragment key={group.group}>
                    <tr className={styles.total}>
                      <td />
                      <td>{group.group.toUpperCase()}</td>
                      <td>{money(group.total)}</td>
                    </tr>
                    <Lines lines={group.lines} />
                  </Fragment>
                ))}
                <tr className={styles.total}>
                  <td />
                  <td className={styles.in}>TOTAL ASSETS</td>
                  <td className={styles.in}>{money(data.total_assets)}</td>
                </tr>

                <tr className={styles.group}>
                  <td colSpan={3}>LIABILITIES</td>
                </tr>
                <Lines lines={data.liabilities} />
                <tr className={styles.total}>
                  <td />
                  <td>TOTAL LIABILITIES</td>
                  <td>{money(data.total_liabilities)}</td>
                </tr>

                <tr className={styles.group}>
                  <td colSpan={3}>EQUITY</td>
                </tr>
                <Lines lines={data.equity} />
                <tr className={styles.total}>
                  <td />
                  <td>TOTAL EQUITY</td>
                  <td>{money(data.total_equity)}</td>
                </tr>
                <tr className={styles.total}>
                  <td />
                  <td className={styles.in}>TOTAL LIABILITIES &amp; EQUITY</td>
                  <td className={styles.in}>{money(data.total_liabilities_equity)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className={styles.note}>
            Current period earnings = income less expenses not yet closed at month end. For a single branch or HQ, the HQ / inter-branch current account shows money received from or sent to other
            parts of the company.
          </p>
        </>
      )}
    </ReportFrame>
  );
}
