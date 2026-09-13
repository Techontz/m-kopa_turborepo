"use client";

import { useState } from "react";

import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction } from "@/components/ui/notify";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface PenaltySetting {
  action_penart: "PERCENTAGE VALUE" | "MONEY VALUE";
  penart: number;
}

function PenaltyForm({ setting }: { setting: PenaltySetting }) {
  const [form, setForm] = useState({ action_penart: setting.action_penart as string, penart: String(setting.penart) });
  const update = useAction<typeof form>("put", "settings/penalty");

  return (
    <form onSubmit={(e) => { e.preventDefault(); update.mutate(form); }}>
      <div className="row">
        <div className="col-md-6 col-6">
          <div className="form-group">
            <span>Calculation Type</span>
            <select className="form-control" value={form.action_penart} onChange={(e) => setForm({ ...form, action_penart: e.target.value })}>
              <option value="PERCENTAGE VALUE">Percentage Value</option>
              <option value="MONEY VALUE">Money Value</option>
            </select>
          </div>
        </div>
        <div className="col-md-6 col-6">
          <div className="form-group">
            <span>Penalt Amount</span>
            <input className="form-control" placeholder="penart Amount % $" value={form.penart} onChange={(e) => setForm({ ...form, penart: e.target.value })} required autoComplete="off" />
            {update.fieldError("penart") && <div className="field-error">{update.fieldError("penart")}</div>}
          </div>
        </div>
      </div>
      <div className="text-center m-t-20">
        <button type="submit" className="btn btn-primary" disabled={update.isPending}><i className="icon-drawer" />Update</button>
      </div>
    </form>
  );
}

/** Live admin/penart_setting. */
function LoanFreezeForm({ days }: { days: number }) {
  const [value, setValue] = useState(String(days));
  const update = useAction<{ loan_freeze_days: string }>("put", "settings/loan-freeze");

  return (
    <form onSubmit={(e) => { e.preventDefault(); update.mutate({ loan_freeze_days: value }); }}>
      <div className="form-group">
        <span>Days after a loan is closed before the customer can apply again (0 = no freeze)</span>
        <input type="number" min={0} className="form-control" value={value} onChange={(e) => setValue(e.target.value)} required />
        {update.fieldError("loan_freeze_days") && <div className="field-error">{update.fieldError("loan_freeze_days")}</div>}
      </div>
      <div className="text-center m-t-20">
        <button type="submit" className="btn btn-primary" disabled={update.isPending}><i className="icon-drawer" />Update</button>
      </div>
    </form>
  );
}

export default function PenaltySettingPage() {
  const { data: freeze } = useApi<{ loan_freeze_days: number }>("settings/loan-freeze");
  const { data } = useApi<PenaltySetting>("settings/penalty");
  const clear = useAction<PenaltySetting>("put", "settings/penalty");

  return (
    <>
      <PageHeader crumbs={["Penart Setting"]} />
      <Card title="Penart Setting">{data ? <PenaltyForm key={`${data.action_penart}-${data.penart}`} setting={data} /> : <div className="mf-loading">Loading...</div>}</Card>
      <Card title="Penart Setting">
        <div className="table-responsive">
          <table className="table table-hover dataTable table-custom">
            <thead className="thead-info">
              <tr><th>Calculation Type</th><th>Penalt Amount</th><th>Action</th></tr>
            </thead>
            <tbody>
              {data && (
                <tr>
                  <td>{data.action_penart}</td>
                  <td>{data.action_penart === "MONEY VALUE" ? money(data.penart) : `${data.penart}%`}</td>
                  <td>
                    <button type="button" className="btn btn-sm btn-icon btn-danger" onClick={async () => (await confirmAction("Are You Sure?")) && clear.mutate({ action_penart: data.action_penart, penart: 0 })}>
                      <i className="icon-trash" />
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Loan Freeze Period">{freeze ? <LoanFreezeForm key={freeze.loan_freeze_days} days={freeze.loan_freeze_days} /> : <div className="mf-loading">Loading...</div>}</Card>
    </>
  );
}
