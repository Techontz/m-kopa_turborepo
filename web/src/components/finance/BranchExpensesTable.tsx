"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { confirmAction } from "@/components/ui/notify";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

import { AcceptExpenseModal } from "./AcceptExpenseModal";
import { BlockedApproveButton } from "./Approval";
import { ReversedStatus, ReverseButton } from "./Reversal";
import { sum } from "./FilterModal";
import type { ExpenseRequest } from "./types";

/** Branch expense table (live admin/get_recomended_request & get_accepted_expenses columns). */
export function BranchExpensesTable({ rows, loading }: { rows: ExpenseRequest[] | undefined; loading: boolean }) {
  const { can } = useAuth();
  const [accepting, setAccepting] = useState<ExpenseRequest | null>(null);
  const remove = useAction<{ id: number }>("delete", (body) => `expenses/requests/${body.id}`);
  const { data: settings } = useApi<{ expense_approval_limit: number }>(can(["settings.manage", "expenses.approve_branch", "expenses.approve_hq"]) ? "expenses/settings" : null);

  return (
    <>
      <DataTable
        rows={rows}
        loading={loading}
        rowKey={(row) => row.id}
        columns={[
          { key: "branch", header: "Branch", render: (row) => <span className="text-uppercase">{row.branch}</span> },
          { key: "expense", header: "Expenses" },
          { key: "amount", header: "Amount", render: (row) => money(row.amount) },
          { key: "description", header: "Description" },
          { key: "comment", header: "Comment" },
          { key: "request_date", header: "Date" },
          {
            key: "status",
            header: "status",
            render: (row) =>
              row.status === "reversed" ? (
                <ReversedStatus row={row} />
              ) : row.status === "accepted" ? (
                <Badge tone="success">ACCEPTED</Badge>
              ) : (
                <span title={row.approval_level === "admin" ? "Requires Admin approval" : "Finance approval"}>
                  <Badge tone="danger">NOT ACCEPTED</Badge>
                </span>
              ),
          },
          {
            key: "action",
            header: "Action",
            sortable: false,
            className: "text-nowrap",
            render: (row) =>
              row.status === "accepted" ? (
                <ReverseButton row={row} path={`expenses/requests/${row.id}/reverse`} description={`${row.expense ?? "expense"} — ${row.branch ?? ""} (back to INTEREST A/C)`} />
              ) : (
                row.status === "pending" &&
                (row.can_approve ? (
                  <>
                    <button type="button" className="btn btn-sm btn-icon btn-primary mr-1" title="Accept" onClick={() => setAccepting(row)}><i className="icon-pencil" /></button>
                    <button type="button" className="btn btn-sm btn-icon btn-danger" title="Reject" disabled={remove.isPending} onClick={async () => (await confirmAction("Are You Sure?")) && remove.mutate({ id: row.id })}><i className="icon-trash" /></button>
                  </>
                ) : (
                  row.approve_blocked_reason && <BlockedApproveButton reason={row.approve_blocked_reason} label="Accept" />
                ))
              ),
          },
        ]}
        footer={
          <tr>
            <td><b>TOTAL</b> <small className="text-muted">(excl. reversed)</small></td>
            <td />
            <td><b>{money(sum(rows, (row) => (row.status === "reversed" ? 0 : row.amount)))}</b></td>
            <td colSpan={5} />
          </tr>
        }
      />
      <AcceptExpenseModal request={accepting} onClose={() => setAccepting(null)} limit={settings?.expense_approval_limit} />
    </>
  );
}
