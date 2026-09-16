"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { confirmAction } from "@/components/ui/notify";
import { money } from "@/lib/format";
import { useAction } from "@/lib/hooks";

import { isReversed, ReversedStatus, type Reversible } from "./Reversal";

/**
 * Segregation-of-duties fields the API adds to rows that go through Initiate → Pending Approval → Approve (rule 6).
 * `can_approve` is false for the initiator; `approve_blocked_reason` then explains why.
 */
export interface Approvable {
  id: number;
  amount: number;
  status: string;
  can_approve?: boolean;
  approve_blocked_reason?: string | null;
  can_reject?: boolean;
  requested_by?: string | null;
  initiated_by?: string | null;
  approved_by?: string | null;
  rejected_by?: string | null;
  rejection_reason?: string | null;
}

export const AWAITING_OTHER_APPROVER = "Awaiting approval by another user";

export function isPending(row: Pick<Approvable, "status">): boolean {
  return row.status === "pending";
}

/** Status badge for approval rows: PENDING / APPROVED (POSTED) / REJECTED (with reason) / REVERSED (with trace). */
export function ApprovalStatus({ row }: { row: Approvable & Reversible }) {
  if (isReversed(row)) {
    return <ReversedStatus row={row} />;
  }
  if (row.status === "pending") {
    return (
      <>
        <Badge tone="danger">PENDING APPROVAL</Badge>
        {(row.requested_by ?? row.initiated_by) && <div className="text-muted small">by {row.requested_by ?? row.initiated_by}</div>}
      </>
    );
  }
  if (row.status === "rejected") {
    return (
      <>
        <Badge tone="dark">REJECTED</Badge>
        <div className="text-muted small" style={{ whiteSpace: "normal", minWidth: 140 }}>
          {row.rejected_by && `by ${row.rejected_by}`}
          {row.rejection_reason && <div title={row.rejection_reason}>Reason: {row.rejection_reason}</div>}
        </div>
      </>
    );
  }

  return (
    <>
      <Badge tone="success">{row.status === "posted" ? "POSTED" : "APPROVED"}</Badge>
      {row.approved_by && <div className="text-muted small">by {row.approved_by}</div>}
    </>
  );
}

interface ApprovalActionsProps {
  row: Approvable;
  /** API path of the approve endpoint. */
  approvePath: string;
  /** API path of the reject endpoint (reason required); omitted when the row is deleted instead. */
  rejectPath?: string;
  /** What is being approved, e.g. "float to Kigoma". */
  description: string;
}

/**
 * APPROVE / REJECT actions for a pending row. The initiator sees a disabled Approve button with the API reason in the
 * tooltip ("Awaiting approval by another user"); users without the approval permission see nothing.
 */
export function ApprovalActions({ row, approvePath, rejectPath, description }: ApprovalActionsProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const approve = useAction<Record<string, never>>("post", approvePath);
  const reject = useAction<{ reason: string }>("post", rejectPath ?? approvePath);

  if (!isPending(row)) {
    return null;
  }

  const blocked = !row.can_approve && Boolean(row.approve_blocked_reason);
  const busy = approve.isPending || reject.isPending;

  return (
    <span className="d-inline-block text-nowrap" style={{ maxWidth: 240, whiteSpace: "normal" }}>
      {(row.can_approve || blocked) && (
        <span title={blocked ? `${AWAITING_OTHER_APPROVER}: ${row.approve_blocked_reason}` : "Approve"} className="d-inline-block mr-1">
          <button
            type="button"
            className={`btn btn-sm text-nowrap ${blocked ? "btn-outline-secondary" : "btn-success"}`}
            disabled={blocked || busy}
            style={blocked ? { pointerEvents: "none" } : undefined}
            onClick={async () => (await confirmAction("Approve this transaction?", `Approve and post ${money(row.amount)} — ${description}.`)) && approve.mutate({})}
          >
            <i className={blocked ? "icon-lock" : "icon-check"} /> Approve
          </button>
        </span>
      )}
      {rejectPath && row.can_reject && (
        <button
          type="button"
          className="btn btn-sm btn-outline-danger text-nowrap"
          disabled={busy}
          onClick={() => {
            setReason("");
            reject.setErrors({});
            setOpen(true);
          }}
        >
          <i className="icon-close" /> Reject
        </button>
      )}
      {blocked && <small className="text-muted d-block">{AWAITING_OTHER_APPROVER}</small>}
      {rejectPath && (
        <Modal open={open} onClose={() => setOpen(false)} title="Reject Pending Transaction" submitLabel="Reject" submitting={reject.isPending} onSubmit={() => reject.mutate({ reason }, { onSuccess: () => setOpen(false) })}>
          <p className="mb-2">
            Reject <b>{money(row.amount)}</b> — {description}? Nothing was posted; the request stays listed as REJECTED.
          </p>
          <Field label="Reason:" required error={reject.fieldError("reason")}>
            <textarea className="form-control" rows={3} maxLength={255} minLength={3} value={reason} onChange={(event) => setReason(event.target.value)} required />
          </Field>
        </Modal>
      )}
    </span>
  );
}

/** Disabled approve/accept button shown to the initiator of a pending row (tooltip carries the API reason). */
export function BlockedApproveButton({ reason, label = "Approve" }: { reason: string; label?: string }) {
  return (
    <span title={`${AWAITING_OTHER_APPROVER}: ${reason}`} className="d-inline-block mr-1" style={{ maxWidth: 220, whiteSpace: "normal" }}>
      <button type="button" className="btn btn-sm btn-outline-secondary text-nowrap" disabled style={{ pointerEvents: "none" }}>
        <i className="icon-lock" /> {label}
      </button>
      <small className="text-muted d-block">{AWAITING_OTHER_APPROVER}</small>
    </span>
  );
}
