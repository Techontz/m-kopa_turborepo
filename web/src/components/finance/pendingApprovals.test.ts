import { describe, expect, it } from "vitest";

import { approvableCount, approvalState, changedPolicies, visibleGroups, type ApprovalPolicyRow, type PendingApprovalGroup } from "./pendingApprovals";

const row = (id: number, can_approve: boolean, approve_blocked_reason: string | null = null) => ({
  workflow: "floats.transfer", workflow_label: "Floats", id, description: "COMPANY TO BRANCH", branch: "MWANZA", amount: 1000,
  requested_by: "ADMIN", requested_at: "2026-09-15 10:00:00", status: "pending", link: "/capital/floats", can_approve, approve_blocked_reason,
});

const groups: PendingApprovalGroup[] = [
  { workflow: "expenses.request", label: "Expenses", count: 0, amount: 0, rows: [] },
  { workflow: "floats.transfer", label: "Floats", count: 2, amount: 2000, rows: [row(1, true), row(2, false, "You initiated this transaction, so another authorised user must approve it.")] },
  { workflow: "payroll.run", label: "Payroll", count: 1, amount: 1000, rows: [row(3, false)] },
];

describe("pending approvals helpers", () => {
  it("describes what the viewer can do with a row", () => {
    expect(approvalState(row(1, true))).toEqual({ tone: "success", label: "CAN APPROVE", title: null });
    expect(approvalState(row(2, false, "reason"))).toEqual({ tone: "warning", label: "AWAITING ANOTHER USER", title: "reason" });
    expect(approvalState(row(3, false)).label).toBe("VIEW ONLY");
  });

  it("lists groups with items first and hides empty ones unless asked", () => {
    expect(visibleGroups(groups, false).map((group) => group.label)).toEqual(["Floats", "Payroll"]);
    expect(visibleGroups(groups, true).map((group) => group.label)).toEqual(["Floats", "Payroll", "Expenses"]);
    expect(visibleGroups(undefined, true)).toEqual([]);
  });

  it("counts the rows the viewer may approve now", () => {
    expect(approvableCount(groups)).toBe(1);
    expect(approvableCount(undefined)).toBe(0);
  });

  it("sends only changed approval policies", () => {
    const policies: ApprovalPolicyRow[] = [
      { workflow: "floats.transfer", label: "Floats", requires_approval: true, allow_self_approval: false, updated_by: null, updated_at: null },
      { workflow: "expenses.request", label: "Expenses", requires_approval: true, allow_self_approval: true, updated_by: "ADMIN", updated_at: null },
    ];
    expect(changedPolicies(policies, { "floats.transfer": true, "expenses.request": true })).toEqual([{ workflow: "floats.transfer", allow_self_approval: true }]);
    expect(changedPolicies(policies, {})).toEqual([]);
  });
});
