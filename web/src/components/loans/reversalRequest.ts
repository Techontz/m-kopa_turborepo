/** A maker/checker reversal request (loan repayment, loan disbursement or direct penalty payment) as the API presents it. */
export interface ReversalRequestRow {
  id: number;
  type: "loan_repayment" | "loan_disbursement" | "penalty_payment";
  type_label: string;
  status: "pending" | "approved" | "rejected";
  amount: number;
  reason: string;
  loan_id: number | null;
  loan_number: string | null;
  customer: string | null;
  branch: string | null;
  description: string;
  requested_by: string | null;
  requested_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  reversal_reference: string | null;
  /** What approving the request posts, in one sentence. */
  effect: string;
  can_approve: boolean;
  approve_blocked_reason: string | null;
  can_reject: boolean;
}

export const approvePath = (row: Pick<ReversalRequestRow, "id">) => `reversal-requests/${row.id}/approve`;
export const rejectPath = (row: Pick<ReversalRequestRow, "id">) => `reversal-requests/${row.id}/reject`;

/** Line shown under a transaction whose reversal is waiting for a checker. */
export const pendingNote = (row: ReversalRequestRow) =>
  `Reversal requested by ${row.requested_by ?? "—"} on ${row.requested_at ?? "—"} (${row.reason}): nothing is posted until another Finance user, an Admin or the Super Admin approves it.`;
