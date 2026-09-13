"use client";

import Link from "next/link";
import { useState } from "react";

import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface DashboardData {
  header_accounts: Record<string, number> | null;
  cards: { account_balance: number; loan_withdrawal: number; receivable: number; default_loan: number };
  account_balances: Record<string, number> | null;
  branch_accounts: Array<Record<string, number | string>> | null;
  today: Record<string, number>;
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
  ["/loans/pending", "aplication.png", "Loan Request"],
  ["/loans/disbursed", "aproveds.jpg", "Loan Approved"],
  ["/penalties", "penarty.png", "Penalty"],
  ["/loans/rejected", "rejected.jpg", "Loan Rejected"],
  ["/expenses/requests", "aprove.png", "Approve"],
  ["/reports/cash", "transaction.png", "Cash Transaction"],
  ["/loans/withdrawal", "withdrawal.png", "Loan Withdrawal"],
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

export default function DashboardPage() {
  const { data, isLoading } = useApi<DashboardData>("dashboard");
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [branchesOpen, setBranchesOpen] = useState(false);

  if (isLoading || !data) {
    return <div className="mf-loading">Loading...</div>;
  }

  const t = data.today;

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
                <span>Account Balance</span>
              </div>
            </a>
          </div>
          <div className="col-md-3">
            <div className="body dashboard-stat bg-warning text-light">
              <h4><i className="icon-wallet" /> {money(data.cards.loan_withdrawal)}</h4>
              <span>Loan Withdrawal</span>
            </div>
          </div>
          <div className="col-md-3">
            <div className="body dashboard-stat bg-primary text-light">
              <h4><i className="icon-wallet" /> {money(data.cards.receivable)}</h4>
              <span>Expectation Receivable</span>
            </div>
          </div>
          <div className="col-md-3">
            <div className="body dashboard-stat bg-danger text-light">
              <h4><i className="icon-wallet" /> {money(data.cards.default_loan)}</h4>
              <span>Default Loan</span>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="table-responsive">
          <table className="table table-bordered table-custom">
            <tbody>
              <tr className="mf-row-strong">
                <th className="c">Customer Type</th>
                <th className="c">Today Deposit</th>
                <th className="c">Today withdrawal</th>
                <th className="c">Today Income</th>
                <th className="c">Today Expenses</th>
              </tr>
              <tr>
                <td>Monthly customer <span className="badge badge-success">{t.monthly_customers}</span></td>
                <td>Monthly Deposit <span className="badge badge-success">{money(t.monthly_deposit)}</span></td>
                <td>Monthly Withdrawal <span className="badge badge-success">{money(t.monthly_withdrawal)}</span></td>
                <td>Penalty <span className="badge badge-success">{money(t.penalty_income)}</span></td>
                <td>Today Expenses <span className="badge badge-success">{money(t.expenses)}</span></td>
              </tr>
              <tr>
                <td>Weekly customer <span className="badge badge-success">{t.weekly_customers}</span></td>
                <td>Weekly Deposit <span className="badge badge-success">{money(t.weekly_deposit)}</span></td>
                <td>Weekly Withdrawal <span className="badge badge-success">{money(t.weekly_withdrawal)}</span></td>
                <td>Loan fee <span className="badge badge-success">{money(t.loan_fee_income)}</span></td>
                <td>Bank <span className="badge badge-success">{money(t.bank_expenses)}</span></td>
              </tr>
              <tr>
                <td>Daily customer <span className="badge badge-success">{t.daily_customers}</span></td>
                <td>Daily Deposit <span className="badge badge-success">{money(t.daily_deposit)}</span></td>
                <td>Daily Withdrawal <span className="badge badge-success">{money(t.daily_withdrawal)}</span></td>
                <td>Capital<span className="badge badge-success">{money(t.capital_income)}</span></td>
                <td>Transfer <span className="badge badge-success">{money(t.transfer_expenses)}</span></td>
              </tr>
              <tr>
                <td>Groups <span className="badge badge-success">{t.groups}</span></td>
                <td>Salary advance <span className="badge badge-success">{money(t.salary_advance_deposit)}</span></td>
                <td>Salary advance <span className="badge badge-success">{money(t.salary_advance_withdrawal)}</span></td>
                <td>Transfer <span className="badge badge-success">{money(t.transfer_income)}</span></td>
                <td>-</td>
              </tr>
              <tr>
                <td>-</td>
                <td>Agent <span className="badge badge-success">{money(t.agent_deposit)}</span></td>
                <td>-</td>
                <td>Insurance<span className="badge badge-success">{money(t.insurance_income)}</span></td>
                <td>Saving withdrawal <span className="badge badge-success">{money(t.saving_withdrawal)}</span></td>
              </tr>
              <tr className="mf-row-strong">
                <th>All customer: {t.all_customers}</th>
                <th>Total: {money(t.total_deposit)}</th>
                <th>Total: {money(t.total_withdrawal)}</th>
                <th>Total : {money(t.total_income)}</th>
                <th>Total: {money(t.total_expenses)}</th>
              </tr>
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

      <Modal open={accountsOpen} onClose={() => setAccountsOpen(false)} title="Company Account List">
        <table className="table table-bordered">
          <thead className="thead-info"><tr><th>A/c Name</th><th>Amount</th></tr></thead>
          <tbody>
            {Object.entries(data.account_balances ?? {}).map(([name, amount]) => <tr key={name}><td>{name}</td><td>{money(amount)}</td></tr>)}
            <tr><th>TOTAL:</th><th>{money(Object.values(data.account_balances ?? {}).reduce((sum, value) => sum + Number(value), 0))}</th></tr>
          </tbody>
        </table>
      </Modal>

      <Modal open={branchesOpen} onClose={() => setBranchesOpen(false)} title="Branch List" size="xl">
        <div className="table-responsive">
          <table className="table table-bordered">
            <thead className="thead-info">
              <tr><th>Branch Name</th><th>Principal A/c</th><th>Interest A/c</th><th>Loan fee A/c</th><th>Penalty A/c</th><th>Reserve A/c</th><th>Agent</th><th>Insurance</th></tr>
            </thead>
            <tbody>
              {(data.branch_accounts ?? []).map((branch) => (
                <tr key={String(branch.name)}>
                  <td>{branch.name}</td>
                  {["principal", "interest", "loan_fee", "penalty", "reserve", "agent", "insurance"].map((key) => <td key={key}>{money(branch[key] as number)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </>
  );
}
