"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction } from "@/lib/hooks";

import { ReversalModal } from "./ReversalModal";
import type { LoanTransactionRow } from "./types";

/** Loan transactions with the repayment REVERSE action (permission loans.reverse_repayment, eligibility from the API). */
export function LoanTransactionsCard({ loanId, transactions }: { loanId: number; transactions: LoanTransactionRow[] }) {
  const { can } = useAuth();
  const [target, setTarget] = useState<LoanTransactionRow | null>(null);
  const reverse = useAction<{ id: number; reason: string }>("post", (body) => `loans/${loanId}/transactions/${body.id}/reverse`);
  const canReverse = can("loans.reverse_repayment");
  const struck = (row: LoanTransactionRow, value: string) => (row.reversed ? <s className="text-muted">{value}</s> : value);

  const close = () => {
    reverse.setErrors({});
    setTarget(null);
  };

  return (
    <Card title="Loan Transactions">
      <DataTable
        rows={transactions}
        searchable={false}
        rowKey={(row) => row.id}
        columns={[
          { key: "date", header: "Date" },
          {
            key: "description",
            header: "Description",
            render: (row) => (
              <>
                {struck(row, row.description)}
                {row.reversed && (
                  <div>
                    <Badge tone="danger">REVERSED</Badge>{" "}
                    <small>{row.reversed_at} · {row.reversed_by ?? "—"} · {row.reversal_reason}{row.reversal_reference ? ` · ${row.reversal_reference}` : ""}</small>
                  </div>
                )}
              </>
            ),
          },
          { key: "method", header: "Method" },
          { key: "receipt_number", header: "Receipt", render: (row) => row.receipt_number ?? "—" },
          { key: "amount", header: "Amount", render: (row) => struck(row, money(row.amount)) },
          { key: "principal", header: "Principal", render: (row) => struck(row, money(row.principal)) },
          { key: "penalty", header: "Penalty", render: (row) => struck(row, money(row.penalty)) },
          { key: "interest", header: "Interest", render: (row) => struck(row, money(row.interest)) },
          { key: "insurance", header: "Insurance", render: (row) => struck(row, money(row.insurance)) },
          ...(canReverse
            ? [{
                key: "actions",
                header: "Action",
                sortable: false,
                render: (row: LoanTransactionRow) => row.type === "deposit" && !row.reversed && (
                  <span title={row.can_reverse ? "Reverse this repayment" : row.reverse_blocked_reason ?? ""} className="d-inline-block">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      disabled={!row.can_reverse || reverse.isPending}
                      style={row.can_reverse ? undefined : { pointerEvents: "none" }}
                      onClick={() => setTarget(row)}
                    >
                      Reverse
                    </button>
                  </span>
                ),
              }]
            : []),
        ]}
      />
      {!canReverse ? null : transactions.some((row) => row.type === "deposit" && !row.reversed && !row.can_reverse) && (
        <small className="text-muted">Hover a disabled Reverse button to see why the repayment cannot be reversed.</small>
      )}

      <ReversalModal
        key={target?.id ?? 0}
        open={target !== null}
        title="Reverse repayment"
        submitting={reverse.isPending}
        error={reverse.fieldError("reason")}
        onClose={close}
        onSubmit={(reason) => target && reverse.mutate({ id: target.id, reason }, { onSuccess: () => setTarget(null) })}
        summary={target && (
          <>
            Reverse the repayment of <b>TZS {money(target.amount)}</b> dated {target.date}{target.receipt_number ? ` (receipt ${target.receipt_number})` : ""}:
            <ul className="mb-1 mt-1">
              <li>Principal {money(target.principal)} back to LOAN RECEIVABLE</li>
              <li>Penalty {money(target.penalty)} out of PENALTY INCOME</li>
              <li>Interest {money(target.interest)} (reserve {money(target.reserve)}) out of INTEREST INCOME</li>
              <li>Insurance {money(target.insurance)} out of INSURANCE RESERVE</li>
            </ul>
            The money returns to <b>SUSPENSE</b> (unallocated) for re-allocation or refund, and a loan closed by this repayment reopens.
          </>
        )}
      />
    </Card>
  );
}
