"use client";

import Link from "next/link";
import { useState } from "react";

import { Card } from "@/components/ui/Card";
import { Loading } from "@/components/ui/Loading";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface DashboardData {
  header_accounts: Record<string, number> | null;
  cards: { account_balance: number; account_balance_title: string; account_balance_label: string; loan_withdrawal: number; loan_outstanding: number; default_loan: number };
  account_balances: Record<string, number> | null;
  account_balances_total: number | null;
  account_memos: Array<{ label: string; amount: number; tone: string }> | null;
  branch_accounts: { month: string; rows: Array<Record<string, number | string>>; total: Record<string, number> } | null;
  operating_income: { total: number; sources: Array<{ key: string; label: string; amount: number }> } | null;
  today: Record<string, number | null>;
  customer_types: Array<{ label: string; route: string; all: number; active: number; pending: number; close: number; default: number; male: number; female: number }>;
}

const TILES: Array<[string, string, string]> = [
  ["/customers/register", "user.png", "Register customer"],
  ["/loans/apply", "request.jpg", "Loan Application"],
  ["/teller", "teller.jpg", "Teller"],
  ["/reports/receivable", "receivable.png", "Receivable"],
  ["/reports/received", "received.png", "Received"],
  ["/expenses/requests", "expenses.png", "Expenses"],
  ["/salary-advance/active", "debits.png", "Salary advance"],
  ["/reports/pending", "default.jpeg", "Loan Pending"],
  ["/reports/default", "rejected.png", "Default Loan"],
  ["/loans/pending", "aplication.png", "Pending Approval"],
  ["/loans/disbursed", "aproveds.jpg", "Active Loans"],
  ["/penalties", "penarty.png", "Penalty"],
  ["/loans/rejected", "rejected.jpg", "Rejected Loans"],
  ["/expenses/requests", "aprove.png", "Approve"],
  ["/reports/cash", "transaction.png", "Cash Transaction"],
  ["/loans/withdrawal", "withdrawal.png", "Disbursement"],
  ["/loan-fees/income", "fee.png", "Loan fee"],
  ["/reports/daily", "daily.png", "Daily Report"],
];

const TYPE_LINKS: Record<string, string> = {
  "customers.monthly": "/customers?duration=monthly",
  "customers.weekly": "/customers?duration=weekly",
  "customers.daily": "/customers?duration=daily",
  "groups.index": "/groups",
  "customers.index": "/customers",
};

/** Every role sees the same dashboard; the figures inside it are scoped to what the signed-in employee may see. */
/** Branch List money columns, in display order. */
const BRANCH_COLUMNS = ["petty_cash", "principal_repaid", "interest", "loan_fee", "penalty", "reserve", "salary_advance", "cash_pending"];

