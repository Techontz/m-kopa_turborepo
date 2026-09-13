"use client";

import { useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/Badge";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { SelectBox } from "@/components/ui/SelectBox";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

import { ACTUAL_COLOR, STATUS_LABEL, STATUS_TONE, TARGET_COLOR, type Goal, type GoalDetail, type GoalOptions } from "./types";

export interface GoalForm {
  id?: number;
  title: string;
  scope_type: string;
  branch_id: string;
  zone_id: string;
  employee_id: string;
  metric: string;
  target: string;
  period_type: string;
  start_date: string;
  end_date: string;
  notes: string;
}

const iso = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

/** Start / end dates of the current period for a period type. */
export function periodDates(period: string): { start_date: string; end_date: string } | null {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  switch (period) {
    case "daily":
      return { start_date: iso(today), end_date: iso(today) };
    case "weekly": {
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { start_date: iso(monday), end_date: iso(sunday) };
    }
    case "monthly":
      return { start_date: iso(new Date(y, m, 1)), end_date: iso(new Date(y, m + 1, 0)) };
    case "quarterly": {
      const q = Math.floor(m / 3) * 3;
      return { start_date: iso(new Date(y, q, 1)), end_date: iso(new Date(y, q + 3, 0)) };
    }
    case "yearly":
      return { start_date: iso(new Date(y, 0, 1)), end_date: iso(new Date(y, 11, 31)) };
    default:
      return null;
  }
}

export const EMPTY_GOAL: GoalForm = { title: "", scope_type: "branch", branch_id: "", zone_id: "", employee_id: "", metric: "", target: "", period_type: "monthly", ...periodDates("monthly")!, notes: "" };

export function goalToForm(goal: Goal): GoalForm {
  return {
    id: goal.id,
    title: goal.title,
    scope_type: goal.scope_type,
    branch_id: goal.branch_id ? String(goal.branch_id) : "",
    zone_id: goal.zone_id ? String(goal.zone_id) : "",
    employee_id: goal.employee_id ? String(goal.employee_id) : "",
    metric: goal.metric,
    target: String(goal.target),
    period_type: goal.period_type,
    start_date: goal.start_date,
    end_date: goal.end_date,
    notes: goal.notes ?? "",
  };
}

/** Goals → Set Goal / Edit Goal. */
export function GoalFormModal({ initial, onClose }: { initial: GoalForm | null; onClose: () => void }) {
  return initial ? <GoalFormBody initial={initial} onClose={onClose} /> : null;
}

function GoalFormBody({ initial, onClose }: { initial: GoalForm; onClose: () => void }) {
  const { data: options } = useApi<GoalOptions>("goals/options");
  const [form, setForm] = useState<GoalForm>(initial);
  const editing = Boolean(initial?.id);
  const save = useAction<GoalForm>(editing ? "put" : "post", (body) => (body.id ? `goals/${body.id}` : "goals"));


  const setPeriod = (period: string) => setForm({ ...form, period_type: period, ...(periodDates(period) ?? {}) });

  return (
    <Modal open={initial !== null} onClose={onClose} title={editing ? "Edit Goal" : "Set Goal"} size="lg" submitLabel={editing ? "Update" : "Save"} submitting={save.isPending} onSubmit={() => save.mutate(form, { onSuccess: onClose })}>
      <div className="row">
        <Field label="Goal Title:" required className="col-md-6" error={save.fieldError("title")}>
          <input className="form-control" placeholder="e.g. Wateja wapya mwezi huu" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </Field>
        <Field label="Goal For:" required className="col-md-3" error={save.fieldError("scope_type")}>
          <select className="form-control" value={form.scope_type} onChange={(e) => setForm({ ...form, scope_type: e.target.value })}>
            {options?.scopes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Field>
        <div className="col-md-3">
          {form.scope_type === "branch" && (
            <Field label="Branch:" required className="px-0" error={save.fieldError("branch_id")}>
              <SelectBox inputId="goal-branch" placeholder="Select Branch" optionsUrl="options/branches" value={form.branch_id} onChange={(value) => setForm({ ...form, branch_id: value ?? "" })} />
            </Field>
          )}
          {form.scope_type === "zone" && (
            <Field label="Zone:" required className="px-0" error={save.fieldError("zone_id")}>
              <SelectBox inputId="goal-zone" placeholder="Select Zone" options={options?.zones ?? []} value={form.zone_id} onChange={(value) => setForm({ ...form, zone_id: value ?? "" })} />
            </Field>
          )}
          {form.scope_type === "employee" && (
            <Field label="Officer:" required className="px-0" error={save.fieldError("employee_id")}>
              <SelectBox inputId="goal-employee" placeholder="Select Staff" optionsUrl="options/employees" value={form.employee_id} onChange={(value) => setForm({ ...form, employee_id: value ?? "" })} />
            </Field>
          )}
        </div>
        <Field label="Measure:" required className="col-md-6" error={save.fieldError("metric")}>
          <select className="form-control" value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })} required>
            <option value="">select</option>
            {options?.metrics.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Field>
        <Field label="Target:" required className="col-md-6" error={save.fieldError("target")}>
          <input type="number" min={1} step="any" className="form-control" placeholder="Target" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} required />
        </Field>
        <Field label="Period:" required className="col-md-4" error={save.fieldError("period_type")}>
          <select className="form-control" value={form.period_type} onChange={(e) => setPeriod(e.target.value)}>
            {options?.periods.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Field>
        <Field label="Start Date:" required className="col-md-4" error={save.fieldError("start_date")}>
          <input type="date" className="form-control" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value, period_type: "custom" })} required />
        </Field>
        <Field label="End Date:" required className="col-md-4" error={save.fieldError("end_date")}>
          <input type="date" className="form-control" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value, period_type: "custom" })} required />
        </Field>
        <Field label="Notes:" className="col-md-12" error={save.fieldError("notes")}>
          <textarea className="form-control" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

