"use client";

import { useState } from "react";

import { BlockedApproveButton } from "@/components/finance/Approval";
import { HeaderButton } from "@/components/hrm/common";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { confirmAction, promptReason } from "@/components/ui/notify";
import { SelectBox, type Option } from "@/components/ui/SelectBox";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

export type ClaimStatus = "prepared" | "finance_review" | "approved" | "paid" | "rejected";

interface Claim {
  id: number;
  employee: string | null;
  branch: string | null;
  amount: number;
  entitlement: number | null;
  reason: string;
  status: ClaimStatus;
  status_label: string;
  prepared_by: string | null;
  prepared_at: string | null;
  reviewed_by: string | null;
  approved_by: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  paid_by: string | null;
  paid_at: string | null;
  journal_reference: string | null;
  can_approve: boolean;
  approve_blocked_reason: string | null;
  can_pay: boolean;
  pay_blocked_reason: string | null;
}

interface Entitlement {
  benefit_record: number;
  open_claims: number;
  claimable: number;
}

export const CLAIM_STATUS_TONES: Record<ClaimStatus, BadgeTone> = { prepared: "warning", finance_review: "info", approved: "primary", paid: "success", rejected: "dark" };

const EMPTY = { empl_id: "", amount: "", reason: "" };

/**
 * Staff benefit claims (spec §27 / §49): HR (hrm.manage) prepares the claim against the employee's recorded benefit entitlement
 * → Finance (payroll.pay) reviews → approves → pays from the single STAFF FUND A/C (or rejects). Only the payment moves money;
 * a claim above the fund's available cash is refused at payment. The API blocks the preparer and the claimant (rule 6).
 */
export function StaffBenefitClaims({ members }: { members: Option[] }) {
  const { can } = useAuth();
  const canPrepare = can("hrm.manage");
  const canDecide = can("payroll.pay");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const { data: claims, isLoading } = useApi<Claim[]>(canPrepare || canDecide ? "hrm/staff-fund/claims" : null);
  const { data: entitlement } = useApi<Entitlement>(open && form.empl_id ? `hrm/staff-fund/entitlements/${form.empl_id}` : null);
  const prepare = useAction<typeof EMPTY>("post", "hrm/staff-fund/claims");
  const decide = useAction<{ id: number; action: "review" | "approve" | "pay" | "reject"; reason?: string }>("post", (body) => `hrm/staff-fund/claims/${body.id}/${body.action}`);

  if (!canPrepare && !canDecide) {
    return null;
  }

  const act = async (claim: Claim, action: "review" | "approve" | "pay") => {
    const text = `${claim.employee} — ${money(claim.amount)}${action === "pay" ? " from the STAFF FUND A/C" : ""}.`;
    if (await confirmAction(`${action === "review" ? "Take into Finance review" : action === "approve" ? "Approve" : "Pay"} this benefit claim?`, text)) {
      decide.mutate({ id: claim.id, action });
    }
  };

  return (
    <Card title="Staff Benefit Claims" actions={canPrepare && <HeaderButton icon="icon-plus" title="Prepare benefit claim" onClick={() => { setForm(EMPTY); prepare.setErrors({}); setOpen(true); }} />}>
      <DataTable
        rows={claims}
        loading={isLoading}
        rowKey={(row) => row.id}
        columns={[
          { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
          { key: "employee", header: "Staff name" },
          { key: "branch", header: "Branch", render: (row) => row.branch ?? "—" },
          { key: "entitlement", header: "Benefit Record", render: (row) => (row.entitlement === null ? "—" : money(row.entitlement)) },
          { key: "amount", header: "Claim", render: (row) => money(row.amount), value: (row) => row.amount },
          { key: "reason", header: "Reason" },
          {
            key: "status",
            header: "Status",
            value: (row) => row.status_label,
            render: (row) => (
              <span style={{ whiteSpace: "normal", minWidth: 150, display: "inline-block" }}>
                <Badge tone={CLAIM_STATUS_TONES[row.status] ?? "default"}>{row.status_label.toUpperCase()}</Badge>
                {row.prepared_by && <div className="small text-muted">Prepared by {row.prepared_by}</div>}
                {row.reviewed_by && <div className="small text-muted">Reviewed by {row.reviewed_by}</div>}
                {row.approved_by && <div className="small text-muted">Approved by {row.approved_by}</div>}
                {row.paid_by && <div className="small text-muted">Paid {row.paid_at} by {row.paid_by}{row.journal_reference ? ` · ${row.journal_reference}` : ""}</div>}
                {row.rejection_reason && <div className="small text-danger">Rejected by {row.rejected_by}: {row.rejection_reason}</div>}
              </span>
            ),
          },
          {
            key: "action",
            header: "Action",
            sortable: false,
            render: (row) => {
              if (!canDecide) {
                return null;
              }
              const deciding = row.status === "prepared" || row.status === "finance_review";
              return (
                <span className="d-inline-block text-nowrap">
                  {deciding && !row.can_approve && row.approve_blocked_reason && <BlockedApproveButton reason={row.approve_blocked_reason} />}
                  {row.status === "prepared" && row.can_approve && <button type="button" className="btn btn-sm btn-info mr-1" disabled={decide.isPending} onClick={() => act(row, "review")}>Review</button>}
                  {deciding && row.can_approve && <button type="button" className="btn btn-sm btn-success mr-1" disabled={decide.isPending} onClick={() => act(row, "approve")}><i className="icon-check" /> Approve</button>}
                  {row.status === "approved" && (row.can_pay ? <button type="button" className="btn btn-sm btn-warning mr-1" disabled={decide.isPending} onClick={() => act(row, "pay")}>Pay</button> : row.pay_blocked_reason ? <BlockedApproveButton reason={row.pay_blocked_reason} label="Pay" /> : null)}
                  {((deciding && row.can_approve) || (row.status === "approved" && row.can_pay)) && (
                    <button type="button" className="btn btn-sm btn-outline-danger" disabled={decide.isPending} onClick={async () => { const reason = await promptReason("Reason for rejecting this benefit claim"); if (reason) { decide.mutate({ id: row.id, action: "reject", reason }); } }}>
                      <i className="icon-close" /> Reject
                    </button>
                  )}
                </span>
              );
            },
          },
        ]}
      />

      <Modal open={open} onClose={() => setOpen(false)} title="Prepare Staff Benefit Claim" submitLabel="Prepare" submitting={prepare.isPending} onSubmit={() => prepare.mutate(form, { onSuccess: () => { setOpen(false); setForm(EMPTY); } })}>
        <div className="row">
          <Field label="Staff:" className="col-md-12" error={prepare.fieldError("empl_id")}>
            <SelectBox placeholder="Select Staff" options={members} value={form.empl_id} onChange={(value) => setForm({ ...form, empl_id: value ?? "" })} />
          </Field>
          {entitlement && (
            <p className="col-md-12 small mb-2">
              Recorded benefit: <b>{money(entitlement.benefit_record)}</b> · Open claims: <b>{money(entitlement.open_claims)}</b> · Claimable: <b>{money(entitlement.claimable)}</b>
            </p>
          )}
          <Field label="Amount:" className="col-md-12" error={prepare.fieldError("amount")}>
            <input type="number" className="form-control" placeholder="Enter Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </Field>
          <Field label="Reason:" className="col-md-12" error={prepare.fieldError("reason")}>
            <textarea className="form-control" rows={3} placeholder="Enter Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
          </Field>
        </div>
        <small className="text-muted">The claim goes to Finance for review and approval. Money leaves the STAFF FUND A/C only when Finance pays it.</small>
      </Modal>
    </Card>
  );
}
