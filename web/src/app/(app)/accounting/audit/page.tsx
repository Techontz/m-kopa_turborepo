"use client";

import { useState } from "react";

import type { AuditChange, AuditEntry } from "@/components/accounting/types";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { todayIso } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface AuditFilters {
  from: string;
  to: string;
  employee_id: string;
  model: string;
  action: string;
}

const EVENT_TONES: Record<string, BadgeTone> = { created: "success", updated: "info", deleted: "danger", reversed: "warning", closed: "dark" };

const ACTIONS = [
  { value: "created", label: "Created" },
  { value: "updated", label: "Updated" },
  { value: "deleted", label: "Deleted" },
  { value: "reversed", label: "Reversed" },
  { value: "closed", label: "Closed" },
];

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function ChangeList({ changes, limit }: { changes: AuditChange[]; limit?: number }) {
  const visible = limit ? changes.slice(0, limit) : changes;
  return (
    <>
      {visible.map((change) => (
        <div key={change.field} style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
          <b>{change.field}:</b> <span className="text-danger">{show(change.before)}</span> → <span className="text-success">{show(change.after)}</span>
        </div>
      ))}
      {limit && changes.length > limit && <small className="text-muted">+{changes.length - limit} more</small>}
    </>
  );
}

export default function AuditTrailPage() {
  const initial: AuditFilters = { from: daysAgo(30), to: todayIso(), employee_id: "", model: "", action: "" };
  const [filters, setFilters] = useState<AuditFilters>(initial);
  const [form, setForm] = useState<AuditFilters>(initial);
  const [filtering, setFiltering] = useState(false);
  const [viewing, setViewing] = useState<AuditEntry | null>(null);

  const { data: logs, isLoading } = useApi<AuditEntry[]>("accounting/audit", { ...filters });

  return (
    <>
      <PageHeader crumbs={["Accounting", "Audit Trail"]} />

      <Card
        title={`Audit Trail From: ${filters.from} To: ${filters.to}`}
        actions={
          <button type="button" className="btn btn-primary" title="Filter" onClick={() => { setForm(filters); setFiltering(true); }}>
            <i className="icon-magnifier" />
          </button>
        }
      >
        <DataTable
          rows={logs}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "created_at", header: "Date & Time", className: "text-nowrap" },
            { key: "employee", header: "Done By" },
            { key: "event", header: "Action", render: (row) => <Badge tone={EVENT_TONES[row.event] ?? "default"}>{row.event.toUpperCase()}</Badge> },
            { key: "model", header: "Record", value: (row) => `${row.model ?? ""} ${row.model_id ?? ""}`, render: (row) => (row.model ? `${row.model} #${row.model_id}` : "") },
            { key: "changes", header: "Before → After", sortable: false, value: (row) => row.changes.map((change) => `${change.field} ${show(change.before)} ${show(change.after)}`).join(" "), render: (row) => <ChangeList changes={row.changes} limit={3} /> },
            { key: "ip_address", header: "IP Address" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              render: (row) => <button type="button" className="btn btn-sm btn-icon btn-primary" title="View" onClick={() => setViewing(row)}><i className="icon-eye" /></button>,
            },
          ]}
        />
      </Card>

      <Modal open={filtering} onClose={() => setFiltering(false)} title="Filter Audit Trail" submitLabel="Filter" onSubmit={() => { setFilters(form); setFiltering(false); }}>
        <div className="row">
          <Field label="From:" className="col-md-6">
            <input type="date" className="form-control" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} required />
          </Field>
          <Field label="To:" className="col-md-6">
            <input type="date" className="form-control" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} required />
          </Field>
          <Field label="Staff:" className="col-md-12">
            <SelectBox placeholder="All staff" optionsUrl="options/employees" isClearable value={form.employee_id} onChange={(value) => setForm({ ...form, employee_id: value ?? "" })} />
          </Field>
          <Field label="Record type:" className="col-md-6">
            <SelectBox placeholder="All records" optionsUrl="accounting/audit-models" isClearable value={form.model} onChange={(value) => setForm({ ...form, model: value ?? "" })} />
          </Field>
          <Field label="Action:" className="col-md-6">
            <SelectBox placeholder="All actions" options={ACTIONS} isClearable value={form.action} onChange={(value) => setForm({ ...form, action: value ?? "" })} />
          </Field>
        </div>
      </Modal>

      <Modal open={viewing !== null} onClose={() => setViewing(null)} title={viewing ? `${viewing.action} #${viewing.model_id ?? ""}` : ""} size="lg">
        {viewing && (
          <>
            <p className="mb-2">
              <b>Done By:</b> {viewing.employee} &nbsp; <b>Date:</b> {viewing.created_at} &nbsp; <b>IP:</b> {viewing.ip_address ?? "—"}
            </p>
            <div className="table-responsive">
              <table className="table table-hover table-custom mf-table">
                <thead className="thead-info">
                  <tr><th>Field</th><th>Before</th><th>After</th></tr>
                </thead>
                <tbody>
                  {viewing.changes.length === 0 && <tr><td colSpan={3} className="text-center">No field changes recorded</td></tr>}
                  {viewing.changes.map((change) => (
                    <tr key={change.field}>
                      <td>{change.field}</td>
                      <td className="text-danger" style={{ wordBreak: "break-word" }}>{show(change.before)}</td>
                      <td className="text-success" style={{ wordBreak: "break-word" }}>{show(change.after)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
