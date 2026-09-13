"use client";

import { Fragment, useState } from "react";

import { BranchScopeSelect } from "@/components/accounting/BranchScopeSelect";
import type { ChartType } from "@/components/accounting/types";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { money, todayIso } from "@/lib/format";
import { useApi } from "@/lib/hooks";

export default function ChartOfAccountsPage() {
  const [form, setForm] = useState({ branch_id: "all", as_of: todayIso() });
  const [filters, setFilters] = useState(form);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const { data: tree, isLoading } = useApi<ChartType[]>("accounting/accounts", filters);

  const toggle = (key: string) => setOpen((current) => ({ ...current, [key]: !current[key] }));
  const expandAll = (value: boolean) => setOpen(Object.fromEntries((tree ?? []).flatMap((type) => type.accounts.map((account) => [account.key, value]))));

  return (
    <>
      <PageHeader crumbs={["Accounting", "Chart of Accounts"]} />

      <Card title="Filter">
        <form onSubmit={(e) => { e.preventDefault(); setFilters(form); }}>
          <div className="row">
            <Field label="Branch:" className="col-md-4">
              <BranchScopeSelect value={form.branch_id} onChange={(branch_id) => setForm({ ...form, branch_id })} />
            </Field>
            <Field label="Balance as of:" className="col-md-4">
              <input type="date" className="form-control" value={form.as_of} max={todayIso()} onChange={(e) => setForm({ ...form, as_of: e.target.value })} required />
            </Field>
            <div className="col-md-4 mb-2 d-flex align-items-end">
              <button type="submit" className="btn btn-primary"><i className="icon-magnifier" /> Filter</button>
            </div>
          </div>
        </form>
      </Card>

      <Card
        title={`Chart of Accounts (as of ${filters.as_of})`}
        actions={
          <>
            <button type="button" className="btn btn-sm btn-info mr-1" onClick={() => expandAll(true)}>Expand all</button>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => expandAll(false)}>Collapse all</button>
          </>
        }
      >
        <div className="table-responsive">
          <table className="table table-hover table-custom mf-table">
            <thead className="thead-info">
              <tr>
                <th>Code</th>
                <th>Account Name</th>
                <th>Normal Balance</th>
                <th className="text-right">Debit</th>
                <th className="text-right">Credit</th>
                <th className="text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="mf-loading">Loading...</td></tr>
              )}
              {(tree ?? []).map((type) => (
                <Fragment key={type.type}>
                  <tr className="table-active">
                    <td colSpan={5}><b>{type.label}</b></td>
                    <td className="text-right"><b>{money(type.balance)}</b></td>
                  </tr>
                  {type.accounts.map((account) => (
                    <Fragment key={account.key}>
                      <tr style={{ cursor: account.children.length ? "pointer" : undefined }} onClick={() => account.children.length && toggle(account.key)}>
                        <td>{account.code}</td>
                        <td>
                          {account.children.length > 0 ? <i className={open[account.key] ? "fa fa-minus-square-o mr-1" : "fa fa-plus-square-o mr-1"} /> : <span className="mr-3" />}
                          {account.name}
                          {account.children.length > 0 && <span className="text-muted"> ({account.children.length})</span>}
                        </td>
                        <td>{account.normal_balance === "debit" ? "Dr" : "Cr"}</td>
                        <td className="text-right">{money(account.children.reduce((sum, child) => sum + child.debits, 0))}</td>
                        <td className="text-right">{money(account.children.reduce((sum, child) => sum + child.credits, 0))}</td>
                        <td className="text-right">{money(account.balance)}</td>
                      </tr>
                      {open[account.key] &&
                        account.children.map((child) => (
                          <tr key={child.id} className="text-muted">
                            <td className="pl-4">{child.code}</td>
                            <td className="pl-5">{child.scope}</td>
                            <td />
                            <td className="text-right">{money(child.debits)}</td>
                            <td className="text-right">{money(child.credits)}</td>
                            <td className="text-right">{money(child.balance)}</td>
                          </tr>
                        ))}
                    </Fragment>
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
