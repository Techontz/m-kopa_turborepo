"use client";

import { useState } from "react";

import { currentMonth, Stat } from "@/components/hrm/common";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import { money, percent } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface StaffLine {
  employee_id: number;
  employee: string;
  base_salary: number;
  share_percent: number;
  amount: number;
}

interface BranchCommission {
  branch_id: number;
  branch: string;
  total_income: number;
  expenses: number;
  gross_profit: number;
  loss_brought_forward: number;
  net_profit: number;
  hq_hold_amount: number;
  distributable_profit: number;
  eligible: boolean;
  blocked_reason: string | null;
  pool_amount: number;
  total_salary: number;
  staff: StaffLine[];
}

interface ZoneManagerLine {
  employee_id: number;
  employee: string;
  base_salary: number;
  contributions: { branch: string; pool_amount: number }[];
  zone_pool: number;
  override_percent: number;
  amount: number;
}

interface Report {
  period_closed: boolean;
  calculated: boolean;
  locked: boolean;
  pool_percent: number;
  zone_override_percent: number;
  branches: BranchCommission[];
  zone_managers: ZoneManagerLine[];
  total_commission: number;
}

interface Settings {
  commission_pool_percent: number;
  zone_override_percent: number;
  staff_fund_percent: number;
  work_start_time: string;
}

export default function CommissionPage() {
  const { can } = useAuth();
  const [period, setPeriod] = useState(currentMonth());
  const [viewing, setViewing] = useState<BranchCommission | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { data: report, isLoading } = useApi<Report>("hrm/commission", { period });
  const { data: settings } = useApi<Settings>("hrm/settings");
  const [form, setForm] = useState({ commission_pool_percent: "", zone_override_percent: "" });
  const calculate = useAction<{ period: string }>("post", "hrm/commission/calculate");
  const save = useAction<typeof form>("put", "hrm/settings");

  return (
    <>
      <PageHeader crumbs={["HRM", "Commission"]} />

      <Card
        title="Commission Report"
        actions={
          can("payroll.approve") && (
            <>
              <button type="button" className="btn btn-sm btn-primary mr-1" title="Commission settings" onClick={() => { setForm({ commission_pool_percent: String(settings?.commission_pool_percent ?? ""), zone_override_percent: String(settings?.zone_override_percent ?? "") }); setSettingsOpen(true); }}><i className="icon-settings" /></button>
              <button type="button" className="btn btn-sm btn-success" disabled={!report?.period_closed || report?.locked || calculate.isPending} onClick={() => calculate.mutate({ period })}>Calculate Commission</button>
            </>
          )
        }
      >
        <div className="row align-items-end">
          <Field label="Month:" className="col-lg-3 col-6">
            <input type="month" className="form-control" value={period} onChange={(e) => e.target.value && setPeriod(e.target.value)} />
          </Field>
          <div className="col-lg-9 col-12 mb-2">
            {report && !report.period_closed && <Badge tone="danger">Period not closed</Badge>}
            {report?.period_closed && (report.calculated ? <Badge tone="success">CALCULATED</Badge> : <Badge tone="warning">PREVIEW — NOT CALCULATED</Badge>)}{" "}
            {report?.locked && <Badge tone="info">LOCKED (in approved payroll)</Badge>}
            <small className="ml-2">Pool: {percent(report?.pool_percent)} of distributable profit · Zone manager override: {percent(report?.zone_override_percent)}</small>
          </div>
        </div>
        {report && !report.period_closed && (
          <div className="alert alert-warning mt-2">Period not closed. Commission is calculated from the branch distributable profit after the month-end close (profit − loss carry forward − 2% HQ hold).</div>
        )}
      </Card>

      {report?.period_closed && (
        <>
          <div className="row clearfix">
            <Stat label="Branches eligible" value={report.branches.filter((branch) => branch.eligible).length} />
            <Stat label="Branches blocked" value={report.branches.filter((branch) => !branch.eligible).length} />
            <Stat label="Total pools" value={money(report.branches.reduce((total, branch) => total + branch.pool_amount, 0))} />
            <Stat label="Total commission" value={money(report.total_commission)} />
          </div>

          <Card title="Commission per Branch">
            <DataTable
              rows={report.branches}
              loading={isLoading}
              rowKey={(row) => row.branch_id}
              columns={[
                { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
                { key: "branch", header: "Branch" },
                { key: "gross_profit", header: "Gross Profit", render: (row) => money(row.gross_profit) },
                { key: "loss_brought_forward", header: "Loss Carry Forward", render: (row) => money(row.loss_brought_forward) },
                { key: "net_profit", header: "Net Profit", render: (row) => money(row.net_profit) },
                { key: "hq_hold_amount", header: "HQ 2% Hold", render: (row) => money(row.hq_hold_amount) },
                { key: "distributable_profit", header: "Profit used", render: (row) => money(row.distributable_profit) },
                { key: "pool_amount", header: "Commission Pool", render: (row) => money(row.pool_amount) },
                { key: "eligible", header: "Eligibility", render: (row) => (row.eligible ? <Badge tone="success">ELIGIBLE</Badge> : <Badge tone="danger">{row.blocked_reason ?? "BLOCKED"}</Badge>) },
                { key: "action", header: "Action", sortable: false, render: (row) => <button type="button" className="btn btn-sm btn-icon btn-primary" title="Distribution per staff" onClick={() => setViewing(row)}><i className="icon-eye" /></button> },
              ]}
            />
          </Card>

          <Card title="Zone Manager Commission">
            <DataTable
              rows={report.zone_managers}
              rowKey={(row) => row.employee_id}
              columns={[
                { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
                { key: "employee", header: "Zone Manager" },
                { key: "contributions", header: "Branch contributions", sortable: false, render: (row) => row.contributions.map((item) => `${item.branch}: ${money(item.pool_amount)}`).join(", ") },
                { key: "zone_pool", header: "Total Pools", render: (row) => money(row.zone_pool) },
                { key: "override_percent", header: "Override", render: (row) => percent(row.override_percent) },
                { key: "amount", header: "Override Earned", render: (row) => money(row.amount) },
              ]}
            />
          </Card>
        </>
      )}

      <Modal open={viewing !== null} onClose={() => setViewing(null)} title={`${viewing?.branch ?? ""} — Pool ${money(viewing?.pool_amount)}`} size="lg">
        <DataTable
          rows={viewing?.staff}
          rowKey={(row) => row.employee_id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "employee", header: "Staff name" },
            { key: "base_salary", header: "Base Salary", render: (row) => money(row.base_salary) },
            { key: "share_percent", header: "Salary Share", render: (row) => `${row.share_percent.toFixed(2)}%` },
            { key: "amount", header: "Commission", render: (row) => money(row.amount) },
          ]}
        />
      </Modal>

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Commission Settings" submitLabel="Save" submitting={save.isPending} onSubmit={() => save.mutate(form, { onSuccess: () => setSettingsOpen(false) })}>
        <div className="row">
          <Field label="Commission pool (% of distributable profit):" className="col-md-12" error={save.fieldError("commission_pool_percent")}>
            <input type="number" step="0.01" className="form-control" value={form.commission_pool_percent} onChange={(e) => setForm({ ...form, commission_pool_percent: e.target.value })} required />
          </Field>
          <Field label="Zone manager override (% of zone pools):" className="col-md-12" error={save.fieldError("zone_override_percent")}>
            <input type="number" step="0.01" className="form-control" value={form.zone_override_percent} onChange={(e) => setForm({ ...form, zone_override_percent: e.target.value })} required />
          </Field>
        </div>
      </Modal>
    </>
  );
}
