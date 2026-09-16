"use client";

import { useState } from "react";

import { ApprovalActions } from "@/components/finance/Approval";
import { BranchStaffFields, currentMonth, FilterModal, HeaderButton, type Filters } from "@/components/hrm/common";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction } from "@/components/ui/notify";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface Allowance {
  id: number;
  branch: string | null;
  employee: string | null;
  amount: number;
  reason: string | null;
  description: string | null;
  payroll_period: string | null;
  recurring: boolean;
  status: string;
  status_label: string;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  payroll: string | null;
  paid_at: string | null;
  created_at: string;
  can_approve: boolean;
  approve_blocked_reason: string | null;
}

const REASONS = [
  { value: "overtime", label: "Overtime" },
  { value: "leave", label: "Leave" },
  { value: "transport", label: "Transport" },
  { value: "other", label: "Other" },
];

const STATUSES = [
  { value: "", label: "ALL" },
  { value: "pending", label: "PENDING FINANCE APPROVAL" },
  { value: "approved", label: "APPROVED / AWAITING PAYROLL" },
  { value: "paid", label: "PAID" },
  { value: "rejected", label: "REJECTED" },
  { value: "active", label: "RECURRING (LEGACY)" },
  { value: "stopped", label: "STOPPED" },
];

const STATUS_TONES: Record<string, BadgeTone> = { pending: "warning", approved: "info", paid: "primary", rejected: "danger", active: "success", stopped: "default" };

const STOPPABLE = ["active", "pending", "approved"];

const emptyForm = () => ({ blanch_id: "", empl_id: "", new_amount: "", reason: "overtime", payroll_period: currentMonth(), remaks_allow: "" });

/**
 * HRM → Staff Allowance (spec §24 / §58): HR records an allowance with its reason and payroll period → Finance approves
 * (Approved / Awaiting Payroll — no money moves) or rejects with a reason → the payroll of that period pays it. The HR creator
 * and the receiving employee cannot approve it.
 */
export default function StaffAllowancePage() {
  const { can } = useAuth();
  const [filters, setFilters] = useState<Filters>({});
  const [status, setStatus] = useState("");
  const [filtering, setFiltering] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const { data: allowances, isLoading } = useApi<Allowance[]>("hrm/allowances", { ...filters, ...(status ? { status } : {}) });
  const create = useAction<ReturnType<typeof emptyForm>>("post", "hrm/allowances");
  const stop = useAction<{ id: number }>("post", (body) => `hrm/allowances/${body.id}/stop`);
  const canCreate = can("hrm.manage");
  const canDecide = can("payroll.pay");

  return (
    <>
      <PageHeader crumbs={["HRM", "Staff Allowance"]} />
      {canCreate && (
        <Card title="Staff Allowance Form">
          <form onSubmit={(e) => { e.preventDefault(); create.mutate(form, { onSuccess: () => setForm(emptyForm()) }); }} onReset={() => setForm(emptyForm())}>
            <div className="row">
              <BranchStaffFields className="col-lg-4 col-6" branchPlaceholder="Select branch" branchId={form.blanch_id} employeeId={form.empl_id} onChange={(value) => setForm({ ...form, ...value })} errors={create.fieldError} />
              <Field label="Amount" className="col-lg-4 col-6" error={create.fieldError("new_amount")}>
                <input type="number" min={1} className="form-control input-sm" placeholder="Enter Amount" value={form.new_amount} onChange={(e) => setForm({ ...form, new_amount: e.target.value })} required />
              </Field>
              <Field label="Reason" className="col-lg-4 col-6" error={create.fieldError("reason")}>
                <select className="form-control input-sm" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required>
                  {REASONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </Field>
              <Field label="Payroll Period" className="col-lg-4 col-6" error={create.fieldError("payroll_period")}>
                <input type="month" className="form-control input-sm" value={form.payroll_period} onChange={(e) => setForm({ ...form, payroll_period: e.target.value })} required />
              </Field>
              <Field label="Description" className="col-md-12 col-12" error={create.fieldError("remaks_allow")}>
                <textarea className="form-control" rows={4} placeholder="Enter Description" value={form.remaks_allow} onChange={(e) => setForm({ ...form, remaks_allow: e.target.value })} />
              </Field>
            </div>
            <small className="text-muted d-block">The allowance is sent to Finance for approval. Once approved it waits for the payroll of its period, which pays it.</small>
            <div className="text-center mt-3">
              <button type="submit" className="btn btn-primary btn-sm mr-1" disabled={create.isPending}>Save</button>
              <button type="reset" className="btn btn-danger btn-sm">Cancel</button>
            </div>
          </form>
        </Card>
      )}

      <Card
        title="Staff Allowance List"
        actions={
          <span className="d-inline-flex align-items-center">
            <select className="form-control form-control-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <HeaderButton onClick={() => setFiltering(true)} />
          </span>
        }
      >
        <DataTable
          rows={allowances}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "branch", header: "Branch" },
            { key: "employee", header: "Staff name" },
            { key: "amount", header: "Amount", render: (row) => money(row.amount), value: (row) => row.amount },
            { key: "reason", header: "Reason", render: (row) => (row.reason ? row.reason.toUpperCase() : "—") },
            { key: "payroll_period", header: "Payroll Period", render: (row) => (row.recurring ? "Every payroll" : row.payroll_period ?? "—") },
            { key: "description", header: "Description" },
            {
              key: "status",
              header: "Status",
              value: (row) => row.status_label,
              render: (row) => (
                <span style={{ whiteSpace: "normal" }}>
                  <Badge tone={STATUS_TONES[row.status] ?? "default"}>{row.status_label.toUpperCase()}</Badge>
                  {row.approved_by && <div className="small text-muted">by {row.approved_by}</div>}
                  {row.payroll && <div className="small text-muted">Payroll {row.payroll}</div>}
                  {row.rejection_reason && <div className="small text-muted">Reason: {row.rejection_reason}</div>}
                </span>
              ),
            },
            { key: "created_by", header: "Created By", render: (row) => row.created_by ?? "—" },
            { key: "created_at", header: "Date" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              render: (row) => (
                <span className="d-inline-block">
                  {canDecide && (
                    <ApprovalActions
                      row={{ id: row.id, amount: row.amount, status: row.status, can_approve: row.can_approve, approve_blocked_reason: row.approve_blocked_reason, can_reject: row.can_approve }}
                      approvePath={`hrm/allowances/${row.id}/approve`}
                      rejectPath={`hrm/allowances/${row.id}/reject`}
                      description={`${(row.reason ?? "other").toUpperCase()} allowance for ${row.employee ?? "staff"} (${row.payroll_period ?? ""}); it then awaits payroll`}
                    />
                  )}
                  {canCreate && STOPPABLE.includes(row.status) && (
                    <button type="button" className="btn btn-sm btn-danger ml-1" title="Stop allowance" disabled={stop.isPending} onClick={async () => (await confirmAction()) && stop.mutate({ id: row.id })}>
                      <i className={stop.isPending && stop.variables?.id === row.id ? "fa fa-spinner fa-spin" : "icon-close"} />
                    </button>
                  )}
                </span>
              ),
            },
          ]}
        />
      </Card>

      <FilterModal open={filtering} onClose={() => setFiltering(false)} onApply={setFilters} />
    </>
  );
}
