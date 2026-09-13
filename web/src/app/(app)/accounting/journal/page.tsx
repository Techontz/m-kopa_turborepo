"use client";

import { useState } from "react";

import { BranchScopeSelect } from "@/components/accounting/BranchScopeSelect";
import type { JournalEntry } from "@/components/accounting/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { promptReason } from "@/components/ui/notify";
import { useAuth } from "@/lib/auth";
import { money, todayIso } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface JournalFilters {
  from: string;
  to: string;
  branch_id: string;
  account: string;
  source: string;
  reference: string;
}

const monthStart = () => `${todayIso().slice(0, 8)}01`;

function StatusBadge({ entry }: { entry: JournalEntry }) {
  if (entry.reversal_of_id) {
    return <Badge tone="warning">REVERSAL</Badge>;
  }
  return entry.is_reversed ? <Badge tone="danger">REVERSED</Badge> : <Badge tone="success">POSTED</Badge>;
}

export default function JournalEntriesPage() {
  const { can } = useAuth();
  const initial: JournalFilters = { from: monthStart(), to: todayIso(), branch_id: "all", account: "", source: "", reference: "" };
  const [filters, setFilters] = useState<JournalFilters>(initial);
  const [form, setForm] = useState<JournalFilters>(initial);
  const [filtering, setFiltering] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);

  const { data: entries, isLoading } = useApi<JournalEntry[]>("accounting/journal", { ...filters });
  const { data: detail } = useApi<JournalEntry>(viewing ? `accounting/journal/${viewing}` : null);
  const reverse = useAction<{ id: number; reason: string }>("post", (body) => `accounting/journal/${body.id}/reverse`);

  const askReverse = async (entry: JournalEntry) => {
    const reason = await promptReason(`Reverse ${entry.reference}?`);
    if (reason) {
      reverse.mutate({ id: entry.id, reason }, { onSuccess: () => setViewing(null) });
    }
  };

  const canReverse = (entry: JournalEntry) => can("accounting.reverse") && !entry.is_reversed && !entry.reversal_of_id;
  const total = (entries ?? []).reduce((sum, entry) => sum + entry.total, 0);

  return (
    <>
      <PageHeader crumbs={["Accounting", "Journal Entries"]} />

      <Card
        title={`Journal Entries From: ${filters.from} To: ${filters.to}`}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => { setForm(filters); setFiltering(true); }} title="Filter">
            <i className="icon-magnifier" />
          </button>
        }
      >
        <DataTable
          rows={entries}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "entry_date", header: "Date" },
            { key: "reference", header: "Reference" },
            { key: "description", header: "Description" },
            { key: "branch", header: "Branch" },
            { key: "source_label", header: "Source" },
            { key: "total", header: "Amount", render: (row) => money(row.total), className: "text-right" },
            { key: "employee", header: "Posted By", value: (row) => row.employee ?? "SYSTEM", render: (row) => row.employee ?? "SYSTEM" },
            { key: "status", header: "Status", value: (row) => (row.reversal_of_id ? "REVERSAL" : row.is_reversed ? "REVERSED" : "POSTED"), render: (row) => <StatusBadge entry={row} /> },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  <button type="button" className="btn btn-sm btn-icon btn-primary mr-1" title="View" onClick={() => setViewing(row.id)}><i className="icon-eye" /></button>
                  {canReverse(row) && (
                    <button type="button" className="btn btn-sm btn-icon btn-danger" title="Reverse" disabled={reverse.isPending} onClick={() => askReverse(row)}><i className="icon-action-undo" /></button>
                  )}
                </>
              ),
            },
          ]}
          footer={
            <tr>
              <td colSpan={6}><b>TOTAL</b></td>
              <td className="text-right"><b>{money(total)}</b></td>
              <td colSpan={3} />
            </tr>
          }
        />
      </Card>

      <Modal open={filtering} onClose={() => setFiltering(false)} title="Filter Journal Entries" submitLabel="Filter" onSubmit={() => { setFilters(form); setFiltering(false); }}>
        <div className="row">
          <Field label="From:" className="col-md-6">
            <input type="date" className="form-control" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} required />
          </Field>
          <Field label="To:" className="col-md-6">
            <input type="date" className="form-control" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} required />
          </Field>
          <Field label="Branch:" className="col-md-12">
            <BranchScopeSelect value={form.branch_id} onChange={(branch_id) => setForm({ ...form, branch_id })} />
          </Field>
          <Field label="Account:" className="col-md-12">
            <SelectBox placeholder="All accounts" optionsUrl="accounting/account-options" isClearable value={form.account} onChange={(value) => setForm({ ...form, account: value ?? "" })} />
          </Field>
          <Field label="Source:" className="col-md-6">
            <SelectBox placeholder="All sources" optionsUrl="accounting/journal-sources" isClearable value={form.source} onChange={(value) => setForm({ ...form, source: value ?? "" })} />
          </Field>
          <Field label="Reference:" className="col-md-6">
            <input className="form-control" placeholder="Reference" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal open={viewing !== null} onClose={() => setViewing(null)} title={detail ? `Journal Entry ${detail.reference}` : "Journal Entry"} size="lg">
        {!detail || detail.id !== viewing ? (
          <div className="mf-loading">Loading...</div>
        ) : (
          <>
            <table className="table table-sm table-borderless mb-3">
              <tbody>
                <tr><th style={{ width: "25%" }}>Date:</th><td>{detail.entry_date}</td><th style={{ width: "20%" }}>Branch:</th><td>{detail.branch}</td></tr>
                <tr><th>Description:</th><td>{detail.description}</td><th>Source:</th><td>{detail.source_label}{detail.source_id ? ` #${detail.source_id}` : ""}</td></tr>
                <tr><th>Posted By:</th><td>{detail.employee ?? "SYSTEM"}</td><th>Status:</th><td><StatusBadge entry={detail} /></td></tr>
                {detail.reversal_of && <tr><th>Reversal Of:</th><td>{detail.reversal_of}</td><th>Reason:</th><td>{detail.reversal_reason}</td></tr>}
                {detail.reversed_by && <tr><th>Reversed By Entry:</th><td colSpan={3}>{detail.reversed_by}</td></tr>}
              </tbody>
            </table>
            <div className="table-responsive">
              <table className="table table-hover table-custom mf-table">
                <thead className="thead-info">
                  <tr><th>Code</th><th>Account</th><th>Branch / Sub-ledger</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr>
                </thead>
                <tbody>
                  {(detail.lines ?? []).map((line) => (
                    <tr key={line.id}>
                      <td>{line.code}</td>
                      <td>{line.account}</td>
                      <td>{line.scope}</td>
                      <td className="text-right">{line.debit ? money(line.debit) : ""}</td>
                      <td className="text-right">{line.credit ? money(line.credit) : ""}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}><b>TOTAL</b></td>
                    <td className="text-right"><b>{money((detail.lines ?? []).reduce((sum, line) => sum + line.debit, 0))}</b></td>
                    <td className="text-right"><b>{money((detail.lines ?? []).reduce((sum, line) => sum + line.credit, 0))}</b></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {canReverse(detail) && (
              <div className="text-right">
                <button type="button" className="btn btn-danger" disabled={reverse.isPending} onClick={() => askReverse(detail)}><i className="icon-action-undo" /> Reverse Entry</button>
              </div>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