export function formatGoalValue(value: number, isMoney: boolean): string {
  return isMoney ? money(value) : String(Math.round(value * 100) / 100);
}

/** Goal detail: summary and cumulative progress chart against the straight target line. */
export function GoalDetailModal({ goalId, onClose }: { goalId: number | null; onClose: () => void }) {
  const { data } = useApi<GoalDetail>(goalId ? `goals/${goalId}` : null);
  const goal = data?.goal;
  const fmt = (value: number) => (goal ? formatGoalValue(value, goal.is_money) : String(value));

  return (
    <Modal open={goalId !== null} onClose={onClose} title={goal?.title ?? "Goal"} size="xl">
      {!data || !goal ? (
        <div className="mf-loading">Loading...</div>
      ) : (
        <>
          <div className="row mb-3">
            <div className="col-md-4"><b>Goal For:</b> {goal.scope_label} — {goal.assignee}</div>
            <div className="col-md-4"><b>Measure:</b> {goal.metric_label}</div>
            <div className="col-md-4"><b>Period:</b> {goal.start_date} to {goal.end_date}</div>
            <div className="col-md-4"><b>Target:</b> {fmt(goal.target)}</div>
            <div className="col-md-4"><b>Achieved:</b> {fmt(goal.progress.achieved)} ({goal.progress.percent}%)</div>
            <div className="col-md-4"><b>Status:</b> <Badge tone={STATUS_TONE[goal.progress.status]}>{STATUS_LABEL[goal.progress.status]}</Badge></div>
          </div>
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <ComposedChart data={data.series} margin={{ top: 10, right: 20, bottom: 0, left: 10 }}>
                <CartesianGrid stroke="#eee" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#777" }} tickLine={false} axisLine={{ stroke: "#ddd" }} />
                <YAxis tickFormatter={(value: number) => fmt(value)} tick={{ fontSize: 11, fill: "#777" }} tickLine={false} axisLine={false} width={90} />
                <Tooltip formatter={(value) => fmt(Number(value))} />
                <Legend />
                <Bar dataKey="value" name="Per period" fill={ACTUAL_COLOR} fillOpacity={0.35} radius={[4, 4, 0, 0]} />
                <Line type="linear" dataKey="cumulative" name="Achieved (cumulative)" stroke={ACTUAL_COLOR} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="linear" dataKey="target_line" name="Target line" stroke={TARGET_COLOR} strokeWidth={2} strokeDasharray="6 4" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {goal.notes && <p className="mt-2 mb-0"><b>Notes:</b> {goal.notes}</p>}
        </>
      )}
    </Modal>
  );
}
