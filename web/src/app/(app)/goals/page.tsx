"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PillTabs, StatTile } from "@/components/crm/Tabs";
import { EMPTY_GOAL, formatGoalValue, GoalDetailModal, GoalFormModal, goalToForm, periodDates, type GoalForm } from "@/components/goals/GoalModals";
import { ACTUAL_COLOR, STATUS_LABEL, STATUS_TONE, TARGET_COLOR, type Goal, type GoalOptions, type GoalReport } from "@/components/goals/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction } from "@/components/ui/notify";
import { useAuth } from "@/lib/auth";
import { useAction, useApi } from "@/lib/hooks";

type Tab = "active" | "upcoming" | "past" | "all";

function ProgressBar({ goal }: { goal: Goal }) {
  const { percent, expected_percent: expected, status } = goal.progress;
  const tone = status === "achieved" ? "bg-success" : status === "on_track" ? "bg-info" : status === "behind" ? "bg-warning" : status === "missed" ? "bg-danger" : "bg-secondary";

  return (
    <div style={{ minWidth: 140 }} title={`Expected by today: ${expected}%`}>
      <div className="progress" style={{ height: 8, position: "relative" }}>
        <div className={`progress-bar ${tone}`} style={{ width: `${Math.min(100, percent)}%` }} />
        {status !== "upcoming" && status !== "achieved" && <span style={{ position: "absolute", left: `${Math.min(100, expected)}%`, top: -2, bottom: -2, width: 2, background: "var(--mf-muted)" }} />}
      </div>
      <small>{percent}%</small>
    </div>
  );
}

