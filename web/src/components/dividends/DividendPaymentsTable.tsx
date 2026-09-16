"use client";

import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { promptReason } from "@/components/ui/notify";
import { useAuth } from "@/lib/auth";
import { useAction } from "@/lib/hooks";

import { loadState, paymentBadge, shortDate, tzs } from "./dividends";
import type { DividendPayment } from "./types";

interface Props {
  rows: DividendPayment[] | undefined;
  isLoading: boolean;
  error: unknown;
  /** Hide the shareholder column (one shareholder's history). */
  single?: boolean;
  pageSize?: number;
}

/**
 * Payment History: every dividend payment with its journal entry; reversed payments stay listed with the reversal
 * entry. Reversal needs capital.manage and accounting.reverse (enforced by the API).
 */
export function DividendPaymentsTable({ rows, isLoading, error, single, pageSize = 10 }: Props) {
  const { can } = useAuth();
  const canReverse = can("capital.manage") && can("accounting.reverse");
  const reverse = useAction<{ id: number; reason: string }>("post", (body) => `capital/dividends/payments/${body.id}/reverse`);
  const status = loadState({ isLoading, error, count: rows?.length }, "No dividend payments yet");

  if (status.state === "error") {
    return <div className="alert alert-danger mb-0">{status.message}</div>;
  }

  return (
    <DataTable
      rows={rows}
      loading={isLoading}
      rowKey={(row) => row.id}
      pageSize={pageSize}
      emptyMessage={status.message || undefined}
      columns={[
        {
          key: "paid_at",
          header: "Payment Date",
          render: (row) => (
            <span className="text-nowrap">
              {shortDate(row.paid_at)}
              <div className="text-muted small">{row.paid_at?.slice(11, 16) ?? ""}</div>
            </span>
          ),
        },
        ...(single ? [] : [{ key: "share_holder", header: "Shareholder", render: (row: DividendPayment) => <>{row.share_holder}<div className="text-muted small">{row.period_label}</div></> }]),
        { key: "amount", header: "Amount", className: "text-right text-nowrap", render: (row) => tzs(row.amount) },
        { key: "pay_method", header: "Payment Method", render: (row) => (row.pay_method === "BANK" ? "Bank" : "Cash") },
        { key: "account", header: "Account" },
        { key: "reference", header: "Receipt / Reference", render: (row) => row.reference ?? "-" },
        { key: "paid_by", header: "Paid By", render: (row) => row.paid_by ?? "-" },
        {
          key: "journal_reference",
          header: "Transaction Reference",
          render: (row) => (
            <>
              {row.journal_reference ?? "-"}
              {row.batch_reference && <div className="text-muted small">Pay All batch: {row.batch_reference}</div>}
              {row.reversal_reference && <div className="text-muted small">Reversal: {row.reversal_reference}</div>}
            </>
          ),
        },
        {
          key: "status",
          header: "Status",
          render: (row) => (
            <>
              <Badge tone={paymentBadge(row.status).tone}>{paymentBadge(row.status).label}</Badge>
              {row.status === "reversed" && <div className="text-muted small" title={row.reversal_reason ?? ""}>{shortDate(row.reversed_at)} by {row.reversed_by ?? "-"}</div>}
            </>
          ),
        },
        ...(canReverse
          ? [{
              key: "actions",
              header: "Action",
              sortable: false,
              render: (row: DividendPayment) =>
                row.status === "posted" && (
                  <span title={row.can_reverse === false ? row.reverse_blocked_reason ?? "" : "Reverse this payment"} className="d-inline-block">
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      disabled={row.can_reverse === false || reverse.isPending}
                      style={row.can_reverse === false ? { pointerEvents: "none" } : undefined}
                      onClick={async () => {
                        const reason = await promptReason(`Reverse ${tzs(row.amount)} paid to ${row.share_holder ?? "shareholder"}?`);
                        if (reason) {
                          reverse.mutate({ id: row.id, reason });
                        }
                      }}
                    >
                      <i className="icon-action-undo" /> Reverse
                    </button>
                  </span>
                ),
            }]
          : []),
      ]}
    />
  );
}
