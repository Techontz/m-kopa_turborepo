"use client";

import Link from "next/link";
import { useState } from "react";

import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { confirmAction, promptReason } from "@/components/ui/notify";
import { ApprovalActions } from "@/components/finance/Approval";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction } from "@/lib/hooks";

import { DisbursementSourceFields } from "./DisbursementSourceFields";
import { ReversalModal } from "./ReversalModal";
import { EMPTY_SOURCE, sourcePayload, type SourceChoice } from "./disbursementSource";
import { formatFreezeUntil } from "./freeze";
import type { LoanDetail } from "./types";

/** Workflow panel on the loan detail page: the next step for the loan's status, limited to the user's permissions. */
export function LoanActions({ detail, onEdit }: { detail: LoanDetail; onEdit: () => void }) {
  const { can } = useAuth();
  const { loan, mandate } = detail;
  const path = (action: string) => `loans/${loan.id}/${action}`;

  const [mandateForm, setMandateForm] = useState({ bank_name: "", account_number: "", account_name: detail.customer.full_name });
  const [otp, setOtp] = useState("");
  const [comment, setComment] = useState("");
  const [source, setSource] = useState<SourceChoice>(EMPTY_SOURCE);
  const [reversing, setReversing] = useState(false);

  const reject = useAction<{ reason: string }>("post", path("reject"));
  const modify = useAction<{ reason: string }>("post", path("modify"));
  const createMandate = useAction<typeof mandateForm>("post", path("e-mandate"));
  const verifyOtp = useAction<{ otp: string }>("post", path("e-mandate/verify-otp"));
  const verifyTelco = useAction<Record<string, never>>("post", path("kyc-verify"));
  const approveCredit = useAction<Record<string, never>>("post", path("approve-credit"));
  const prepare = useAction<ReturnType<typeof sourcePayload>>("post", path("prepare-disbursement"));
  const disburse = useAction<Record<string, never>, { portal_url?: string | null }>("post", path("disburse"));
  const retry = useAction<Record<string, never>, { portal_url?: string | null }>("post", path("retry-disbursement"));
  const close = useAction<Record<string, never>>("post", path("close"));
  const writeOff = useAction<{ reason: string }>("post", path("write-off"));
  const reverseDisbursement = useAction<{ reason: string }>("post", path("reverse-disbursement"));
  const addComment = useAction<{ comment: string }>("post", path("comments"));

  const ask = async (title: string, action: typeof reject) => {
    const reason = await promptReason(title);
    if (reason) {
      action.mutate({ reason });
    }
  };
  const rejectModify = (permission: string) => can(permission) && (
    <>
      <button type="button" className="btn btn-danger mr-1" onClick={() => ask("Reject loan", reject)}>Reject</button>
      <button type="button" className="btn btn-warning mr-1" onClick={() => ask("Modify: send back to loan officer", modify)}>Modify</button>
    </>
  );
  const portal = (result: { portal_url?: string | null }) => result.portal_url && window.open(result.portal_url, "_blank", "noopener");

  let body: React.ReactNode = null;
  switch (loan.status) {
    case "pending_manager_approval":
      body = (
        <>
          <p>Waiting for branch manager approval. Enter the Approved Loan below and click Approve, or:</p>
          {rejectModify("loans.approve_manager")}
          {can("loans.apply") && <button type="button" className="btn btn-info" onClick={onEdit}><i className="icon-pencil" /> Edit loan</button>}
        </>
      );
      break;
    case "returned":
      body = (
        <>
          <div className="alert alert-warning">Returned for modification: {loan.decision_reason}</div>
          {can("loans.apply") && <button type="button" className="btn btn-primary" onClick={onEdit}><i className="icon-pencil" /> Edit &amp; resubmit</button>}
        </>
      );
      break;
    case "mandate_pending_otp":
    case "mandate_failed":
      body = (
        <>
          {loan.status === "mandate_failed" && <div className="alert alert-danger">MANDATE FAILED: {mandate?.failure_reason}. Retry OTP or modify details.</div>}
          {mandate?.mandate_reference ? (
            <form className="row" onSubmit={(e) => { e.preventDefault(); verifyOtp.mutate({ otp }); }}>
              <div className="col-12 mb-2">E-mandate <b>{mandate?.mandate_reference}</b> — {mandate?.bank_name} {mandate?.account_number}. OTP sent to the account holder.</div>
              <Field label="OTP:" required className="col-md-4" error={verifyOtp.fieldError("otp")}>
                <input className="form-control" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} required />
              </Field>
              <div className="col-md-8 d-flex align-items-end mb-2">
                <button type="submit" className="btn btn-primary mr-1" disabled={verifyOtp.isPending}>Verify OTP</button>
              </div>
            </form>
          ) : null}
          {can(["loans.apply", "loans.approve_manager"]) && (
            <form className="row" onSubmit={(e) => { e.preventDefault(); createMandate.mutate(mandateForm); }}>
              <div className="col-12 mb-1"><b>{mandate ? "Modify e-mandate details" : "Create bank e-mandate"}</b></div>
              <Field label="Bank name:" required className="col-md-4" error={createMandate.fieldError("bank_name")}>
                <input className="form-control" value={mandateForm.bank_name} onChange={(e) => setMandateForm({ ...mandateForm, bank_name: e.target.value })} required />
              </Field>
              <Field label="Account number:" required className="col-md-4" error={createMandate.fieldError("account_number")}>
                <input className="form-control" value={mandateForm.account_number} onChange={(e) => setMandateForm({ ...mandateForm, account_number: e.target.value })} required />
              </Field>
              <Field label="Account name:" required className="col-md-4" error={createMandate.fieldError("account_name")}>
                <input className="form-control" value={mandateForm.account_name} onChange={(e) => setMandateForm({ ...mandateForm, account_name: e.target.value })} required />
              </Field>
              <div className="col-12"><button type="submit" className="btn btn-info mr-1" disabled={createMandate.isPending}>Send e-mandate</button>{rejectModify("loans.approve_manager")}</div>
            </form>
          )}
        </>
      );
      break;
    case "pending_credit_review":
      body = can("loans.credit_review") ? (
        <>
          <p>
            Vodacom verification:{" "}
            {loan.telco_verified_at === null ? <span className="badge badge-warning">NOT VERIFIED</span> : (
              <><span className={`badge badge-${loan.telco_matched ? "success" : "danger"}`}>{loan.telco_matched ? "MATCHED" : "NAME MISMATCH"}</span> {detail.customer.phone} → {loan.telco_name ?? "not registered"}</>
            )}
          </p>
          <button type="button" className="btn btn-info mr-1" disabled={verifyTelco.isPending} onClick={() => verifyTelco.mutate({})}>Verification</button>
          <button type="button" className="btn btn-success mr-1" disabled={!loan.telco_matched || approveCredit.isPending} onClick={async () => (await confirmAction("Approve this loan?")) && approveCredit.mutate({})}>Approve</button>
          {rejectModify("loans.credit_review")}
        </>
      ) : <p>Waiting for credit officer review.</p>;
      break;
    case "pending_finance":
      body = (
        <>
          <p>Approved by credit officer. Reference number <b>{loan.reference_number}</b>. Amount to send: <b>{money(detail.net_disbursement)}</b>. Destination: <b>LOAN RECEIVABLE - {loan.loan_number}</b>.</p>
          {can("loans.prepare_disbursement") && (
            <form onSubmit={(e) => { e.preventDefault(); prepare.mutate(sourcePayload(source)); }}>
              <div className="row"><div className="col-lg-6"><DisbursementSourceFields loanId={loan.id} value={source} onChange={setSource} fieldError={prepare.fieldError} /></div></div>
              <button type="submit" className="btn btn-primary mt-2" disabled={prepare.isPending}>Prepare Disbursement</button>
            </form>
          )}
        </>
      );
      break;
    case "awaiting_disbursement":
      body = (
        <>
          <p>Batch <b>{loan.latest_disbursement?.batch_id}</b> ({loan.latest_disbursement?.channel.toUpperCase()}, {loan.latest_disbursement?.status}) — {money(loan.latest_disbursement?.amount)} from <b>{loan.latest_disbursement?.source_label}</b>.</p>
          {can("loans.disburse") && loan.latest_disbursement?.channel === "vodacom" && loan.latest_disbursement.status === "prepared" && (
            <button type="button" className="btn btn-success" disabled={disburse.isPending} onClick={() => disburse.mutate({}, { onSuccess: portal })}>Disburse</button>
          )}
          {loan.latest_disbursement?.status !== "prepared" && <Link href="/loans/disbursement" className="btn btn-outline-primary">Open Disbursement desk</Link>}
        </>
      );
      break;
    case "disbursement_failed":
      body = (
        <>
          <div className="alert alert-danger">DISBURSEMENT FAILED ({loan.disbursement_attempts} / {detail.max_disbursement_attempts}): {loan.latest_disbursement?.failure_reason}</div>
          {can("loans.disburse") && <button type="button" className="btn btn-warning" disabled={retry.isPending} onClick={() => retry.mutate({}, { onSuccess: portal })}>Retry Disbursement</button>}
        </>
      );
      break;
    case "escalated":
    case "disbursement_suspense":
      body = <><div className="alert alert-danger">{loan.status_label}: manual decision required.</div><Link href="/loans/disbursement" className="btn btn-primary">Open Disbursement desk</Link></>;
      break;
    case "active":
    case "overdue":
    case "default":
      body = (
        <>
          <p>Outstanding: <b>{money(detail.outstanding?.total)}</b> (Principal {money(detail.outstanding?.principal)} · Penalty {money(detail.outstanding?.penalty)} · Interest {money(detail.outstanding?.interest)}{(detail.outstanding?.insurance ?? 0) > 0 ? ` · Insurance ${money(detail.outstanding?.insurance)}` : ""}){loan.days_past_due > 0 ? ` · ${loan.days_past_due} days past due` : ""}</p>
          {(detail.outstanding?.total ?? 1) <= 0.5 && can(["loans.approve_manager", "loans.disburse", "payments.verify"]) && <button type="button" className="btn btn-success mr-1" disabled={close.isPending} onClick={() => close.mutate({})}>Close Loan</button>}
          {can("loans.write_off") && loan.status !== "active" && detail.write_off_request?.status !== "pending" && <button type="button" className="btn btn-danger mr-1" disabled={writeOff.isPending} onClick={() => ask("Request write-off (another authorised user must approve it)", writeOff)}>Request Write-off</button>}
          {detail.write_off_request?.status === "pending" && (
            <div className="alert alert-warning mt-2 mb-2">
              Write-off requested by {detail.write_off_request.requested_by ?? "—"} on {detail.write_off_request.requested_at}{detail.write_off_request.reason ? ` (${detail.write_off_request.reason})` : ""}: nothing is posted until another authorised user approves it.
              {can("loans.write_off") && (
                <div className="mt-1">
                  <ApprovalActions
                    row={{ id: detail.write_off_request.id, amount: detail.outstanding?.total ?? 0, status: "pending", can_approve: detail.write_off_request.can_approve, approve_blocked_reason: detail.write_off_request.approve_blocked_reason, can_reject: true }}
                    approvePath={`loans/write-off-requests/${detail.write_off_request.id}/approve`}
                    rejectPath={`loans/write-off-requests/${detail.write_off_request.id}/reject`}
                    description={`write-off of loan ${loan.loan_number}`}
                  />
                </div>
              )}
            </div>
          )}
          {detail.write_off_request?.status === "rejected" && <div><small className="text-muted">Last write-off request rejected by {detail.write_off_request.rejected_by ?? "—"}: {detail.write_off_request.rejection_reason}</small></div>}
          {can("loans.reverse_disbursement") && loan.status !== "default" && (
            <span className="d-inline-block" title={detail.can_reverse_disbursement ? "Reverse this loan's disbursement" : detail.reverse_disbursement_blocked_reason ?? ""}>
              <button
                type="button"
                className="btn btn-outline-danger"
                disabled={!detail.can_reverse_disbursement || reverseDisbursement.isPending}
                style={detail.can_reverse_disbursement ? undefined : { pointerEvents: "none" }}
                onClick={() => setReversing(true)}
              >
                Reverse Disbursement
              </button>
            </span>
          )}
          {can("loans.reverse_disbursement") && loan.status !== "default" && !detail.can_reverse_disbursement && detail.reverse_disbursement_blocked_reason && (
            <div><small className="text-muted">Disbursement reversal not available: {detail.reverse_disbursement_blocked_reason}</small></div>
          )}
        </>
      );
      break;
    default:
      body = (
        <p>
          {loan.status_label}{loan.decision_reason ? `: ${loan.decision_reason}` : ""}{loan.frozen_until ? ` · Freeze until ${formatFreezeUntil(loan.frozen_until)}` : ""}
          {detail.write_off && <> · Written off {detail.write_off.written_off_on}: total {money(detail.write_off.amount)}{detail.write_off.principal_amount !== null ? ` (principal ${money(detail.write_off.principal_amount)}${detail.write_off.penalty_amount != null ? ` · penalty ${money(detail.write_off.penalty_amount)} · interest ${money(detail.write_off.interest_amount)} · insurance ${money(detail.write_off.insurance_amount)}` : ""})` : ""}{detail.write_off.components_status === "ambiguous" ? " · component split unknown" : ""}{detail.recovery ? ` · recovered ${money(detail.recovery.recovered)} · unrecovered ${money(detail.recovery.unrecovered)}` : ""}</>}
        </p>
      );
  }

  return (
    <Card title={<>Loan Status: <span className={`badge badge-${loan.status_badge}`}>{loan.status_label}</span>{loan.reference_number ? <small className="ml-2">Ref: {loan.reference_number}</small> : null}</>}>
      {body}
      {can("loans.view") && (
        <form className="row mt-3" onSubmit={(e) => { e.preventDefault(); addComment.mutate({ comment }, { onSuccess: () => setComment("") }); }}>
          <div className="col-md-10"><input className="form-control" placeholder="Add comment" value={comment} onChange={(e) => setComment(e.target.value)} required /></div>
          <div className="col-md-2"><button type="submit" className="btn btn-secondary btn-block" disabled={addComment.isPending}>Comment</button></div>
        </form>
      )}
      <ReversalModal
        open={reversing}
        title="Reverse disbursement"
        submitting={reverseDisbursement.isPending}
        error={reverseDisbursement.fieldError("reason")}
        onClose={() => { reverseDisbursement.setErrors({}); setReversing(false); }}
        onSubmit={(reason) => reverseDisbursement.mutate({ reason }, { onSuccess: () => setReversing(false) })}
        summary={(
          <>
            Reverse the disbursement of <b>TZS {money(loan.amount_approved)}</b>{loan.fee_deduct ? <> (deducted fee <b>TZS {money(loan.loan_fee)}</b> reversed out of FEE INCOME)</> : null}.
            The principal returns to <b>{loan.latest_disbursement?.source_label ?? "the source account"}</b>, LOAN RECEIVABLE is cleared and the loan becomes <b>CANCELLED</b>.
          </>
        )}
      />
    </Card>
  );
}
