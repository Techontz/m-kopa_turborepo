"use client";

import { useState } from "react";

import { ApprovalActions } from "@/components/finance/Approval";
import { BranchStaffFields, FilterModal, HeaderButton, sum, type Filters } from "@/components/hrm/common";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface Recovery {
  period: string;
  commission: number;
  amount: number;
  outstanding_after: number;
  salary_payment_id: number | null;
}

interface NegligenceDeduction {
  id: number;
  branch: string | null;
  employee_id: number;
  employee: string | null;
  amount: number;
  recovered_amount: number;
  outstanding_amount: number;
  reason: string;
  status: string;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  recoveries: Recovery[];
  can_approve: boolean;
  approve_blocked_reason: string | null;
}

const STATUSES = [
  { value: "", label: "ALL" },
  { value: "pending", label: "PENDING FINANCE APPROVAL" },
  { value: "approved", label: "APPROVED" },
  { value: "recovering", label: "RECOVERING" },
  { value: "recovered", label: "RECOVERED" },
  { value: "rejected", label: "REJECTED" },
];

const STATUS_TONES: Record<string, BadgeTone> = { pending: "warning", approved: "info", recovering: "primary", recovered: "success", rejected: "danger" };

const RULE = "Recovered from commission only — never from salary; recovered money returns to the Principal account.";

const EMPTY = { blanch_id: "", empl_id: "", amount: "", reason: "" };

/**
 * HRM → Negligence / Loss Deductions (spec §23 / §57): HR records a staff loss → Finance approves or rejects with a reason →
 * each payroll recovers it from the employee's commission (never salary), carrying any balance to the next commission. The
 * HR creator and the charged employee cannot approve it.
 */
export default function NegligenceDeductionsPage() {
  const { can } = useAuth();
  const [filters, setFilters] = useState<Filters>({});
  const [status, setStatus] = useState("");
  const [filtering, setFiltering] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [history, setHistory] = useState<NegligenceDeduction | null>(null);
  const { data: rows, isLoading } = useApi<NegligenceDeduction[]>("hrm/negligence-deductions", { ...filters, ...(status ? { status } : {}) });
  const create = useAction<{ employee_id: string; amount: string; reason: string }>("post", "hrm/negligence-deductions");
  const canCreate = can("hrm.manage");
  const canDecide = can("payroll.pay");

  const openCreate = () => {
    setForm(EMPTY);
    create.setErrors({});
    setCreating(true);
  };
  const fieldError = (field: string) => create.fieldError(field === "empl_id" ? "employee_id" : field);

  return (
    <>
      <PageHeader crumbs={["HRM", "Negligence / Loss Deductions"]} />
      <Card
        title={<>Negligence / Loss Deductions · outstanding <b>{money(sum(rows?.filter((row) => row.status !== "rejected"), (row) => row.outstanding_amount))}</b></>}
        actions={
          <span className="d-inline-flex align-items-center">
            <select className="form-control form-control-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <HeaderButton onClick={() => setFiltering(true)} />
            {canCreate && <HeaderButton icon="icon-plus" title="Add negligence / loss deduction" onClick={openCreate} />}
          </span>
        }
      >
        <div className="alert alert-info py-2">
          <i className="icon-info mr-1" /> {RULE}
        </div>
        <DataTable
          rows={rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "employee", header: "Staff name" },
            { key: "branch", header: "Branch", render: (row) => row.branch ?? "—" },
            { key: "amount", header: "Amount", render: (row) => money(row.amount), value: (row) => row.amount },
            {
              key: "recovered_amount",
              header: "Recovered",
              value: (row) => row.recovered_amount,
              render: (row) => (row.recoveries.length > 0
                ? <button type="button" className="btn btn-link btn-sm p-0" title="Recovery history" onClick={() => setHistory(row)}>{money(row.recovered_amount)}</button>
                : money(row.recovered_amount)),
            },
            { key: "outstanding_amount", header: "Outstanding", render: (row) => money(row.outstanding_amount), value: (row) => row.outstanding_amount },
            {
              key: "status",
              header: "Status",
              render: (row) => (
                <span style={{ whiteSpace: "normal" }}>
                  <Badge tone={STATUS_TONES[row.status] ?? "default"}>{row.status === "pending" ? "PENDING FINANCE APPROVAL" : row.status.toUpperCase()}</Badge>
                  {row.rejected_by && <div className="small text-muted">by {row.rejected_by}</div>}
                  {row.rejection_reason && <div className="small text-muted">Reason: {row.rejection_reason}</div>}
                </span>
              ),
            },
            { key: "reason", header: "Reason", render: (row) => <span style={{ whiteSpace: "normal" }}>{row.reason}</span> },
            { key: "created_by", header: "Created By", render: (row) => <>{row.created_by ?? "—"}<div className="small text-muted">{row.created_at}</div></> },
            { key: "approved_by", header: "Approved By", render: (row) => (row.approved_by ? <>{row.approved_by}<div className="small text-muted">{row.approved_at}</div></> : "—") },
            ...(canDecide
              ? [{
                  key: "action",
                  header: "Action",
                  sortable: false,
                  render: (row: NegligenceDeduction) => (
                    <ApprovalActions
                      row={{ id: row.id, amount: row.amount, status: row.status, can_approve: row.can_approve, approve_blocked_reason: row.approve_blocked_reason, can_reject: row.can_approve }}
                      approvePath={`hrm/negligence-deductions/${row.id}/approve`}
                      rejectPath={`hrm/negligence-deductions/${row.id}/reject`}
                      description={`negligence / loss deduction for ${row.employee ?? "staff"}, recovered from commission only`}
                    />
                  ),
                }]
              : []),
          ]}
        />
      </Card>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Negligence / Loss Deduction"
        submitLabel="Save"
        submitting={create.isPending}
        onSubmit={() => create.mutate({ employee_id: form.empl_id, amount: form.amount, reason: form.reason }, { onSuccess: () => setCreating(false) })}
      >
        <div className="row">
          <BranchStaffFields className="col-md-6" branchPlaceholder="Select branch" branchId={form.blanch_id} employeeId={form.empl_id} onChange={(value) => setForm({ ...form, ...value })} errors={fieldError} />
          <Field label="Amount:" className="col-md-6" required error={create.fieldError("amount")}>
            <input type="number" min={1} className="form-control" placeholder="Enter Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </Field>
          <Field label="Reason:" className="col-md-12" required error={create.fieldError("reason")}>
            <textarea className="form-control" rows={3} maxLength={2000} placeholder="What was lost and why the staff member is liable" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
          </Field>
        </div>
        <small className="text-muted">Sent to Finance for approval. {RULE}</small>
      </Modal>

      <Modal open={history !== null} onClose={() => setHistory(null)} title={`Recoveries — ${history?.employee ?? ""}`} size="lg">
        <DataTable
          rows={history?.recoveries}
          rowKey={(row) => `${row.period}-${row.salary_payment_id ?? ""}`}
          columns={[
            { key: "period", header: "Payroll Period" },
            { key: "commission", header: "Commission", render: (row) => money(row.commission), value: (row) => row.commission },
            { key: "amount", header: "Recovered", render: (row) => money(row.amount), value: (row) => row.amount },
            { key: "outstanding_after", header: "Outstanding After", render: (row) => money(row.outstanding_after), value: (row) => row.outstanding_after },
          ]}
        />
      </Modal>

      <FilterModal open={filtering} onClose={() => setFiltering(false)} onApply={setFilters} />
    </>
  );
}
