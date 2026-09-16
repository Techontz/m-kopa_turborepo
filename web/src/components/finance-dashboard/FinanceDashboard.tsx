"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

import {
  accountBalance,
  allIncome,
  barWidth,
  collectionsSeries,
  progressKpis,
  requestedCounts,
  salaryAdvanceCustomers,
  tileValues,
  type CollectionRow,
  type DashboardPayload,
  type ProgressKpi,
  type StaffRequests,
} from "./kpis";

const TILE_META: Record<string, { icon: ReactNode; href: string; permission: string | string[] }> = {
  penalty: { icon: <i className="icon-list" />, href: "/penalties", permission: "penalties.manage" },
  loan_fee: { icon: <i className="icon-wallet" />, href: "/loan-fees/income", permission: "income.view" },
  insurance: { icon: <i className="icon-wallet" />, href: "/savings/deposits", permission: "savings.manage" },
  agent: { icon: <span className="fin-tile-letter">A</span>, href: "/agent/transactions", permission: "agent.manage" },
  expenses: { icon: <span className="fin-tile-letter">E</span>, href: "/expenses/accepted", permission: ["expenses.approve_branch", "expenses.approve_hq", "reports.financial"] },
  withdrawal: { icon: <i className="icon-arrow-up-circle" />, href: "/loans/withdrawal", permission: "loans.view" },
  receivable: { icon: <i className="icon-wallet" />, href: "/reports/receivable", permission: "reports.view" },
  received: { icon: <i className="icon-wallet" />, href: "/reports/received", permission: "reports.view" },
};

const compact = (value: number) => (Math.abs(value) >= 1_000_000 ? `${Math.round(value / 100_000) / 10}M` : Math.abs(value) >= 1000 ? `${Math.round(value / 1000)}K` : String(value));

function Progress({ title, kpi, tone, loading, error }: { title: string; kpi: ProgressKpi; tone: "yellow" | "green" | "red"; loading: boolean; error: boolean }) {
  return (
    <div className="col-md-4">
      <p className="fin-progress-title"><strong>{title} ({loading ? "…" : `${kpi.percent}%`})</strong></p>
      <div className="fin-progress-group">
        <span className="fin-progress-text">Collections/Due</span>
        <span className="fin-progress-number">{error ? "Unable to load" : loading ? "…" : <><b>{money(kpi.collected)}</b>/{money(kpi.due)}</>}</span>
        <div className="fin-progress" role="progressbar" aria-label={title} aria-valuenow={kpi.percent} aria-valuemin={0} aria-valuemax={100}>
          <div className={`fin-progress-bar is-${tone}`} style={{ width: `${barWidth(kpi.percent)}%` }} />
        </div>
      </div>
    </div>
  );
}

function InfoBox({ icon, lines, footer }: { icon: string; lines: ReactNode[]; footer: ReactNode }) {
  return (
    <div className="col-lg-3 col-md-6 col-sm-12">
      <div className="fin-small-box">
        <div className="fin-small-box-inner">
          <span className="fin-small-box-number">
            {lines.map((line, index) => <span className="d-block" key={index}>{line}</span>)}
          </span>
        </div>
        <div className="fin-small-box-icon" aria-hidden="true"><i className={icon} /></div>
        {footer}
      </div>
    </div>
  );
}

