"use client";

import Link from "next/link";
import { useState } from "react";

import { ReversalModal } from "@/components/loans/ReversalModal";
import { cleanQuery, FilterModal, SearchButton, TotalsRow, type ReportFilters, type ReportRows } from "@/components/reports/ReportKit";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface CashRow {
  id: number;
  customer: string | null;
  deposit: number | null;
  withdrawal: number | null;
  date: string;
  loan_id: number;
  loan_number: string | null;
  method: string | null;
  /** loan_repayment: this deposit; loan_disbursement: the disbursement of target_loan_id (a top-up settlement row targets its top-up loan). */
  reversal_type: "loan_repayment" | "loan_disbursement";
  target_loan_id: number | null;
  target_loan_number: string | null;
  target_amount: number;
  is_topup_settlement: boolean;
  is_topup: boolean;
  may_reverse: boolean;
  can_reverse: boolean;
  reverse_blocked_reason: string | null;
  reversal_request_id: number | null;
}

const PENDING_MESSAGE_START = "A reversal request for this transaction is already waiting";

/**
 * Report → Cash Transaction (live admin/cash_transaction): loan deposits and withdrawals, today by default.
 * The Action column REQUESTS a reversal (maker/checker): a deposit is a loan repayment, a withdrawal is the loan's
 * disbursement, a TOPUP deposit is undone by reversing its top-up loan's disbursement. Every row states on screen whether it
 * can be reversed and why not; nothing posts until another Finance user, an Admin or the Super Admin approves it under
 * Approvals → Reversal Requests.
 */
export default function CashTransactionPage() {
  const { can } = useAuth();
  const [filters, setFilters] = useState<ReportFilters>({});
  const [filtering, setFiltering] = useState(false);
  const [target, setTarget] = useState<CashRow | null>(null);
  const { data, isLoading } = useApi<ReportRows<CashRow>>("reports/cash", cleanQuery(filters));
  const reverse = useAction<{ url: string; reason: string }>("post", ({ url }) => url);
  const mayRequest = can(["loans.reverse_repayment", "loans.reverse_disbursement"]);
  const rows = data?.rows ?? [];
  const reversible = rows.filter((row) => row.can_reverse).length;
  const pending = rows.filter((row) => row.reversal_request_id !== null).length;

  const close = () => {
    reverse.setErrors({});
    setTarget(null);
  };
  const submit = (reason: string) => {
    if (!target) {
      return;
    }
    const url = target.reversal_type === "loan_repayment" ? `loans/${target.loan_id}/transactions/${target.id}/reverse` : `loans/${target.target_loan_id}/reverse-disbursement`;
    reverse.mutate({ url, reason }, { onSuccess: () => setTarget(null) });
  };

  return (
    <>
      <PageHeader crumbs={["Report", "Cash Transaction"]} />

      <Card title="Transaction list" actions={<SearchButton onClick={() => setFiltering(true)} />}>
        {mayRequest && (
          <div className="alert alert-info">
            <b>Reversing a transaction:</b> (1) click <b>Reverse</b> on the row and give a reason; (2) another Finance user, an Admin or the Super Admin approves it
            under <Link href="/reversals">Approvals → Reversal Requests</Link>; (3) on approval the ledger is mirrored exactly and the row leaves this list.
            Repayments of a loan are reversed <b>newest first</b>, and nobody reverses a transaction they posted themselves.
            {data && (
              <div className="mt-1">
                <b>{reversible}</b> of {rows.length} transaction(s) can be reversed now{pending > 0 && <> · <Link href="/reversals"><b>{pending}</b> waiting for approval</Link></>}.
              </div>
            )}
          </div>
        )}
        <DataTable
          rows={data?.rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "customer", header: "Customer Name" },
            {
              key: "loan_number",
              header: "Loan",
              render: (row) => (
                <>
                  <Link href={`/loans/${row.loan_id}`}>{row.loan_number ?? "—"}</Link>
                  {row.method && <div className="text-muted small">{row.method}</div>}
                </>
              ),
            },
            { key: "deposit", header: "Deposit", render: (row) => (row.deposit === null ? "-" : money(row.deposit)) },
            { key: "withdrawal", header: "Withdrawal", render: (row) => (row.withdrawal === null ? "-" : money(row.withdrawal)) },
            { key: "date", header: "Date" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              value: (row) => (row.can_reverse ? "reverse" : row.reversal_request_id ? "pending" : "locked"),
              render: (row) => <ReverseCell row={row} onReverse={() => { reverse.setErrors({}); setTarget(row); }} busy={reverse.isPending} />,
            },
          ]}
          footer={data && <TotalsRow cells={["", "", money(data.totals.deposit), money(data.totals.withdrawal), "", ""]} />}
        />
      </Card>

      <ReversalModal
        key={target?.id ?? 0}
        open={target !== null}
        title={target?.reversal_type === "loan_disbursement" ? (target.is_topup ? "Request top-up disbursement reversal" : "Request disbursement reversal") : "Request repayment reversal"}
        submitting={reverse.isPending}
        error={reverse.fieldError("reason")}
        onClose={close}
        onSubmit={submit}
        summary={target && <ReversalSummary row={target} />}
      />

      <FilterModal open={filtering} onClose={() => setFiltering(false)} title="Filter Transaction" onApply={setFilters} />
    </>
  );
}

