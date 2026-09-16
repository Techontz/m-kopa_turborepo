"use client";

import { useState } from "react";

import { BlockedApproveButton } from "@/components/finance/Approval";
import { bulkCounts, canRequestPayment, paymentStatusTone, type CommissionPaymentStatus } from "@/components/hrm/commission";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { confirmAction, promptReason } from "@/components/ui/notify";
import { useAuth } from "@/lib/auth";
import { money, todayIso } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface PaymentRow {
  id: number;
  period: string;
  period_label: string;
  closing_date: string | null;
  employee_id: number;
  employee: string | null;
  branch: string | null;
  kind: "branch_staff" | "zone_manager";
  offset_amount: number | null;
  commission_base: number | null;
  pool_amount: number;
  zone_allocation: number | null;
  calculated_amount: number;
  negligence_deduction: number;
  negligence_expected: boolean;
  net_commission: number;
  status: CommissionPaymentStatus;
  status_label: string;
  payroll_run_id: number | null;
  finalized_by: string | null;
  requested_by: string | null;
  requested_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  paid_by: string | null;
  paid_on: string | null;
  paying_account: string | null;
  paying_branch: string | null;
  journal_reference: string | null;
  can_approve: boolean;
  approve_blocked_reason: string | null;
  can_pay: boolean;
  pay_blocked_reason: string | null;
}

interface PaymentsResponse {
  period: string;
  period_closed: boolean;
  summary: { total_commission: number; total_negligence: number; total_net: number; total_paid: number; counts: Record<string, { label: string; count: number }> };
  rows: PaymentRow[];
}

type Selection = { ids: number[] } | { period: string };

const PAYING_ACCOUNTS = [
  { value: "interest", label: "Branch INTEREST A/C" },
  { value: "company", label: "COMPANY ACCOUNT" },
];

/**
 * Commission payment flow of a closed month (spec §21 / §22 / §49). HR (payroll.approve) finalises the figures and requests
 * payment; Finance (payroll.pay) approves or rejects and pays on the chosen date from the chosen account. Negligence is recovered
 * from the payment (spec §23) — the column shows the expected deduction until the commission is paid. The API enforces rule 6:
 * the HR requester and the employee receiving the commission cannot approve or pay it.
 */