/** Head Office dashboard for the Finance role — live arrangement, M-KOPA data only. */
export function FinanceDashboard() {
  const { can } = useAuth();
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);

  const when = (permission: string | string[], path: string) => (can(permission) ? path : null);

  const dashboard = useApi<DashboardPayload>(when("dashboard.view", "dashboard"));
  const requested = useApi<unknown[]>(when("salary_advance.manage", "salary-advance/requested"));
  const staffAdvances = useApi<StaffRequests>(when(["hrm.manage", "payroll.pay"], "hrm/salary-advances"));
  const staffLoans = useApi<StaffRequests>(when(["hrm.manage", "payroll.pay"], "hrm/staff-loans"));
  const receivable = useApi<{ totals: { amount: number } }>(when("reports.view", "reports/receivable"));
  const received = useApi<{ totals: { amount: number } }>(when("reports.view", "reports/received"));
  const collections = useApi<{ rows: CollectionRow[] }>(when("reports.view", "reports/collections"));

  const kpis = dashboard.data?.finance_kpis;
  const hqAccounts = kpis?.hq_accounts ?? null;
  const balance = accountBalance(dashboard.data);
  const balanceLoading = dashboard.isLoading;
  const progress = progressKpis(kpis);
  const income = allIncome(dashboard.data);
  const customers = salaryAdvanceCustomers(kpis);
  const requests = requestedCounts(requested.data, staffAdvances.data, staffLoans.data);
  const today = dashboard.data?.today;
  const tiles = tileValues(dashboard.data, receivable.data?.totals.amount, received.data?.totals.amount, money);
  const series = collectionsSeries(collections.data?.rows);
  const canSalaryAdvance = can("salary_advance.manage");

  return (
    <div className="fin-dashboard" data-testid="finance-dashboard">
      <div className="fin-box">
        <div className="fin-box-header">
          {balanceLoading ? (
            <span className="fin-balance">Loading...</span>
          ) : balance === null ? (
            <span className="fin-balance text-muted">{dashboard.isError ? "Unable to load account balance" : ""}</span>
          ) : (
            <button type="button" className="fin-balance" onClick={() => hqAccounts && setAccountsOpen(true)} disabled={!hqAccounts} title={balance.label}>
              Account Balance {money(balance.amount)} TZS
            </button>
          )}
        </div>
      </div>

      <div className="row fin-progress-row">
        {can("penalties.manage") && (
          <Progress title="Penalty" kpi={progress.penalty} tone="yellow" loading={dashboard.isLoading} error={dashboard.isError} />
        )}
        {canSalaryAdvance && (
          <>
            <Progress title="Salary Advance Receivable / Received" kpi={progress.received} tone="green" loading={dashboard.isLoading} error={dashboard.isError} />
            <Progress title="Default Salary Advance" kpi={progress.defaulted} tone="red" loading={dashboard.isLoading} error={dashboard.isError} />
          </>
        )}
      </div>

      <div className="row">
        {canSalaryAdvance && (
          <InfoBox
            icon="icon-users"
            lines={[`${customers.active} - Active`, `${customers.fresh} - New`, `${customers.old} - Old`]}
            footer={<Link href="/salary-advance/active" className="fin-small-box-footer">Salary Advance customer</Link>}
          />
        )}
        {today && (
          <InfoBox
            icon="icon-credit-card"
            lines={[`${money(today.loan_fee_income)} - Loan Fee`, `${money(today.interest_income)} - Interest (after reserve)`, `${money(today.penalty_income)} - Penalty`]}
            footer={
              can("income.view") ? (
                <Link href="/loan-fees/income" className="fin-small-box-footer">Today income <i className="icon-arrow-right" /></Link>
              ) : (
                <span className="fin-small-box-footer">Today income</span>
              )
            }
          />
        )}
        {canSalaryAdvance && (
          <InfoBox
            icon="icon-paper-plane"
            lines={[
              `${requests.customer} - Customer Advance`,
              staffAdvances.data ? `${requests.staffAdvance} - Staff advance` : null,
              staffLoans.data ? `${requests.staffLoan} - Staff Loan` : null,
            ].filter(Boolean)}
            footer={
              <Link href="/salary-advance/requested" className="fin-small-box-footer">
                Requested salary advance/ Loan <span className="fin-count-badge">{requests.total}</span> <i className="icon-arrow-right" />
              </Link>
            }
          />
        )}
        {income && (
          <InfoBox
            icon="icon-wallet"
            lines={[`${money(income.interest)} - Interest`, `${money(income.penalty)} - Penalty`, `${money(income.loanFee)} - Loan Fee`]}
            footer={
              <button type="button" className="fin-small-box-footer" onClick={() => setIncomeOpen(true)} disabled={!dashboard.data?.branch_accounts}>
                All income <i className="icon-arrow-down" />
              </button>
            }
          />
        )}
      </div>

      <div className="row">
        {tiles.map((tile) => {
          const meta = TILE_META[tile.key];
          const body = (
            <div className="fin-info-box">
              <span className="fin-info-box-icon" aria-hidden="true">{meta.icon}</span>
              <div className="fin-info-box-content">
                <span className="fin-info-box-text">{tile.label}</span>
                {tile.lines.map((line) => <span className="fin-info-box-value" key={line}>{line}</span>)}
              </div>
            </div>
          );
          return (
            <div className="col-lg-3 col-md-6 col-sm-12" key={tile.key}>
              {can(meta.permission) ? <Link href={meta.href} className="fin-tile-link">{body}</Link> : body}
            </div>
          );
        })}
      </div>

      {dashboard.isLoading && <div className="mf-loading">Loading...</div>}
      {dashboard.isError && <div className="alert alert-danger">Unable to load today&apos;s figures.</div>}

      {can("reports.view") && (
        <div className="card">
          <div className="header"><h2>Collections Statistics</h2></div>
          <div className="body">
            {collections.isLoading ? (
              <div className="mf-loading">Loading...</div>
            ) : collections.isError ? (
              <div className="mf-loading">Unable to load collections.</div>
            ) : series.length === 0 ? (
              <div className="mf-loading">No collections in this period.</div>
            ) : (
              <div className="fin-chart">
                <ResponsiveContainer>
                  <LineChart data={series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={compact} width={56} />
                    <Tooltip formatter={(value) => money(Number(value))} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="linear" dataKey="collected" name="Collected" className="fin-line-collected" stroke="#f0ad2e" strokeWidth={2} dot={false} />
                    <Line type="linear" dataKey="expected" name="Expected" className="fin-line-expected" stroke="#2a78d6" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal open={accountsOpen} onClose={() => setAccountsOpen(false)} title="Account List">
        <div className="table-responsive">
          <table className="table table-hover table-custom">
            <thead className="thead-info"><tr><th>A/c Name</th><th>Amount</th></tr></thead>
            <tbody>
              {(hqAccounts?.rows ?? []).map((row) => <tr key={row.account}><td><b>{row.name}</b></td><td><b>{money(row.balance)}</b></td></tr>)}
              <tr><th>TOTAL:</th><th>{money(hqAccounts?.total ?? 0)}</th></tr>
            </tbody>
          </table>
        </div>
      </Modal>

      <Modal open={incomeOpen} onClose={() => setIncomeOpen(false)} title="Income balance List" size="lg">
        <div className="table-responsive">
          <table className="table table-hover table-custom">
            <thead className="thead-info">
              <tr><th>Branch Name</th><th>Interest A/c</th><th>Loan fee A/c</th><th>Penalty A/c</th><th>Insurance</th><th>Reserve</th></tr>
            </thead>
            <tbody>
              {(dashboard.data?.branch_accounts ?? []).map((branch) => (
                <tr key={String(branch.name)}>
                  <td className="c"><b>{branch.name}</b></td>
                  {["interest", "loan_fee", "penalty", "insurance", "reserve"].map((key) => <td key={key}><b>{money(branch[key] as number)}</b></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
}
