"use client";

import { Fragment, useState } from "react";

import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface CapitalData {
  share_holders: {
    id: number;
    name: string;
    total: number;
    capitals: { id: number; amount: number; pay_method: string; receipt_number: string | null; cheque_number: string | null; created_at: string }[];
  }[];
  share_holder_capital: number;
  company_capital: number;
}

interface CapitalForm {
  share_id: string;
  amount: string;
  pay_method: string;
  recept: string;
  chaque_no: string;
}

const EMPTY: CapitalForm = { share_id: "", amount: "", pay_method: "", recept: "", chaque_no: "" };

/**
 * Live admin/capital. Documents: capital is posted Dr Company / Cr Capital through the ledger and
 * entries are never deleted (corrections are reversals), so the live per-row delete button is not offered.
 */
export default function CapitalsPage() {
  const { can } = useAuth();
  const { data, isLoading } = useApi<CapitalData>("capital/capitals");
  const [form, setForm] = useState<CapitalForm>(EMPTY);
  const create = useAction<CapitalForm>("post", "capital/capitals");
  const set = (field: keyof CapitalForm) => (event: { target: { value: string } }) => setForm({ ...form, [field]: event.target.value });

  return (
    <>
      <PageHeader crumbs={["Capital"]} />

      {can("capital.manage") && (
        <Card title="Add Capital">
          <form onSubmit={(e) => { e.preventDefault(); create.mutate(form, { onSuccess: () => setForm(EMPTY) }); }}>
            <div className="row">
              <Field label=" Share Holder Name:" required className="col-lg-4" error={create.fieldError("share_id")}>
                <SelectBox placeholder="Select Share Holder" optionsUrl="capital/options/share-holders" value={form.share_id} onChange={(value) => setForm({ ...form, share_id: value ?? "" })} />
              </Field>
              <Field label="Amount:" required className="col-lg-4" error={create.fieldError("amount")}>
                <input type="number" className="form-control input-sm" placeholder="Amount" autoComplete="off" value={form.amount} onChange={set("amount")} required />
              </Field>
              <Field label="Pay Method:" required className="col-lg-4" error={create.fieldError("pay_method")}>
                <select className="form-control input-sm" value={form.pay_method} onChange={set("pay_method")} required>
                  <option value="">Select</option>
                  <option value="CASH">CASH</option>
                  <option value="BANK">BANK</option>
                </select>
              </Field>
              <Field label="Receipt no:" required className="col-lg-6" error={create.fieldError("recept")}>
                <input type="number" className="form-control input-sm" placeholder="Receipt" autoComplete="off" value={form.recept} onChange={set("recept")} />
              </Field>
              <Field label="Cheque Number:" required className="col-lg-6" error={create.fieldError("chaque_no")}>
                <input type="number" className="form-control input-sm" placeholder="Cheque number" autoComplete="off" value={form.chaque_no} onChange={set("chaque_no")} />
              </Field>
            </div>
            <div className="text-center m-t-20">
              <button type="submit" className="btn btn-primary" disabled={create.isPending}><i className="icon-drawer" />Save</button>
            </div>
          </form>
        </Card>
      )}

      <Card title="Capital">
        <div className="table-responsive">
          <table className="table table-hover dataTable table-custom">
            <thead className="thead-info">
              <tr><th>S/No</th><th>Share Holder</th><th>Amount</th><th>Pay method</th><th>Receipt no</th><th>Chaque no</th><th>Date</th><th>Action</th></tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} className="mf-loading">Loading...</td></tr>}
              {data?.share_holders.map((holder, index) => (
                <Fragment key={holder.id}>
                  <tr><td>{index + 1}.</td><td>{holder.name}</td><td /><td /><td /><td /><td /><td /></tr>
                  {holder.capitals.map((capital) => (
                    <tr key={capital.id}>
                      <td /><td />
                      <td>{money(capital.amount)}</td>
                      <td>{capital.pay_method}</td>
                      <td>{capital.receipt_number || "-"}</td>
                      <td>{capital.cheque_number || "-"}</td>
                      <td>{capital.created_at}</td>
                      <td />
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={2}><b>SHARE HOLDER CAPITAL</b></td><td><b>{money(data?.share_holder_capital)}</b></td><td colSpan={5} /></tr>
              <tr><td colSpan={2}><b>TOTAL COMPANY CAPITAL</b></td><td><b>{money(data?.company_capital)}</b></td><td colSpan={5} /></tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </>
  );
}