/** Reverse button when allowed; otherwise the state (pending approval / locked) and the reason, in plain sight. */
function ReverseCell({ row, onReverse, busy }: { row: CashRow; onReverse: () => void; busy: boolean }) {
  if (!row.may_reverse) {
    return <Link href={`/loans/${row.loan_id}`} className="btn btn-info btn-sm" title="Open loan"><i className="icon-eye" /></Link>;
  }
  if (row.can_reverse) {
    return (
      <button type="button" className="btn btn-danger btn-sm text-nowrap" disabled={busy} onClick={onReverse}>
        <i className="icon-action-undo" /> Reverse{row.is_topup_settlement ? " top-up" : ""}
      </button>
    );
  }
  if (row.reversal_request_id !== null || row.reverse_blocked_reason?.startsWith(PENDING_MESSAGE_START)) {
    return (
      <Link href="/reversals" className="text-nowrap">
        <Badge tone="warning">PENDING APPROVAL</Badge>
      </Link>
    );
  }

  return (
    <div style={{ whiteSpace: "normal", maxWidth: 260 }}>
      <Badge tone="default"><i className="icon-lock" /> LOCKED</Badge>
      <div className="text-muted small mt-1">{row.reverse_blocked_reason}</div>
    </div>
  );
}

function ReversalSummary({ row }: { row: CashRow }) {
  if (row.reversal_type === "loan_repayment") {
    return (
      <>
        On approval, reverse the repayment of <b>TZS {money(row.deposit ?? 0)}</b> by {row.customer ?? "—"} dated {row.date} (loan {row.loan_number}): principal,
        penalty, interest and insurance are mirrored out exactly, the money returns to <b>SUSPENSE</b> (unallocated) for re-allocation or refund, and a loan
        closed by it reopens.
      </>
    );
  }
  if (row.is_topup || row.is_topup_settlement) {
    return (
      <>
        On approval, reverse the <b>top-up disbursement of TZS {money(row.target_amount)}</b> (loan {row.target_loan_number}): the disbursement is mirrored back to
        the PRINCIPAL A/C and the top-up loan is cancelled, and the settlement it made on the previous loan is reversed with it, so that loan reopens with its
        balance owed again.
      </>
    );
  }

  return (
    <>
      On approval, reverse the disbursement of <b>TZS {money(row.target_amount)}</b> to {row.customer ?? "—"} (loan {row.target_loan_number}): it is mirrored back
      to the PRINCIPAL A/C (a deducted fee out of FEE INCOME) and the loan is cancelled.
    </>
  );
}
