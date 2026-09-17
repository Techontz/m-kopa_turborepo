"use client";

import { useState } from "react";

import { ApprovalActions } from "@/components/finance/Approval";
import { ReversalModal } from "@/components/loans/ReversalModal";
import { approvePath, pendingNote, rejectPath, type ReversalRequestRow } from "@/components/loans/reversalRequest";
import { PaymentFilterModal, SearchButton, total, type PaymentFilters } from "@/components/payments/PaymentFilterModal";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface PaidRow {
  id: number;
  customer: string | null;
  branch: string | null;
  loan_number: string | null;
  amount: number;
  paid_on: string;
  source: "direct" | "repayment";
  accounting?: "accrued" | "cash";
  reversed: boolean;
  reversed_at: string | null;
  reversed_by: string | null;
  reversal_reason: string | null;
  reversal_reference: string | null;
  can_reverse: boolean;
  reverse_blocked_reason: string | null;
  reversal_request: ReversalRequestRow | null;
}

/**
 * Penalty → Paid Penalty List (live admin/penart_paid_list). Finance may REQUEST the reversal of a direct penalty payment
 * (permission penalties.reverse_payment); another Finance user, an Admin or the Super Admin approves it.
 */
export default function PaidPenaltyPage() {
  const { can } = useAuth();
  const [filters, setFilters] = useState<PaymentFilters>({});
  const [filtering, setFiltering] = useState(false);
  const [target, setTarget] = useState<PaidRow | null>(null);
  const { data: rows, isLoading } = useApi<PaidRow[]>("penalties/paid", { branch_id: filters.branch_id, from: filters.from, to: filters.to });
  const reverse = useAction<{ id: number; reason: string }>("post", (body) => `penalties/payments/${body.id}/reverse`);
  const canReverse = can("penalties.reverse_payment");
  const struck = (row: PaidRow, value: string) => (row.reversed ? <s className="text-muted">{value}</s> : value);

  return (
    <>
      <PageHeader crumbs={["Penalty", "Paid Penalty List"]} />

      <Card title="Paid Penalty List" actions={<SearchButton onClick={() => setFiltering(true)} />}>
        <DataTable
          rows={rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/no.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "customer", header: "Customer Name" },
            { key: "branch", header: "Branch Name" },
            { key: "amount", header: "Paid Amount", render: (row) => struck(row, money(row.amount)) },
            { key: "paid_on", header: "Date" },
            { key: "accounting", header: "Accounting", render: (row) => <Badge tone={row.accounting === "accrued" ? "info" : "default"}>{row.accounting === "accrued" ? "ACCRUED (LEGACY)" : "CASH BASIS"}</Badge> },
            {
              key: "status",
              header: "Status",
              render: (row) => (
                <span style={{ whiteSpace: "normal" }}>
                  {row.reversed ? (
                    <>
                      <Badge tone="danger">REVERSED</Badge>{" "}
                      <small>{row.reversed_at} · {row.reversed_by ?? "—"} · {row.reversal_reason}{row.reversal_reference ? ` · ${row.reversal_reference}` : ""}</small>
                    </>
                  ) : row.reversal_request ? (
                    <>
                      <Badge tone="warning">REVERSAL PENDING APPROVAL</Badge> <small>{pendingNote(row.reversal_request)}</small>
                      <div className="mt-1">
                        <ApprovalActions row={row.reversal_request} approvePath={approvePath(row.reversal_request)} rejectPath={rejectPath(row.reversal_request)} description={`reversal of the penalty payment of ${row.customer ?? "—"}`} />
                      </div>
                    </>
                  ) : (
                    <Badge tone="success">{row.source === "direct" ? "PAID" : "PAID (LOAN REPAYMENT)"}</Badge>
                  )}
                </span>
              ),
            },
            ...(canReverse
              ? [{
                  key: "actions",
                  header: "Action",
                  sortable: false,
                  render: (row: PaidRow) => !row.reversed && !row.reversal_request && (
                    <span title={row.can_reverse ? "Request the reversal of this penalty payment" : row.reverse_blocked_reason ?? ""} className="d-inline-block">
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
          footer={
            <tr>
              <td><b>TOTAL</b></td>
              <td />
              <td />
              <td><b>{money(total(rows?.filter((row) => !row.reversed), (row) => row.amount))}</b></td>
              <td />
              <td />
              <td />
              {canReverse && <td />}
            </tr>
          }
        />
        {canReverse && rows?.some((row) => !row.reversed && !row.reversal_request && !row.can_reverse) && (
          <small className="text-muted">Hover a disabled Reverse button to see why the payment cannot be reversed.</small>
        )}
      </Card>

      <ReversalModal
        key={target?.id ?? 0}
        open={target !== null}
        title="Request penalty payment reversal"
        submitting={reverse.isPending}
        error={reverse.fieldError("reason")}
        onClose={() => { reverse.setErrors({}); setTarget(null); }}
        onSubmit={(reason) => target && reverse.mutate({ id: target.id, reason }, { onSuccess: () => setTarget(null) })}
        summary={target && (
          <>
            On approval, reverse the penalty payment of <b>TZS {money(target.amount)}</b> dated {target.paid_on} ({target.customer ?? "—"}{target.loan_number ? `, loan ${target.loan_number}` : ""}):
            the money leaves the PENALTY A/C, PENALTY INCOME is reduced and the amount is owed on the penalty again.
          </>
        )}
      />

      <PaymentFilterModal open={filtering} onClose={() => setFiltering(false)} onApply={setFilters} />
    </>
  );
}
