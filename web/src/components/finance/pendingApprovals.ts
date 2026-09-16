/**
 * Pending Approvals (C6) — API shapes of GET approvals/pending and settings/approval-policies, and pure helpers.
 */

/** One item waiting for a checker; `link` is the web page where it is approved. */
export interface PendingApprovalRow {
  workflow: string;
  workflow_label: string;
  id: number;
  description: string;
  branch: string | null;
  amount: number;
  requested_by: string | null;
  requested_at: string | null;
  status: string;
  link: string;
  can_approve: boolean;
  approve_blocked_reason: string | null;
}

export interface PendingApprovalGroup {
  workflow: string;
  label: string;
  count: number;
  amount: number;
  rows: PendingApprovalRow[];
}

export interface PendingApprovals {
  groups: PendingApprovalGroup[];
  total_count: number;
  total_amount: number;
}

export interface ApprovalPolicyRow {
  workflow: string;
  label: string;
  requires_approval: boolean;
  allow_self_approval: boolean;
  updated_by: string | null;
  updated_at: string | null;
}

export type ApprovalState = { tone: "success" | "warning" | "default"; label: string; title: string | null };

/** What the viewer can do with a row: approve it, wait for another user (with the API reason), or only view it. */
export function approvalState(row: Pick<PendingApprovalRow, "can_approve" | "approve_blocked_reason">): ApprovalState {
  if (row.can_approve) {
    return { tone: "success", label: "CAN APPROVE", title: null };
  }
  if (row.approve_blocked_reason) {
    return { tone: "warning", label: "AWAITING ANOTHER USER", title: row.approve_blocked_reason };
  }

  return { tone: "default", label: "VIEW ONLY", title: "You do not hold the approval permission for this step" };
}

/** Groups to display: those with pending items first (API order kept), then — when requested — the empty ones. */
export function visibleGroups(groups: PendingApprovalGroup[] | undefined, showEmpty: boolean): PendingApprovalGroup[] {
  const list = groups ?? [];

  return [...list.filter((group) => group.count > 0), ...(showEmpty ? list.filter((group) => group.count === 0) : [])];
}

/** Number of rows the viewer may approve now. */
export function approvableCount(groups: PendingApprovalGroup[] | undefined): number {
  return (groups ?? []).reduce((sum, group) => sum + group.rows.filter((row) => row.can_approve).length, 0);
}

/** PUT settings/approval-policies payload for the rows whose self-approval setting changed. */
export function changedPolicies(original: ApprovalPolicyRow[], edited: Record<string, boolean>): { workflow: string; allow_self_approval: boolean }[] {
  return original
    .filter((row) => edited[row.workflow] !== undefined && edited[row.workflow] !== row.allow_self_approval)
    .map((row) => ({ workflow: row.workflow, allow_self_approval: edited[row.workflow] }));
}
