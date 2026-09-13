"use client";

import { Fragment, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { confirmAction } from "@/components/ui/notify";
import { useAuth } from "@/lib/auth";
import { money, percent } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface Summary {
  period: string;
  available_profit: number;
  dividend_balance: number;
  period_profit: number | null;
  reinvest_percent: number;
  dividend_percent: number;
  shares: { id: number; name: string; capital: number; percent: number }[];
}

interface Allocation {
  id: number;
  share_holder: string;
  share_percent: number;
  amount: number;
  status: "pending" | "paid";
  pay_method: string | null;
  bank_account: string | null;
  reference: string | null;
  paid_at: string | null;
}

interface Declaration {
  id: number;
  period: string;
  profit_amount: number;
  reinvest_percent: number;
  reinvest_amount: number;
  dividend_percent: number;
  dividend_amount: number;
  paid_amount: number;
  declared_by: string | null;
  date: string;
  allocations: Allocation[];
}

function previousMonth(): string {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function PayModal({ allocation, onClose }: { allocation: Allocation; onClose: () => void }) {
  const [form, setForm] = useState({ pay_method: "", bank_account_id: "", reference: "" });
  const pay = useAction<typeof form>("post", `capital/dividends/allocations/${allocation.id}/pay`);

  return (
    <Modal open onClose={onClose} title={`Pay Dividend / ${allocation.share_holder} - ${money(allocation.amount)}`} submitLabel="Pay" submitting={pay.isPending} onSubmit={() => pay.mutate(form, { onSuccess: onClose })}>
      <div className="row">
        <Field label="Pay Method:" required className="col-md-6" error={pay.fieldError("pay_method")}>
          <select className="form-control" value={form.pay_method} onChange={(e) => setForm({ ...form, pay_method: e.target.value })} required>
            <option value="">Select</option>
            <option value="CASH">CASH</option>
            <option value="BANK">BANK</option>
          </select>
        </Field>
        {form.pay_method === "BANK" && (
          <Field label="Bank Account:" required className="col-md-6" error={pay.fieldError("bank_account_id")}>
            <SelectBox placeholder="Select Account" optionsUrl="capital/options/bank-accounts" value={form.bank_account_id} onChange={(value) => setForm({ ...form, bank_account_id: value ?? "" })} />
          </Field>
        )}
        <Field label="Reference:" className="col-md-12" error={pay.fieldError("reference")}>
          <input className="form-control" placeholder="Receipt / Transaction reference" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

/**
 * Documents: ACCOUNT OVERVIEW "Dividend Account" — monthly profit → Dividend; 70% → Principal (reinvestment),
 * 30% → shareholders split by share percentage; Dividend account withdrawn by CASH or BANK.
 */
export default function DividendsPage() {
  const { can } = useAuth();
  const [form, setForm] = useState({ period: previousMonth(), profit_amount: "" });
  const { data: summary } = useApi<Summary>("capital/dividends/summary", { period: form.period });
  const { data: declarations, isLoading } = useApi<Declaration[]>("capital/dividends");
  const [paying, setPaying] = useState<Allocation | null>(null);
  const declare = useAction<typeof form>("post", "capital/dividends");

  const profit = Number(form.profit_amount || 0);
  const dividend = Math.round(profit * (summary?.dividend_percent ?? 30)) / 100;
  const reinvest = profit - dividend;
  const canManage = can("capital.manage");

  return (
    <>
      <PageHeader crumbs={["Capital", "Dividends"]} />

      <div className="row clearfix">
        {[
          ["PROFIT ACCOUNT (Undistributed)", summary?.available_profit],
          ["DIVIDEND ACCOUNT (Unpaid)", summary?.dividend_balance],
          [`Month-end profit ${summary?.period ?? ""}`, summary?.period_profit],
        ].map(([label, value]) => (
          <div className="col-lg-4 col-md-6" key={String(label)}>
            <div className="card">
              <div className="body">
                <div className="text-muted">{label}</div>
                <h4 className="mb-0">{value === null || value === undefined ? "-" : money(value as number)}</h4>
              </div>
            </div>
          </div>
        ))}
      </div>

      {canManage && (
        <Card title="Declare Dividend">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (await confirmAction("Are you sure?", `Declare ${money(profit)} for ${form.period}?`)) {
                declare.mutate(form, { onSuccess: () => setForm({ ...form, profit_amount: "" }) });
              }
            }}
          >
            <div className="row">
              <Field label="Month:" required className="col-md-3" error={declare.fieldError("period")}>
                <input type="month" className="form-control" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} required />
              </Field>
              <Field label="Profit Amount:" required className="col-md-3" error={declare.fieldError("profit_amount")}>
                <input type="number" min={1} className="form-control" placeholder="Amount" value={form.profit_amount} onChange={(e) => setForm({ ...form, profit_amount: e.target.value })} required />
                {summary?.period_profit !== null && summary?.period_profit !== undefined && (
                  <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setForm({ ...form, profit_amount: String(summary.period_profit) })}>Use month-end profit</button>
                )}
              </Field>
              <Field label={`Principal Reinvestment (${percent(summary?.reinvest_percent ?? 70)}):`} className="col-md-3">
                <input className="form-control" value={money(reinvest)} readOnly />
              </Field>
              <Field label={`Shareholders Dividend (${percent(summary?.dividend_percent ?? 30)}):`} className="col-md-3">
                <input className="form-control" value={money(dividend)} readOnly />
              </Field>
            </div>
            <div className="table-responsive">
              <table className="table table-hover table-custom">
                <thead className="thead-info">
                  <tr><th>S/No.</th><th>Share Holder</th><th>Capital</th><th>Share %</th><th>Dividend</th></tr>
                </thead>
                <tbody>
                  {(summary?.shares ?? []).map((share, index) => (
                    <tr key={share.id}>
                      <td>{index + 1}.</td>
                      <td>{share.name}</td>
                      <td>{money(share.capital)}</td>
                      <td>{percent(Number(share.percent.toFixed(2)))}</td>
                      <td>{money((dividend * share.percent) / 100)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-center m-t-20">
              <button type="submit" className="btn btn-primary" disabled={declare.isPending}><i className="icon-drawer" />Declare</button>
            </div>
          </form>
        </Card>
      )}

      <Card title="Dividend List">
        <div className="table-responsive">
          <table className="table table-hover dataTable table-custom">
            <thead className="thead-info">
              <tr><th>S/No.</th><th>Month</th><th>Share Holder</th><th>Share %</th><th>Amount</th><th>Status</th><th>Pay method</th><th>Date</th><th>Action</th></tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={9} className="mf-loading">Loading...</td></tr>}
              {!isLoading && !declarations?.length && <tr><td colSpan={9} className="text-center">No data available in table</td></tr>}
              {declarations?.map((declaration, index) => (
                <Fragment key={declaration.id}>
                  <tr>
                    <td>{index + 1}.</td>
                    <td><b>{declaration.period}</b></td>
                    <td colSpan={3}>
                      Profit <b>{money(declaration.profit_amount)}</b> — Principal {percent(declaration.reinvest_percent)}: <b>{money(declaration.reinvest_amount)}</b> — Dividend {percent(declaration.dividend_percent)}: <b>{money(declaration.dividend_amount)}</b>
                    </td>
                    <td>Paid: {money(declaration.paid_amount)}</td>
                    <td />
                    <td>{declaration.date}</td>
                    <td />
                  </tr>
                  {declaration.allocations.map((allocation) => (
                    <tr key={allocation.id}>
                      <td /><td />
                      <td>{allocation.share_holder}</td>
                      <td>{percent(Number(allocation.share_percent.toFixed(2)))}</td>
                      <td>{money(allocation.amount)}</td>
                      <td><Badge tone={allocation.status === "paid" ? "success" : "warning"}>{allocation.status.toUpperCase()}</Badge></td>
                      <td>{allocation.pay_method ? `${allocation.pay_method}${allocation.bank_account ? ` / ${allocation.bank_account}` : ""}` : "-"}</td>
                      <td>{allocation.paid_at ?? "-"}</td>
                      <td>
                        {canManage && allocation.status === "pending" && (
                          <button type="button" className="btn btn-sm btn-success" title="Pay" onClick={() => setPaying(allocation)}><i className="icon-wallet" /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {paying && <PayModal allocation={paying} onClose={() => setPaying(null)} />}
    </>
  );
}