export default function GoalsPage() {
  const { can } = useAuth();
  const canManage = can("goals.manage");
  const [tab, setTab] = useState<Tab>("active");
  const [metric, setMetric] = useState("all");
  const [editing, setEditing] = useState<GoalForm | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const month = periodDates("monthly")!;
  const [report, setReport] = useState({ metric: "disbursement_amount", from: month.start_date, to: month.end_date });

  const { data: options } = useApi<GoalOptions>("goals/options");
  const goals = useApi<Goal[]>("goals", { status: tab, metric });
  const reportData = useApi<GoalReport>("goals/report", report);
  const remove = useAction<{ id: number }>("delete", (body) => `goals/${body.id}`);

  const rows = goals.data ?? [];
  const count = (status: string) => rows.filter((goal) => goal.progress.status === status).length;
  const fmt = (value: number) => formatGoalValue(value, Boolean(reportData.data?.is_money));

  return (
    <>
      <PageHeader crumbs={["Goals"]} />

      <Card>
        <div className="row clearfix">
          <StatTile tone="primary" icon="icon-target" value={rows.length} label={`${tab === "all" ? "All" : tab[0].toUpperCase() + tab.slice(1)} Goals`} />
          <StatTile tone="success" icon="icon-check" value={count("achieved")} label="Achieved" />
          <StatTile tone="info" icon="icon-graph" value={count("on_track")} label="On Track" />
          <StatTile tone="danger" icon="icon-exclamation" value={count("behind") + count("missed")} label="Behind / Missed" />
        </div>
      </Card>

      <div className="card">
        <div className="body">
          <PillTabs<Tab> value={tab} onChange={setTab} tabs={[["active", "Active Goals"], ["upcoming", "Upcoming"], ["past", "Past Goals"], ["all", "All"]]} />
        </div>
      </div>

      <Card title="Goals">
        <div className="d-flex justify-content-between flex-wrap mb-2">
          <select className="form-control" style={{ width: 240 }} value={metric} onChange={(e) => setMetric(e.target.value)}>
            <option value="all">All measures</option>
            {options?.metrics.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          {canManage && (
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setEditing({ ...EMPTY_GOAL })}><i className="icon-plus" /> Set Goal</button>
          )}
        </div>
        <DataTable
          rows={rows}
          loading={goals.isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "title", header: "Goal" },
            { key: "assignee", header: "Goal For", render: (row) => <>{row.assignee}<br /><small className="text-muted">{row.scope_label}</small></> },
            { key: "metric_label", header: "Measure" },
            { key: "period", header: "Period", value: (row) => row.start_date, render: (row) => <>{row.start_date}<br /><small className="text-muted">to {row.end_date}</small></> },
            { key: "target", header: "Target", render: (row) => formatGoalValue(row.target, row.is_money) },
            { key: "achieved", header: "Achieved", value: (row) => row.progress.achieved, render: (row) => formatGoalValue(row.progress.achieved, row.is_money) },
            { key: "progress", header: "Progress", value: (row) => row.progress.percent, render: (row) => <ProgressBar goal={row} /> },
            { key: "status", header: "Status", value: (row) => row.progress.status, render: (row) => <Badge tone={STATUS_TONE[row.progress.status]}>{STATUS_LABEL[row.progress.status]}</Badge> },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  <button type="button" className="btn btn-sm btn-icon btn-info mr-1" title="View" onClick={() => setViewing(row.id)}><i className="icon-eye" /></button>
                  {canManage && (
                    <>
                      <button type="button" className="btn btn-sm btn-icon btn-primary mr-1" onClick={() => setEditing(goalToForm(row))}><i className="icon-pencil" /></button>
                      <button type="button" className="btn btn-sm btn-icon btn-danger" onClick={async () => (await confirmAction()) && remove.mutate({ id: row.id })}><i className="icon-trash" /></button>
                    </>
                  )}
                </>
              ),
            },
          ]}
        />
      </Card>

      <Card title="Performance Report">
        <div className="row">
          <Field label="Measure:" className="col-md-4">
            <select className="form-control" value={report.metric} onChange={(e) => setReport({ ...report, metric: e.target.value })}>
              {options?.metrics.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="From:" className="col-md-4">
            <input type="date" className="form-control" value={report.from} onChange={(e) => setReport({ ...report, from: e.target.value })} />
          </Field>
          <Field label="To:" className="col-md-4">
            <input type="date" className="form-control" value={report.to} onChange={(e) => setReport({ ...report, to: e.target.value })} />
          </Field>
        </div>

        {reportData.data && (
          <>
            <h6 className="mt-3">{reportData.data.metric_label} by Branch ({reportData.data.from} to {reportData.data.to})</h6>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={reportData.data.branches} margin={{ top: 10, right: 20, bottom: 0, left: 10 }} barGap={2}>
                  <CartesianGrid stroke="#eee" vertical={false} />
                  <XAxis dataKey="branch" tick={{ fontSize: 11, fill: "#777" }} tickLine={false} axisLine={{ stroke: "#ddd" }} />
                  <YAxis tickFormatter={(value: number) => fmt(value)} tick={{ fontSize: 11, fill: "#777" }} tickLine={false} axisLine={false} width={90} />
                  <Tooltip formatter={(value) => fmt(Number(value))} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                  <Legend />
                  <Bar dataKey="actual" name="Actual" fill={ACTUAL_COLOR} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="target" name="Branch goal target" fill={TARGET_COLOR} radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="row mt-3">
              <div className="col-lg-6">
                <h6>Top Officers</h6>
                <DataTable
                  rows={reportData.data.officers}
                  rowKey={(row) => row.employee_id}
                  searchable={false}
                  columns={[
                    { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
                    { key: "employee", header: "Staff" },
                    { key: "branch", header: "Branch" },
                    { key: "actual", header: reportData.data.metric_label, render: (row) => fmt(row.actual) },
                  ]}
                />
              </div>
              <div className="col-lg-6">
                <h6>
                  Goals in period{" "}
                  {Object.entries(reportData.data.status_counts).map(([status, total]) => (
                    <Badge key={status} tone={STATUS_TONE[status as keyof typeof STATUS_TONE]}>{STATUS_LABEL[status as keyof typeof STATUS_LABEL]}: {total}</Badge>
                  ))}
                </h6>
                <DataTable
                  rows={reportData.data.goals}
                  rowKey={(row) => row.id}
                  searchable={false}
                  columns={[
                    { key: "title", header: "Goal" },
                    { key: "assignee", header: "Goal For" },
                    { key: "target", header: "Target", render: (row) => fmt(row.target) },
                    { key: "achieved", header: "Achieved", render: (row) => fmt(row.achieved) },
                    { key: "percent", header: "%", render: (row) => `${row.percent}%` },
                    { key: "status", header: "Status", render: (row) => <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge> },
                  ]}
                />
              </div>
            </div>
          </>
        )}
      </Card>

      <GoalFormModal initial={editing} onClose={() => setEditing(null)} />
      <GoalDetailModal goalId={viewing} onClose={() => setViewing(null)} />
    </>
  );
}
