"use client";

import { useState } from "react";

import type { AccountingPeriod, PeriodResult } from "@/components/accounting/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction } from "@/components/ui/notify";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

type Amount = Exclude<keyof PeriodResult, "branch_id" | "branch" | "hq_hold_percent" | "commission_eligible">;

const AMOUNT_COLUMNS: Array<[Amount, string]> = [
  ["interest_income", "Interest (after Reserve)"],
  ["reserve_amount", "Reserve Cut"],
  ["fee_income", "Loan Fee"],
  ["penalty_income", "Penarty"],
  ["recovery_income", "Recoveries"],
  ["total_income", "Total Income"],
  ["expenses", "Expenses"],
  ["gross_profit", "Gross Profit"],
  ["loss_brought_forward", "Loss B/F"],
  ["net_profit", "Net Profit"],
  ["loss_carried_forward", "Loss C/F"],
  ["hq_hold_amount", "HQ 2% Hold"],
  ["distributable_profit", "Distributable Profit"],
];

function previousMonth(): string {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function PeriodClosePage() {
  const { can } = useAuth();
  const [month, setMonth] = useState(previousMonth());
  const [selected, setSelected] = useState<number | null>(null);

  const { data: periods, isLoading } = useApi<AccountingPeriod[]>("accounting/periods");
  const activeId = selected ?? periods?.[0]?.id ?? null;
  const { data: period, isLoading: loadingPeriod } = useApi<AccountingPeriod>(activeId ? `accounting/periods/${activeId}` : null);

  const calculate = useAction<{ month: string }, { data: AccountingPeriod }>("post", "accounting/periods");
  const close = useAction<{ id: number }>("post", (body) => `accounting/periods/${body.id}/close`);
  const manage = can("accounting.close_period");

  const askClose = async (target: AccountingPeriod) => {
    if (await confirmAction(`Close ${target.month}?`, "Income and expenses will be moved to the Profit Account and no more entries can be posted in this month.")) {
      close.mutate({ id: target.id });
    }
  };

  return (
    <>
      <PageHeader crumbs={["Accounting", "Month End & Profit"]} />

      {manage && (
        <Card title="Calculate Monthly Profit">
          <form onSubmit={(e) => { e.preventDefault(); calculate.mutate({ month }, { onSuccess: (result) => setSelected(result.data.id) }); }}>
            <div className="row">
              <Field label="Month:" required className="col-md-4" error={calculate.fieldError("month")}>
                <input type="month" className="form-control" value={month} max={currentMonth()} onChange={(e) => setMonth(e.target.value)} required />
              </Field>
              <div className="col-md-8 mb-2 d-flex align-items-end">
                <button type="submit" className="btn btn-primary" disabled={calculate.isPending}><i className="icon-calculator" /> Calculate</button>
              </div>
            </div>
            <small className="text-muted">
              Total Income = Interest (reserve already cut) + Loan Fee + Penarty + Recoveries. Net Profit = Gross Profit − Loss brought forward. HQ holds 2% of a positive Net Profit; the rest is the distributable profit used for commission.
            </small>
          </form>
        </Card>
      )}

      <Card title="Accounting Periods">
        <DataTable
          rows={periods}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "month", header: "Month" },
            { key: "period_start", header: "From" },
            { key: "period_end", header: "To" },
            { key: "status", header: "Status", render: (row) => (row.status === "closed" ? <Badge tone="danger">CLOSED</Badge> : <Badge tone="success">OPEN</Badge>) },
            { key: "closed_by", header: "Closed By", render: (row) => row.closed_by ?? "" },
            { key: "closed_at", header: "Closed At", render: (row) => row.closed_at ?? "" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  <button type="button" className="btn btn-sm btn-icon btn-primary mr-1" title="View" onClick={() => setSelected(row.id)}><i className="icon-eye" /></button>
                  {manage && row.status === "open" && (
                    <>
                      <button type="button" className="btn btn-sm btn-icon btn-info mr-1" title="Recalculate" disabled={calculate.isPending} onClick={() => calculate.mutate({ month: row.month }, { onSuccess: () => setSelected(row.id) })}><i className="icon-refresh" /></button>
                      <button type="button" className="btn btn-sm btn-icon btn-danger" title="Close period" disabled={close.isPending} onClick={() => askClose(row)}><i className="icon-lock" /></button>
                    </>
                  )}
                </>
              ),
            },
          ]}
        />
      </Card>

      {activeId && (
        <Card
          title={period ? `Branch Profit & Loss — ${period.month} (${period.status.toUpperCase()})` : "Branch Profit & Loss"}
          actions={period?.status === "closed" ? <Badge tone="danger"><i className="icon-lock" /> LOCKED</Badge> : undefined}
        >
          {loadingPeriod || !period ? (
            <div className="mf-loading">Loading...</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover table-custom mf-table text-nowrap">
                <thead className="thead-info">
                  <tr>
                    <th>S/No.</th>
                    <th>Branch</th>
                    {AMOUNT_COLUMNS.map(([key, label]) => <th key={key} className="text-right">{label}</th>)}
                    <th>Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {(period.results ?? []).length === 0 && (
                    <tr><td colSpan={AMOUNT_COLUMNS.length + 3} className="text-center">No data available in table</td></tr>
                  )}
                  {(period.results ?? []).map((row, index) => (
                    <tr key={row.branch_id}>
                      <td>{index + 1}.</td>
                      <td>{row.branch}</td>
                      {AMOUNT_COLUMNS.map(([key]) => (
                        <td key={key} className={`text-right ${key === "net_profit" && row.net_profit < 0 ? "text-danger" : ""}`}>{money(row[key])}</td>
                      ))}
                      <td>{row.commission_eligible ? <Badge tone="success">ELIGIBLE</Badge> : <Badge tone="danger">BLOCKED</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
                {period.totals && (
                  <tfoot>
                    <tr>
                      <td colSpan={2}><b>TOTAL</b></td>
                      {AMOUNT_COLUMNS.map(([key]) => <td key={key} className="text-right"><b>{money(period.totals?.[key])}</b></td>)}
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