export function CommissionPayments({ period }: { period: string }) {
  const { can } = useAuth();
  const canPrepare = can("payroll.approve");
  const canDecide = can("payroll.pay");
  const { data, isLoading } = useApi<PaymentsResponse>(canPrepare || canDecide ? "hrm/commission/payments" : null, { period });
  const finalize = useAction<Selection>("post", "hrm/commission/payments/finalize");
  const request = useAction<Selection>("post", "hrm/commission/payments/request");
  const approve = useAction<Selection>("post", "hrm/commission/payments/approve");
  const reject = useAction<{ ids: number[]; reason: string }>("post", "hrm/commission/payments/reject");
  const pay = useAction<Selection & { ac_id: string; paid_on: string }>("post", "hrm/commission/payments/pay");
  const [paying, setPaying] = useState<Selection | null>(null);
  const [payForm, setPayForm] = useState({ ac_id: "interest", paid_on: todayIso() });
  const counts = bulkCounts(data?.rows);
  const busy = finalize.isPending || request.isPending || approve.isPending || reject.isPending || pay.isPending;

  if (!canPrepare && !canDecide) {
    return null;
  }

  const openPay = (selection: Selection) => {
    setPayForm({ ac_id: "interest", paid_on: todayIso() });
    pay.setErrors({});
    setPaying(selection);
  };

  return (
    <Card
      title={`Commission Payments — ${money(data?.summary.total_net)} net (paid ${money(data?.summary.total_paid)})`}
      actions={
        <>
          {canPrepare && counts.finalize > 0 && (
            <button type="button" className="btn btn-sm btn-info mr-1" disabled={busy} title="Lock the figures: staff see the final commission, awaiting a payment request" onClick={async () => (await confirmAction("Finalise commission?", `Finalise ${counts.finalize} commission line(s) of ${period}. The month can no longer be recalculated.`)) && finalize.mutate({ period })}>
              Finalise ({counts.finalize})
            </button>
          )}
          {canPrepare && counts.request > 0 && (
            <button type="button" className="btn btn-sm btn-primary mr-1" disabled={busy} onClick={async () => (await confirmAction("Request payment?", `Send ${counts.request} commission payment request(s) of ${period} to Finance.`)) && request.mutate({ period })}>
              Request Payment ({counts.request})
            </button>
          )}
          {canDecide && counts.approve > 0 && (
            <button type="button" className="btn btn-sm btn-success mr-1" disabled={busy} onClick={async () => (await confirmAction("Approve requested commission?", `Approve ${counts.approve} requested commission payment(s) of ${period}.`)) && approve.mutate({ period })}>
              Approve All ({counts.approve})
            </button>
          )}
          {canDecide && counts.pay > 0 && (
            <button type="button" className="btn btn-sm btn-warning" disabled={busy} onClick={() => openPay({ period })}>
              Pay Approved ({counts.pay})
            </button>
          )}
        </>
      }
    >
      <p className="text-muted small mb-2">
        Commission is paid on its own, not in the payroll: HR finalises and requests payment → Finance approves → Finance pays (Dr COMMISSION PAYABLE / Cr paying account). Approved negligence is recovered from the payment into the PRINCIPAL A/C and any balance carries forward. The payment date never changes the commission period.
      </p>
      <DataTable
        rows={data?.rows}
        loading={isLoading}
        rowKey={(row) => row.id}
        columns={[
          { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
          { key: "employee", header: "Staff name", render: (row) => (<>{row.employee}{row.kind === "zone_manager" && <div className="small text-muted">Zone manager</div>}</>) },
          { key: "branch", header: "Branch", render: (row) => row.branch ?? "—" },
          { key: "commission_base", header: "Commission Base (Offset)", render: (row) => (row.commission_base === null ? "—" : `${money(row.commission_base)}${row.offset_amount ? ` (−${money(row.offset_amount)})` : ""}`) },
          { key: "zone_allocation", header: "Zone Allocation", render: (row) => (row.zone_allocation === null ? "—" : money(row.zone_allocation)) },
          { key: "calculated_amount", header: "Commission", render: (row) => money(row.calculated_amount), value: (row) => row.calculated_amount },
          { key: "negligence_deduction", header: "Negligence", render: (row) => (<>{money(row.negligence_deduction)}{row.negligence_expected && row.negligence_deduction > 0 && <div className="small text-muted">expected</div>}</>), value: (row) => row.negligence_deduction },
          { key: "net_commission", header: "Net Commission", render: (row) => <b>{money(row.net_commission)}</b>, value: (row) => row.net_commission },
          {
            key: "status",
            header: "Status",
            value: (row) => row.status_label,
            render: (row) => (
              <span style={{ whiteSpace: "normal", minWidth: 160, display: "inline-block" }}>
                <Badge tone={paymentStatusTone(row.status)}>{row.status_label.toUpperCase()}</Badge>
                {row.requested_by && <div className="small text-muted">Requested by {row.requested_by} · {row.requested_at}</div>}
                {row.approved_by && <div className="small text-muted">Approved by {row.approved_by} · {row.approved_at}</div>}
                {row.paid_by && <div className="small text-muted">Paid {row.paid_on} by {row.paid_by} from {row.paying_account}{row.paying_branch ? ` (${row.paying_branch})` : ""}{row.journal_reference ? ` · ${row.journal_reference}` : ""}</div>}
                {row.rejection_reason && row.status === "awaiting_request" && <div className="small text-danger">Rejected by {row.rejected_by}: {row.rejection_reason}</div>}
              </span>
            ),
          },
          {
            key: "action",
            header: "Action",
            sortable: false,
            render: (row) => (
              <span className="d-inline-block text-nowrap">
                {canPrepare && canRequestPayment(row) && (
                  <button type="button" className="btn btn-sm btn-primary mr-1" disabled={busy} onClick={() => request.mutate({ ids: [row.id] })}>Request</button>
                )}
                {canDecide && row.status === "requested" && (row.can_approve ? (
                  <button type="button" className="btn btn-sm btn-success mr-1" disabled={busy} onClick={async () => (await confirmAction("Approve this commission payment?", `${row.employee} — ${row.period_label}: net ${money(row.net_commission)}.`)) && approve.mutate({ ids: [row.id] })}>
                    <i className="icon-check" /> Approve
                  </button>
                ) : row.approve_blocked_reason ? <BlockedApproveButton reason={row.approve_blocked_reason} /> : null)}
                {canDecide && (row.status === "requested" || row.status === "finance_approved") && (row.can_approve || row.can_pay) && (
                  <button type="button" className="btn btn-sm btn-outline-danger mr-1" disabled={busy} onClick={async () => { const reason = await promptReason("Reason for rejecting this commission payment"); if (reason) { reject.mutate({ ids: [row.id], reason }); } }}>
                    <i className="icon-close" /> Reject
                  </button>
                )}
                {canDecide && row.status === "finance_approved" && (row.can_pay ? (
                  <button type="button" className="btn btn-sm btn-warning" disabled={busy} onClick={() => openPay({ ids: [row.id] })}>Pay</button>
                ) : row.pay_blocked_reason ? <BlockedApproveButton reason={row.pay_blocked_reason} label="Pay" /> : null)}
              </span>
            ),
          },
        ]}
      />

      <Modal open={paying !== null} onClose={() => setPaying(null)} title="Pay Commission" submitLabel="Pay" submitting={pay.isPending} onSubmit={() => paying && pay.mutate({ ...paying, ...payForm }, { onSuccess: () => setPaying(null) })}>
        <div className="row">
          <Field label="Paying account:" className="col-md-12" error={pay.fieldError("ac_id")}>
            <select className="form-control" value={payForm.ac_id} onChange={(e) => setPayForm({ ...payForm, ac_id: e.target.value })} required>
              {PAYING_ACCOUNTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="Payment date:" className="col-md-12" error={pay.fieldError("paid_on") ?? pay.fieldError("ids")}>
            <input type="date" className="form-control" value={payForm.paid_on} max={todayIso()} onChange={(e) => setPayForm({ ...payForm, paid_on: e.target.value })} required />
          </Field>
        </div>
        <small className="text-muted">The commission stays in its period ({period}) whatever date it is paid on.</small>
      </Modal>
    </Card>
  );
}
