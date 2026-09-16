"use client";

import { useState } from "react";

import { allocationStatusLabel, branchEligibilityBadge, calculateButtonState, periodBadges, type AllocationStatus, type CommissionRule, type ProfitStatus } from "@/components/hrm/commission";
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
  profit_status: ProfitStatus;
  blocked_reason: string | null;
  pool_amount: number;
  total_salary: number;
  staff: StaffLine[];
  zone_manager_percent?: number;
  zone_manager_amount?: number | null;
  staff_pool_amount?: number;
  zone_manager_shares?: { employee_id: number; employee: string | null; amount: number }[];
  unallocated_amount?: number;
  /** C4: not allocated, stays in the Profit Account — the 5 % without an eligible zone manager, or the whole pool without eligible staff. */
  returned_to_profit_amount?: number;
  returned_no_zone_manager_amount?: number;
  returned_no_staff_amount?: number;
  journal_reference?: string | null;
}

interface ZoneManagerLine {
  employee_id: number;
  employee: string;
  base_salary: number;
  contributions: { branch: string; pool_amount: number; branch_id?: number; amount?: number }[];
  zone_pool: number;
  override_percent: number;
  amount: number;
}

interface Report {
  period_closed: boolean;
  calculated: boolean;
  locked: boolean;
  can_calculate: boolean;
  calculate_blocked_reason: string | null;
  pool_percent: number;
  zone_override_percent: number;
  branches: BranchCommission[];
  zone_managers: ZoneManagerLine[];
  summary: { branches_eligible: number; branches_in_loss: number; branches_no_profit: number; total_pools: number };
  total_commission: number;
  total_returned_to_profit?: number;
  total_returned_no_zone_manager?: number;
  total_returned_no_staff?: number;
  rule?: CommissionRule;
  allocation_status?: AllocationStatus;
  journal_references?: { id: number; reference: string; branch_id: number | null; entry_date: string }[];
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
  const calcButton = calculateButtonState(report, calculate.isPending);
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
              <button type="button" className={calcButton.className} disabled={calcButton.disabled} aria-disabled={calcButton.disabled} title={calcButton.title} onClick={() => !calcButton.disabled && calculate.mutate({ period })}>Calculate Commission</button>
            </>
          )
        }
      >
        <div className="row align-items-end">
          <Field label="Month:" className="col-lg-3 col-6">
            <input type="month" className="form-control" value={period} onChange={(e) => e.target.value && setPeriod(e.target.value)} />
          </Field>
          <div className="col-lg-9 col-12 mb-2">
            {report && periodBadges(report).map((badge) => <span key={badge.label} className="mr-1"><Badge tone={badge.tone}>{badge.label}</Badge></span>)}
            <small className="ml-2">Pool: {percent(report?.pool_percent)} of distributable profit · Zone manager: {percent(report?.zone_override_percent)} of each branch pool in the zone, carved out of it</small>
          </div>
        </div>
        {report?.period_closed && (
          <p className="text-muted small mb-0 mt-2">
            Commission is a profit allocation: calculating posts Dr PROFIT ACCOUNT / Cr COMMISSION PAYABLE per branch (dated today); payroll approval moves it to staff payable.
            {report.rule === "legacy_expense" && " This month was calculated before that rule and is recognised as commission expense by its payroll."}
            {" "}Status: <b>{allocationStatusLabel(report.allocation_status)}</b>
            {(report.journal_references ?? []).length > 0 && <> · Journals: {(report.journal_references ?? []).map((entry) => entry.reference).join(", ")}</>}
            <br />
            The zone manager&apos;s share is always carved out of each branch pool and staff share the remaining 95%. Without an eligible zone manager that share returns to profit; a branch with no eligible staff allocates nothing and its whole pool (including the zone manager share) returns to profit (no journal, stays in the Profit Account and in the dividend base).
          </p>
        )}
        {report?.period_closed && !report.can_calculate && report.calculate_blocked_reason && report.allocation_status !== "LOCKED_IN_PAYROLL" && (
          <div className="alert alert-warning mt-2 mb-0">{report.calculate_blocked_reason}</div>
        )}
        {report && !report.period_closed && (
          <div className="alert alert-warning mt-2">{report.calculate_blocked_reason ?? "Period not closed."} Commission is calculated from the branch distributable profit after the month-end close (profit − loss carry forward − 2% HQ hold).</div>
        )}
      </Card>

      {report?.period_closed && (
        <>
          <div className="row clearfix">
            <Stat label="Branches eligible" value={report.summary.branches_eligible} />
            <Stat label="Blocked (loss to recover)" value={report.summary.branches_in_loss} />
            <Stat label="No distributable profit" value={report.summary.branches_no_profit} />
            <Stat label="Total commission" value={money(report.total_commission)} />
            <Stat label="Returned to profit (no zone manager / no staff)" value={`${money(report.total_returned_to_profit ?? 0)} (${money(report.total_returned_no_zone_manager ?? 0)} / ${money(report.total_returned_no_staff ?? 0)})`} />
          </div>

          <Card title={`Commission per Branch — Total pools ${money(report.summary.total_pools)}`}>
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
                { key: "pool_amount", header: "Commission Pool (10%)", render: (row) => money(row.pool_amount) },
                { key: "zone_manager_amount", header: "Zone Manager Carve-out", render: (row) => (row.zone_manager_amount === null || row.zone_manager_amount === undefined ? "—" : money(row.zone_manager_amount)) },
                { key: "staff_pool_amount", header: "Staff Share", render: (row) => ((row.returned_to_profit_amount ?? 0) > 0 && row.staff.length === 0 ? "—" : money(row.staff_pool_amount ?? row.pool_amount)) },
                {
                  key: "returned_to_profit_amount",
                  header: "Returned to Profit",
                  render: (row) =>
                    (row.returned_to_profit_amount ?? 0) > 0 ? (
                      <>
                        <Badge tone="warning">{money(row.returned_to_profit_amount)}</Badge>
                        <div className="text-muted small">{(row.returned_no_staff_amount ?? 0) > 0 ? "No eligible staff (whole pool)" : (row.returned_no_zone_manager_amount ?? 0) > 0 ? "No zone manager (5%)" : ""}</div>
                      </>
                    ) : (
                      "—"
                    ),
                },
                { key: "journal_reference", header: "Allocation Journal", render: (row) => row.journal_reference ?? "—" },
                { key: "eligible", header: "Eligibility", render: (row) => { const badge = branchEligibilityBadge(row); return <Badge tone={badge.tone}>{badge.label}</Badge>; } },
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
                { key: "contributions", header: "Branch contributions", sortable: false, render: (row) => row.contributions.map((item) => (item.amount === undefined ? `${item.branch}: ${money(item.pool_amount)}` : `${item.branch}: ${money(item.amount)} of ${money(item.pool_amount)}`)).join(", ") },
                { key: "zone_pool", header: "Total Pools", render: (row) => money(row.zone_pool) },
                { key: "override_percent", header: "Share of each branch pool", render: (row) => percent(row.override_percent) },
                { key: "amount", header: "Commission Earned", render: (row) => money(row.amount) },
              ]}
            />
          </Card>
        </>
      )}

      <Modal open={viewing !== null} onClose={() => setViewing(null)} title={`${viewing?.branch ?? ""} — Pool ${money(viewing?.pool_amount)}${viewing?.zone_manager_amount ? ` · Zone manager ${money(viewing.zone_manager_amount)} · Staff ${money(viewing.staff_pool_amount)}` : ""}`} size="lg">
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
          <Field label="Zone manager share (% of each branch pool, carved out):" className="col-md-12" error={save.fieldError("zone_override_percent")}>
            <input type="number" step="0.01" className="form-control" value={form.zone_override_percent} onChange={(e) => setForm({ ...form, zone_override_percent: e.target.value })} required />
          </Field>
        </div>
      </Modal>
    </>
  );
}
