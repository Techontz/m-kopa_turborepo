"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { promptReason } from "@/components/ui/notify";
import { backendUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction } from "@/lib/hooks";

import { sharesLabel, TRANSACTION_TONES } from "./shares";
import type { ShareTransaction } from "./types";

function Holder({ id, name }: { id: number | null; name: string | null }) {
  if (id === null) {
    return <span className="text-muted">Unissued</span>;
  }
  return <Link href={`/shares/share-holders/${id}`}>{name}</Link>;
}

/** Immutable share movements with their valuation, payment link, journal reference and (for managers) reversal. */
export function ShareTransactionsTable({ rows, loading, compact = false, pageSize = 10 }: { rows: ShareTransaction[] | undefined; loading?: boolean; compact?: boolean; pageSize?: number }) {
  const { can } = useAuth();
  const reverse = useAction<{ id: number; reason: string }>("post", (body) => `shares/transactions/${body.id}/reverse`);
  const canReverse = can("shares.manage") && !compact;

  return (
    <DataTable
      rows={rows}
      loading={loading}
      searchable={!compact}
      pageSize={pageSize}
      rowKey={(row) => row.id}
      emptyMessage="No share transactions yet"
      columns={[
        { key: "transacted_at", header: "Date / Time" },
        { key: "reference", header: "Reference" },
        { key: "type", header: "Type", value: (row) => row.type_label, render: (row) => <Badge tone={TRANSACTION_TONES[row.type]}>{row.type_label}</Badge> },
        { key: "from_share_holder", header: "From", render: (row) => <Holder id={row.from_share_holder_id} name={row.from_share_holder} /> },
        { key: "to_share_holder", header: "To", render: (row) => (row.to_share_holder_id === null ? <span className="text-muted">Cancelled</span> : <Holder id={row.to_share_holder_id} name={row.to_share_holder} />) },
        { key: "shares", header: "Shares", className: "text-right", render: (row) => sharesLabel(row.shares) },
        {
          key: "issued_change",
          header: "Issued Change",
          className: "text-right",
          render: (row) => (row.issued_change === 0 ? "0" : `${row.issued_change > 0 ? "+" : "−"}${sharesLabel(Math.abs(row.issued_change))}`),
        },
        { key: "share_value", header: "Share Value", className: "text-right", render: (row) => money(row.share_value) },
        ...(compact
          ? []
          : [
              { key: "total_amount", header: "Amount", className: "text-right", render: (row: ShareTransaction) => (row.total_amount === null ? "—" : money(row.total_amount)) },
              {
                key: "payment_treatment",
                header: "Accounting",
                render: (row: ShareTransaction) => (
                  <small>
                    {row.payment_treatment_label ?? "—"}
                    {row.receiving_account && <><br />{row.receiving_account}</>}
                  </small>
                ),
              },
              { key: "journal_reference", header: "Journal Ref", render: (row: ShareTransaction) => row.journal_reference ?? "—" },
              { key: "performed_by", header: "By", render: (row: ShareTransaction) => row.performed_by ?? "—" },
            ]),
        {
          key: "status",
          header: "Status",
          render: (row) => (
            <>
              <Badge tone={row.status === "completed" ? "success" : "warning"}>{row.status === "completed" ? "COMPLETED" : "REVERSED"}</Badge>
              {row.reversed_by_reference && <><br /><small className="text-muted">by {row.reversed_by_reference}</small></>}
              {row.reversal_of_reference && <><br /><small className="text-muted">of {row.reversal_of_reference}</small></>}
            </>
          ),
        },
        ...(compact
          ? []
          : [
              {
                key: "action",
                header: "Action",
                sortable: false,
                className: "text-nowrap",
                render: (row: ShareTransaction) => (
                  <>
                    {row.document_endpoint && (
                      <a href={backendUrl(row.document_endpoint)} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-icon btn-info mr-1" title={`Document: ${row.document_name ?? ""}`}>
                        <i className="icon-doc" />
                      </a>
                    )}
                    {canReverse && row.status === "completed" && row.type !== "reversal" && (
                      <button
                        type="button"
                        className="btn btn-sm btn-icon btn-danger"
                        title="Reverse"
                        onClick={async () => {
                          const reason = await promptReason(
                            row.payment_treatment === "paid" || row.payment_treatment === "linked_contribution"
                              ? `Reverse ${row.reference}? The capital contribution and its journal entry stay recorded; reverse the journal in Accounting if money was refunded.`
                              : `Reverse ${row.reference}?`,
                          );
                          if (reason) {
                            reverse.mutate({ id: row.id, reason });
                          }
                        }}
                      >
                        <i className="icon-action-undo" />
                      </button>
                    )}
                  </>
                ),
              },
            ]),
      ]}
    />
  );
}
