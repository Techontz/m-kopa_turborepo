"use client";

import { BlockedApproveButton } from "@/components/finance/Approval";
import { statusTone } from "@/components/hrm/common";
import type { StaffAdvance, StaffLoan } from "@/components/hrm/types";
import { Badge } from "@/components/ui/Badge";
import { confirmAction, promptReason } from "@/components/ui/notify";
import { useAction } from "@/lib/hooks";

type Credit = StaffLoan | StaffAdvance;

const STEPS: Record<NonNullable<Credit["next_action"]>, { endpoint: string; label: string; confirm: string; icon: string; tone: string }> = {
  approve: { endpoint: "approve", label: "HR Approve", confirm: "Approve as HR?", icon: "icon-like", tone: "success" },
  admin_approve: { endpoint: "approve", label: "Admin Approve", confirm: "Approve as Admin (HR self-request)?", icon: "icon-like", tone: "success" },
  finance_approve: { endpoint: "finance-approve", label: "Finance Approve", confirm: "Give the Finance approval?", icon: "icon-check", tone: "info" },
  disburse: { endpoint: "disburse", label: "Disburse", confirm: "Disburse from the STAFF FUND A/C?", icon: "icon-wallet", tone: "primary" },
};

/**
 * Spec §29/§30/§32 next-step buttons of a staff loan / salary advance (the API decides which step the viewer may take) plus reject.
 * `resource` is the API collection: "staff-loans" or "salary-advances".
 */
export function StaffCreditActions({ row, resource }: { row: Credit; resource: "staff-loans" | "salary-advances" }) {
  const act = useAction<{ id: number; action: string; reason?: string }>("post", (body) => `hrm/${resource}/${body.id}/${body.action}`);
  const step = row.next_action ? STEPS[row.next_action] : null;

  if (!step) {
    return null;
  }

  const busy = act.isPending && act.variables?.id === row.id;

  return (
    <>
      {!row.can_approve && row.approve_blocked_reason && <BlockedApproveButton reason={row.approve_blocked_reason} label={step.label} />}
      {row.can_approve && (
        <button type="button" className={`btn btn-sm btn-icon btn-${step.tone} mr-1`} title={step.label} disabled={act.isPending} onClick={async () => (await confirmAction(step.confirm)) && act.mutate({ id: row.id, action: step.endpoint })}>
          <i className={busy && act.variables?.action === step.endpoint ? "fa fa-spinner fa-spin" : step.icon} />
        </button>
      )}
      <button
        type="button"
        className="btn btn-sm btn-icon btn-danger"
        title="Reject"
        disabled={act.isPending}
        onClick={async () => {
          const reason = await promptReason("Reason for rejection");
          if (reason !== null) {
            act.mutate({ id: row.id, action: "reject", reason });
          }
        }}
      >
        <i className="icon-close" />
      </button>
    </>
  );
}

/** Status badge with the §49 label. */
export function StaffCreditStatus({ row }: { row: Credit }) {
  return <Badge tone={statusTone(row.status)}>{(row.status_label ?? row.status).toUpperCase()}</Badge>;
}

/** Who / when of every stage (§49/§50), one line per completed stage. */
export function StaffCreditTrail({ row }: { row: Credit }) {
  const stages: [string, string | null, string | null][] = [
    ["Requested", row.requested_by_name, null],
    [row.review_stage === "admin" ? "Admin approved" : "HR approved", row.approved_by_name, row.approved_at],
    ["Finance approved", row.finance_approved_by_name, row.finance_approved_at],
    ["Disbursed", row.disbursed_by_name, row.disbursed_at],
    ["Rejected", row.rejected_by_name, row.rejected_at],
    ["Completed", null, row.completed_at],
  ];

  return (
    <small className="d-block text-muted" style={{ whiteSpace: "normal", minWidth: 160 }}>
      {row.review_stage === "admin" && <span className="d-block text-warning">HR self-request: Admin approval</span>}
      {stages.filter(([, name, at]) => name || at).map(([label, name, at]) => (
        <span key={label} className="d-block">{label}{name ? `: ${name}` : ""}{at ? ` (${at})` : ""}</span>
      ))}
      {row.rejection_reason && <span className="d-block">Reason: {row.rejection_reason}</span>}
    </small>
  );
}
