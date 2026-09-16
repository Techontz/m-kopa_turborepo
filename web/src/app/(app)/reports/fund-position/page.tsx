"use client";

import { ReportFrame, styles, SummaryTiles, useDefaultFilter, useFinancialReport } from "@/components/financial-reports/ReportShell";
import { Badge } from "@/components/ui/Badge";
import { money, todayIso } from "@/lib/format";

interface PhysicalLine {
  key: string;
  label: string;
  account: string;
  branch_id: number | null;
  bank_account_id: number | null;
  amount: number;
}

interface AccountLine {
  account: string;
  label: string;
  amount: number;
  type?: string;
}

type FundKey = "principal" | "interest" | "loan_fee" | "penalty" | "reserve" | "insurance";

interface FundPosition {
  as_of: string;
  physical: { lines: PhysicalLine[]; total: number };
  funds: {
    branches: Array<{ branch_id: number | null; branch: string; funds: Record<FundKey, number>; total: number }>;
    fund_totals: AccountLine[];
    branch_funds_total: number;
    hq_accounts: AccountLine[];
    hq_total: number;
    total: number;
  };
  reference: { lines: AccountLine[]; note: string };
  total_money: number;
  ledger_money_total: number;
  balanced: boolean;
  note: string;
}

const FUNDS: Array<{ key: FundKey; label: string }> = [
  { key: "principal", label: "PRINCIPAL" },
  { key: "interest", label: "INTEREST" },
  { key: "loan_fee", label: "LOAN FEE" },
  { key: "penalty", label: "PENALTY" },
  { key: "reserve", label: "RESERVE" },
  { key: "insurance", label: "INSURANCE" },
];

/**
 * Reports → Financial → Cash & Fund Position (C5): physical cash and bank versus money held in fund accounts, as of a date.
 * Every figure is a ledger balance computed by the API; money sits in exactly one account, so the two sections are added.
 */
export default function FundPositionPage() {
  const [filter, setFilter] = useDefaultFilter(todayIso(), todayIso());
  const { data, isLoading, error } = useFinancialReport<FundPosition>("fund-position", filter);

  return (
    <ReportFrame title="Cash & Fund Position" filter={filter} onFilter={setFilter} dates="asOf" error={error} loading={isLoading}>
      {data && (
        <>
          <SummaryTiles
            items={[
              { label: "Physical Cash & Bank", value: data.physical.total },
              { label: "Money in Fund Accounts", value: data.funds.total },
              { label: "Total Money", value: data.total_money },
            ]}
          />
          <p>
            {data.balanced ? <Badge tone="success">EQUALS ALL MONEY ACCOUNTS IN THE LEDGER</Badge> : <Badge tone="danger">DIFFERS FROM LEDGER MONEY {money(data.ledger_money_total)}</Badge>}
          </p>
          <p className={styles.note}>{data.note}</p>

          <h6 className="mt-3">1. Physical cash &amp; bank</h6>
          <div className="table-responsive">
            <table className={`table table-hover table-custom ${styles.statement}`}>
              <thead className="thead-info">
                <tr>
                  <th>ACCOUNT</th>
                  <th>AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {data.physical.lines.map((line) => (
                  <tr key={`${line.key}-${line.branch_id ?? "hq"}-${line.bank_account_id ?? "none"}`}>
                    <td className={styles.indent}>{line.label}</td>
                    <td className={line.amount < 0 ? styles.out : undefined}>{money(line.amount)}</td>
                  </tr>
                ))}
                <tr className={styles.total}>
                  <td className={styles.in}>TOTAL PHYSICAL CASH &amp; BANK</td>
                  <td className={styles.in}>{money(data.physical.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h6 className="mt-3">2. Money held in fund accounts</h6>
          <div className="table-responsive">
            <table className={`table table-hover table-custom ${styles.statement}`}>
              <thead className="thead-info">
                <tr>
                  <th>BRANCH</th>
                  {FUNDS.map((fund) => (
                    <th key={fund.key}>{fund.label}</th>
                  ))}
                  <th>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {data.funds.branches.map((branch) => (
                  <tr key={branch.branch_id ?? "hq"}>
                    <td>{branch.branch}</td>
                    {FUNDS.map((fund) => (
                      <td key={fund.key} className={branch.funds[fund.key] < 0 ? styles.out : undefined}>{money(branch.funds[fund.key])}</td>
                    ))}
                    <td><b>{money(branch.total)}</b></td>
                  </tr>
                ))}
                <tr className={styles.total}>
                  <td>TOTAL BRANCH FUNDS</td>
                  {FUNDS.map((fund) => (
                    <td key={fund.key}>{money(data.funds.fund_totals.find((row) => row.account === fund.key)?.amount ?? 0)}</td>
                  ))}
                  <td>{money(data.funds.branch_funds_total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="table-responsive">
            <table className={`table table-hover table-custom ${styles.statement}`}>
              <thead className="thead-info">
                <tr>
                  <th>HQ ACCOUNT</th>
                  <th>AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {data.funds.hq_accounts.map((line) => (
                  <tr key={line.account}>
                    <td className={styles.indent}>{line.label}</td>
                    <td className={line.amount < 0 ? styles.out : undefined}>{money(line.amount)}</td>
                  </tr>
                ))}
                <tr className={styles.total}>
                  <td>TOTAL HQ ACCOUNTS</td>
                  <td>{money(data.funds.hq_total)}</td>
                </tr>
                <tr className={styles.total}>
                  <td className={styles.in}>TOTAL MONEY IN FUND ACCOUNTS</td>
                  <td className={styles.in}>{money(data.funds.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h6 className="mt-3">3. Reference balances (not money)</h6>
          <div className="table-responsive">
            <table className={`table table-hover table-custom ${styles.statement}`}>
              <tbody>
                {data.reference.lines.map((line) => (
                  <tr key={line.account}>
                    <td className={styles.indent}>
                      {line.label} <span className="text-muted small">({line.type})</span>
                    </td>
                    <td>{money(line.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.note}>{data.reference.note}</p>
        </>
      )}
    </ReportFrame>
  );
}