export default function DashboardPage() {
  const { data, isLoading } = useApi<DashboardData>("dashboard");
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [branchesOpen, setBranchesOpen] = useState(false);

  if (isLoading || !data) {
    return <Loading />;
  }
  const isHqFunds = data.cards.account_balance_title === "HQ Funds";

  const t = data.today;
  /** Company money movements (float, principal transfers, bank-paid expenses) are null for branch- and zone-scoped employees. */
  const seesCompanyMoney = t.float_to_hq !== null;
  /** Capital received is shareholders' money: null for everyone but the owners (HQ and Finance never see it). */
  const seesCapital = t.capital_received !== null;

  return (
    <>
      <PageHeader
        crumbs={["Dashboard"]}
        right={
          data.header_accounts &&
          Object.entries(data.header_accounts).map(([label, amount]) => (
            <div className="bh_chart d-none d-sm-inline-block" key={label}>
              <div className="float-left m-r-15">
                <small>{label}</small>
                <h6 className="mb-0 mt-1"><i className="icon-wallet" /> {money(amount)}</h6>
              </div>
            </div>
          ))
        }
      />

      <Card actions={data.branch_accounts && <button type="button" className="btn btn-info btn-sm" onClick={() => setBranchesOpen(true)}><i className="icon-list" />Branch</button>}>
        <div className="row clearfix">
          <div className="col-md-3">
            <a href="#" onClick={(e) => { e.preventDefault(); if (data.account_balances) { setAccountsOpen(true); } }}>
              <div className="body dashboard-stat bg-success text-light">
                <h4><i className="icon-wallet" /> {money(data.cards.account_balance)}</h4>
                <span>{data.cards.account_balance_title}</span>
                <small className="d-block">{data.cards.account_balance_label}</small>
              </div>
            </a>
          </div>
          <div className="col-md-3">
            <div className="body dashboard-stat bg-warning text-light">
              <h4><i className="icon-wallet" /> {money(data.cards.loan_withdrawal)}</h4>
              <span>Disbursed Today</span>
            </div>
          </div>
          <div className="col-md-3">
            <div className="body dashboard-stat bg-primary text-light">
              <h4><i className="icon-wallet" /> {money(data.cards.loan_outstanding)}</h4>
              <span>Total Loan Outstanding</span>
            </div>
          </div>
          <div className="col-md-3">
            <div className="body dashboard-stat bg-danger text-light">
              <h4><i className="icon-wallet" /> {money(data.cards.default_loan)}</h4>
              <span>Default Loan</span>
            </div>
          </div>
        </div>
        {data.operating_income && (
          /* §5 / §45: one Operating Income pool; the categories say where it came from and are never added on top of it. */
          <p className="mb-0 mt-3">
            <b>Operating Income: {money(data.operating_income.total)}</b>
            <small className="text-muted">
              {" "}— from {data.operating_income.sources.map((source) => `${source.label} ${money(source.amount)}`).join(" · ")}
            </small>
          </p>
        )}
      </Card>

      <Card>
        <div className="table-responsive">
          <table className="table table-bordered table-custom">
            <tbody>
              <tr className="mf-row-strong">
                <th className="c">Customer Type</th>
                <th className="c">Today Deposit</th>
                <th className="c">Today withdrawal</th>
                <th className="c">Today Income (ledger)</th>
                <th className="c">Today Expenses (ledger)</th>
              </tr>
              <tr>
                <td>Monthly customer <span className="badge badge-success">{t.monthly_customers}</span></td>
                <td>Monthly Deposit <span className="badge badge-success">{money(t.monthly_deposit)}</span></td>
                <td>Monthly Withdrawal <span className="badge badge-success">{money(t.monthly_withdrawal)}</span></td>
                <td>Interest (after reserve) <span className="badge badge-success">{money(t.interest_income)}</span></td>
                <td>Operating expenses <span className="badge badge-success">{money(t.expenses)}</span></td>
              </tr>
              <tr>
                <td>Weekly customer <span className="badge badge-success">{t.weekly_customers}</span></td>
                <td>Weekly Deposit <span className="badge badge-success">{money(t.weekly_deposit)}</span></td>
                <td>Weekly Withdrawal <span className="badge badge-success">{money(t.weekly_withdrawal)}</span></td>
                <td>Loan fee <span className="badge badge-success">{money(t.loan_fee_income)}</span></td>
                <td>Salaries, commission, write-offs, bank charges <span className="badge badge-success">{money(t.other_expenses)}</span></td>
              </tr>
              <tr>
                <td>Daily customer <span className="badge badge-success">{t.daily_customers}</span></td>
                <td>Daily Deposit <span className="badge badge-success">{money(t.daily_deposit)}</span></td>
                <td>Daily Withdrawal <span className="badge badge-success">{money(t.daily_withdrawal)}</span></td>
                <td>Penalty <span className="badge badge-success">{money(t.penalty_income)}</span></td>
                <td>-</td>
              </tr>
              <tr>
                <td>Groups <span className="badge badge-success">{t.groups}</span></td>
                <td>Salary advance <span className="badge badge-success">{money(t.salary_advance_deposit)}</span></td>
                <td>Salary advance <span className="badge badge-success">{money(t.salary_advance_withdrawal)}</span></td>
                <td>Recovery <span className="badge badge-success">{money(t.recovery_income)}</span></td>
                <td>-</td>
              </tr>
              <tr>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>Salary advance income <span className="badge badge-success">{money(t.salary_advance_income)}</span></td>
                <td>-</td>
              </tr>
              <tr className="mf-row-strong">
                <th>All customer: {t.all_customers}</th>
                <th>Total: {money(t.total_deposit)}</th>
                <th>Total: {money(t.total_withdrawal)}</th>
                <th>Total : {money(t.total_income)}</th>
                <th>Total: {money(t.total_expenses)}</th>
              </tr>
              <tr>
                <td colSpan={3} />
                <th colSpan={2}>Net income today: {money(t.net_income)}</th>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mb-2 mt-2"><small className="text-muted">Today money movements, not income and not expenses</small></p>
        <div className="table-responsive">
          <table className="table table-bordered table-custom mb-0">
            <tbody>
              {seesCompanyMoney ? (
                <>
                  <tr>
                    {seesCapital && <td>Capital received <span className="badge badge-info">{money(t.capital_received)}</span></td>}
                    <td>Float to HQ <span className="badge badge-info">{money(t.float_to_hq)}</span></td>
                    <td>Other principal transfers out <span className="badge badge-info">{money(t.principal_transfers_out)}</span></td>
                    <td>Saving withdrawal <span className="badge badge-info">{money(t.saving_withdrawal)}</span></td>
                  </tr>
                  <tr>
                    <td>Reserve set aside from interest <span className="badge badge-info">{money(t.reserve_amount)}</span></td>
                    <td>Expenses paid from bank (included above) <span className="badge badge-info">{money(t.expenses_paid_from_bank)}</span></td>
                    <td>-</td>
                    {seesCapital && <td>-</td>}
                  </tr>
                </>
              ) : (
                <tr>
                  <td>Saving withdrawal <span className="badge badge-info">{money(t.saving_withdrawal)}</span></td>
                  <td>Reserve set aside from interest <span className="badge badge-info">{money(t.reserve_amount)}</span></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="row clearfix w_social3">
        {TILES.map(([href, image, label]) => (
          <div className="col-lg-2 col-md-4 col-6" key={label}>
            <Link href={href}>
              <div className="card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <div className="icon"><img src={`/assets/img/${image}`} style={{ width: 44, height: 44 }} alt="" /></div>
                <div className="content"><div className="text">{label}</div></div>
              </div>
            </Link>
          </div>
        ))}
      </div>

      <Card>
        <div className="table-responsive">
          <table className="table table-hover table-striped table-custom">
            <thead>
              <tr>
                {["Customer Type", "All customer", "Active", "Pending", "Close", "Default", "Male", "Female", "Action"].map((heading) => <th className="c" key={heading}>{heading}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.customer_types.map((row, index) => (
                <tr key={row.label} style={index === data.customer_types.length - 1 ? { fontWeight: 700 } : undefined}>
                  <td>{row.label}</td>
                  <td>{row.all}</td>
                  <td>{row.active}</td>
                  <td>{row.pending}</td>
                  <td>{row.close}</td>
                  <td>{row.default}</td>
                  <td>{row.male}</td>
                  <td>{row.female}</td>
                  <td><Link href={TYPE_LINKS[row.route] ?? "/customers"} className="btn btn-sm btn-primary"><i className="icon-eye" /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={accountsOpen} onClose={() => setAccountsOpen(false)} title={isHqFunds ? "HQ Account List" : "Company Account List"}>
        <div className="table-responsive">
          <table className="table table-bordered">
            <thead className="thead-info"><tr><th>A/c Name</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {Object.entries(data.account_balances ?? {}).map(([name, amount]) => (
                <tr key={name}><td>{name}</td><td className="text-right">{money(amount)}</td></tr>
              ))}
              <tr><th>TOTAL:</th><th className="text-right">{money(data.account_balances_total)}</th></tr>
              {isHqFunds && (
                <tr>
                  <td colSpan={2}><small className="text-muted">Unmatched is money received but not yet matched to a loan, and Savings belong to the customers who deposited them, so neither is HQ&apos;s. Profit and Dividends are shares of Operation Income. None of these four is added to the total.</small></td>
                </tr>
              )}
              {/* Memo lines, as on the live account modal: not part of the total — what the money owes or is still to collect. */}
              {(data.account_memos ?? []).map((memo) => (
                <tr key={memo.label} className={`text-${memo.tone}`}>
                  <td className="font-weight-bold">{memo.label}</td>
                  <td className="text-right font-weight-bold">{money(memo.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      <Modal open={branchesOpen} onClose={() => setBranchesOpen(false)} title={`Branch List — ${data.branch_accounts?.month ?? ""}`} size="xl">
        <div className="table-responsive">
          <table className="table table-bordered">
            <thead className="thead-info">
              <tr>
                <th>Branch Name</th>
                <th>Petty Cash<small className="d-block">available now</small></th>
                <th>Principal Repaid</th>
                <th>Interest</th>
                <th>Loan fee</th>
                <th>Penalty</th>
                <th>Reserve</th>
                <th>Salary Advance</th>
                <th>Cash Pending<small className="d-block">not yet verified</small></th>
              </tr>
            </thead>
            <tbody>
              {(data.branch_accounts?.rows ?? []).map((branch) => (
                <tr key={String(branch.name)}>
                  <td>{branch.name}</td>
                  {BRANCH_COLUMNS.map((key) => <td key={key}>{money(branch[key] as number)}</td>)}
                </tr>
              ))}
              {data.branch_accounts && (
                <tr>
                  <th>TOTAL:</th>
                  {BRANCH_COLUMNS.map((key) => <th key={key}>{money(data.branch_accounts?.total[key])}</th>)}
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <small className="text-muted">
          Every column covers {data.branch_accounts?.month} except Petty Cash, which is the balance each branch holds now — the only money a branch holds. Principal Repaid is already back in HQ&apos;s Operation Principal, and Interest (after the 20% reserve), Loan fee, Penalty and Reserve are what the branch collected for HQ. Salary Advance is the full amount customers repaid on salary advances this month (capital + profit), shown as a report only — the capital is already back in Operation Principal and the profit in Salary Advance income. Cash Pending is teller cash collected this month that Finance has not yet verified as banked.
        </small>
      </Modal>
    </>
  );
}
