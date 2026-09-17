"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";

import { CreditAssessmentCard } from "@/components/credit/CreditAssessmentCard";
import { DisbursementChainCard } from "@/components/loans/DisbursementChainCard";
import { FreezeStatus } from "@/components/loans/FreezeStatus";
import { LoanActions } from "@/components/loans/LoanActions";
import { LoanFormFields } from "@/components/loans/LoanFormFields";
import { LoanRecoveryCard } from "@/components/loans/LoanRecoveryCard";
import { LoanSecurities } from "@/components/loans/LoanSecurities";
import { LoanStatusBadge } from "@/components/loans/LoanStatusBadge";
import { LoanTransactionsCard } from "@/components/loans/LoanTransactionsCard";
import { settlementRows } from "@/components/loans/freeze";
import type { CategoryOption, LoanDetail, LoanForm } from "@/components/loans/types";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Option } from "@/components/ui/SelectBox";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { money, percent } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

const ACTION_LABELS: Record<string, string> = {
  APPLIED: "Loan applied",
  MODIFIED: "Application edited",
  RESUBMITTED: "Resubmitted to manager",
  MANAGER_APPROVED: "Branch manager approved",
  MANAGER_REJECTED: "Branch manager rejected",
  RETURNED_FOR_MODIFICATION: "Returned to loan officer",
  MANDATE_CREATED: "E-mandate created (OTP sent)",
  MANDATE_FAILED: "E-mandate failed",
  MANDATE_OTP_FAILED: "E-mandate OTP failed",
  MANDATE_ACTIVE: "E-mandate active",
  TELCO_VERIFIED: "Vodacom name & number verified",
  TELCO_NAME_MISMATCH: "Vodacom name mismatch",
  CREDIT_APPROVED: "Credit officer approved",
  CREDIT_REJECTED: "Credit officer rejected",
  DISBURSEMENT_PREPARED: "Finance prepared disbursement",
  DISBURSEMENT_REQUESTED: "Disbursement requested (Vodacom)",
  DISBURSEMENT_FAILED: "Disbursement failed",
  RETRY_DISBURSEMENT: "Retry disbursement",
  ESCALATED: "Escalated",
  MOVED_TO_SUSPENSE: "Moved to suspense",
  REQUEUED_FROM_SUSPENSE: "Sent back to Finance",
  OTHER_CHANNEL: "Different channel selected",
  CANCELLED: "Loan cancelled",
  DISBURSED: "Loan disbursed",
  SETTLED_BY_TOPUP: "Settled by top-up",
  CLOSED: "Loan closed",
  WRITTEN_OFF: "Moved to write-off",
  REPAYMENT_REVERSED: "Repayment reversed",
  SETTLEMENT_FREEZE_REVERSED: "Settlement freeze cleared (repayment reversed)",
  DISBURSEMENT_REVERSED: "Disbursement reversed",
  RECOVERY_RECORDED: "Write-off recovery recorded (interest income)",
  RECOVERY_REVERSED: "Write-off recovery reversed",
  COMMENT: "Comment",
  DELETED: "Deleted",
};

function formFromDetail(detail: LoanDetail): LoanForm {
  const { loan } = detail;
  return {
    category_id: String(loan.loan_category_id), group_id: loan.group_id ? String(loan.group_id) : "", how_loan: String(loan.amount_applied),
    day: loan.duration ?? "", session: String(loan.sessions), rate: loan.formula, fee_status: loan.fee_deduct ? "YES" : "NO", reason: loan.reason, instalment: String(loan.instalment),
  };
}

/** Loan detail (live view_Dataloan) with workflow actions, schedule, disbursement attempts and audit timeline. */
export default function LoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { data: detail, isLoading } = useApi<LoanDetail>(`loans/${id}`);

  if (isLoading || !detail) {
    return <><PageHeader crumbs={["Loan", "View Loan"]} /><Card><p>Loading...</p></Card></>;
  }

  return <LoanDetailView key={detail.loan.id} detail={detail} openEditInitially={searchParams.get("edit") === "1"} />;
}

function LoanDetailView({ detail, openEditInitially }: { detail: LoanDetail; openEditInitially: boolean }) {
  const id = detail.loan.id;
  const { can } = useAuth();
  const [approved, setApproved] = useState(() => String(detail.loan.amount_approved > 0 ? detail.loan.amount_approved : detail.loan.amount_applied));
  const [editing, setEditing] = useState(() => openEditInitially && ["pending_manager_approval", "returned"].includes(detail.loan.status));
  const [allLoans, setAllLoans] = useState(false);
  const [form, setForm] = useState<LoanForm>(() => formFromDetail(detail));

  const approve = useAction<{ loan_aprove: string }>("post", `loans/${id}/approve-manager`);
  const update = useAction<LoanForm>("put", `loans/${id}`);
  const { data: options } = useQuery({
    queryKey: ["loans/categories", detail.customer.id],
    queryFn: () => api.get<{ data: CategoryOption[]; groups: Option[] }>(`loans/customers/${detail.customer.id}/categories`),
    enabled: editing,
  });

  const openEdit = () => {
    setForm(formFromDetail(detail));
    setEditing(true);
  };

  const { loan, customer } = detail;
  const editable = ["pending_manager_approval", "returned"].includes(loan.status) && can("loans.apply");
  const canApprove = loan.status === "pending_manager_approval" && can("loans.approve_manager");

  return (
    <>
      <PageHeader crumbs={["Loan", "View Loan"]} right={<button type="button" className="btn btn-secondary d-print-none" onClick={() => window.print()}><i className="icon-printer" /> Print</button>} />

      <div className="card">
        <div className="body">
          <div className="row">
            <div className="col-md-4 d-flex align-items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={customer.photo_url} alt="" className="rounded-circle mr-2" width={42} height={42} />
              <div><b>{customer.short_name}</b><br /><small>{customer.customer_code}</small></div>
            </div>
            <div className="col-md-4">
              {can("loans.apply") && <Link href="/loans/apply" className="btn btn-success mr-1">Add Loan</Link>}
              <button type="button" className="btn btn-dark" onClick={() => setAllLoans(true)}>View All Loans</button>
            </div>
            <div className="col-md-4"><Link href={`/customers/${customer.id}`} className="btn btn-info">Customer profile</Link></div>
          </div>
          <hr />
          <div className="row">
            <div className="col-md-4">
              <b>Create Date:</b> {customer.created_at}<br />
              <b>Monthly Income :</b> {money(customer.monthly_income)}<br />
              <b>Position :</b>{customer.business_type ?? ""}<br />
              <b>Age:</b> {customer.age} years<br />
              <b>Gender:</b> {customer.gender}
            </div>
            <div className="col-md-4">
              <b>Region:</b> {customer.region}<br />
              <b>District:</b> {customer.district}<br />
              <b>Ward:</b> {customer.ward}<br />
              <b>Street:</b> {customer.street}<br />
              <b>Place of business:</b> {customer.place_of_business}<br />
              <small>(NIDA) / Voter ID / Driver&apos;s Licence - {customer.id_number}</small>
            </div>
            <div className="col-md-4">
              <b>Phone number:</b> {customer.phone}<br />
              <b>Branch:</b> {customer.branch}<br />
              <b>Customer Type:</b> {customer.customer_type ?? "—"}<br />
              <b>Customer status:</b> {customer.status_label}<br />
              <b>KYC:</b> {customer.kyc_status === "completed" ? "Completed" : "Incomplete"}
            </div>
          </div>
        </div>
      </div>

      <LoanActions detail={detail} onEdit={openEdit} />

      <Card title="Loan Eligibility & Re-borrowing">
        <FreezeStatus freeze={detail.customer_freeze} eligible={detail.customer_eligible} showPrevious={detail.customer_freeze?.previous_loan?.id !== detail.loan.id} />
        {detail.loan.disbursed_at_iso && (
          <>
            <div className="mf-section-title mt-3">This Loan</div>
            <dl className="mf-dl mb-0">
              {settlementRows({
                id: detail.loan.id,
                loan_number: detail.loan.loan_number,
                loan_category: detail.loan.category ?? null,
                disbursed_at: detail.loan.disbursed_at_iso,
                expected_completion_date: detail.loan.expected_completion_date,
                settled_at: detail.loan.settled_at,
                early_settlement: detail.loan.early_settlement,
                freeze_days: detail.loan.freeze_days,
                freeze_started_at: detail.loan.freeze_started_at,
                frozen_until: detail.loan.frozen_until,
                frozen_until_label: detail.loan.frozen_until_label,
                freeze_status: detail.loan.freeze_status,
              }, "Loan").map(([label, value]) => (
                <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>
              ))}
            </dl>
          </>
        )}
      </Card>

      <LoanSecurities detail={detail} editable={editable} />

      <Card>
        <div className="table-responsive">
          <table className="table mb-0">
            <thead><tr><th>Remain Loan Amount</th><th>Salary Advance</th><th>Penalty Amount</th><th>Loan Fee</th><th>Total Deduction</th><th>Remain Cash</th></tr></thead>
            <tbody><tr>
              <td>{money(detail.deductions.remain_loan)}</td><td>{money(detail.deductions.salary_advance)}</td><td>{money(detail.deductions.penalty)}</td>
              <td>{money(detail.deductions.loan_fee)}</td><td>{money(detail.deductions.total)}</td><td>{money(detail.deductions.remain_cash)}</td>
            </tr></tbody>
          </table>
        </div>
        {detail.loan_fee && detail.loan_fee.amount > 0 && (
          <p className="mt-2 mb-0" data-testid="loan-fee-memo">
            Loan fee <b>TZS {money(detail.loan_fee.amount)}</b> — {detail.loan_fee.deducted ? detail.loan_fee.note : <b>{detail.loan_fee.note}</b>}
          </p>
        )}
        {detail.topup_of && <p className="mt-2 mb-0">Top-up of loan <Link href={`/loans/${detail.topup_of.id}`}>{detail.topup_of.loan_number}</Link> ({detail.topup_of.status_label}). Amount to send: <b>{money(detail.net_disbursement)}</b></p>}
      </Card>

      <Card title="Applied Loan Application Form">
        <form onSubmit={(e) => { e.preventDefault(); approve.mutate({ loan_aprove: approved }); }}>
          <div className="row">
            <div className="col-md-4 mb-2"><span>Customer Type</span><input className="form-control" readOnly value={loan.category_customer_type ?? ""} /></div>
            <div className="col-md-4 mb-2"><span>Loan Category</span><input className="form-control" readOnly value={`${loan.category ?? ""} / ${percent(loan.interest_rate)}`} /></div>
            <div className="col-md-4 mb-2"><span>Branch</span><input className="form-control" readOnly value={loan.branch ?? ""} /></div>
            <div className="col-md-4 mb-2"><span>Loan Amount Applied</span><input className="form-control" readOnly value={money(loan.amount_applied)} /></div>
            <div className="col-md-3 mb-2">
              <span className="text-success"><b>Approved Loan</b></span>
              <input type="number" className="form-control border-success" value={approved} readOnly={!canApprove} onChange={(e) => setApproved(e.target.value)} required />
              {approve.fieldError("loan_aprove") && <div className="field-error">{approve.fieldError("loan_aprove")}</div>}
            </div>
            <div className="col-md-3 mb-2"><span>Restoration Type</span><input className="form-control" readOnly value={loan.duration_label ?? ""} /></div>
            <div className="col-md-3 mb-2"><span>Restoration Time</span><input className="form-control" readOnly value={loan.sessions} /></div>
            <div className="col-md-3 mb-2"><span>Instalment</span><input className="form-control" readOnly value={money(loan.instalment)} /></div>
            <div className="col-md-3 mb-2"><span>Purpose of Loan</span><input className="form-control" readOnly value={loan.reason} /></div>
            <div className="col-md-3 mb-2"><span>Loan + interest</span><input className="form-control" readOnly value={money(loan.total_payable)} /></div>
            <div className="col-md-3 mb-2"><span>Restoration</span><input className="form-control" readOnly value={money(loan.restoration)} /></div>
            <div className="col-md-3 mb-2"><span>Insurance</span><input className="form-control" readOnly value={money(loan.insurance)} /></div>
          </div>
          <div className="text-center m-t-20">
            {canApprove ? <button type="submit" className="btn btn-primary" disabled={approve.isPending}><i className="icon-check" />Approve</button> : <LoanStatusBadge loan={loan} />}
          </div>
        </form>
      </Card>

      <CreditAssessmentCard loanId={detail.loan.id} assessment={detail.credit_assessment ?? null} />

      {detail.mandate && (
        <Card title="Bank E-Mandate">
          <p className="mb-0">{detail.mandate.bank_name} · {detail.mandate.account_number} · {detail.mandate.account_name} · Ref {detail.mandate.mandate_reference ?? "—"} · <b>{detail.mandate.status.toUpperCase()}</b> · OTP attempts {detail.mandate.otp_attempts}{detail.mandate.failure_reason ? ` · ${detail.mandate.failure_reason}` : ""}</p>
        </Card>
      )}

      {detail.disbursement_chain && <DisbursementChainCard chain={detail.disbursement_chain} ledger={detail.ledger} />}

      {detail.disbursements.length > 0 && (
        <Card title="Disbursement Attempts">
          <DataTable
            rows={detail.disbursements}
            searchable={false}
            rowKey={(row) => row.id}
            columns={[
              { key: "attempt", header: "Attempt" },
              { key: "batch_id", header: "Batch ID" },
              { key: "channel", header: "Channel", render: (row) => row.channel.toUpperCase() },
              { key: "phone", header: "Phone" },
              { key: "amount", header: "Amount", render: (row) => money(row.amount) },
              { key: "source_label", header: "Source Account" },
              { key: "journal", header: "Journal Ref", value: (row) => row.journal_entry?.reference ?? "", render: (row) => row.journal_entry?.reference ?? "—" },
              { key: "status", header: "Status", render: (row) => <span className={`badge badge-${row.status === "success" ? "success" : row.status === "failed" || row.status === "cancelled" ? "danger" : "info"}`}>{row.status.toUpperCase()}</span> },
              { key: "provider_reference", header: "Reference" },
              { key: "failure_reason", header: "Reason" },
              { key: "requested_by", header: "Requested By" },
              { key: "completed_at", header: "Completed" },
            ]}
          />
        </Card>
      )}

      {detail.schedules.length > 0 && (
        <Card title="Repayment Schedule">
          <DataTable
            rows={detail.schedules}
            searchable={false}
            rowKey={(row) => row.id}
            columns={[
              { key: "sn", header: "S/no.", render: (_, index) => `${index + 1}.`, sortable: false },
              { key: "due_date", header: "Date" },
              { key: "amount", header: "Restoration", render: (row) => money(row.amount) },
              { key: "paid_amount", header: "Received", render: (row) => money(row.paid_amount) },
              { key: "pending", header: "Pending", render: (row) => money(row.pending) },
            ]}
          />
        </Card>
      )}

      {detail.recovery && <LoanRecoveryCard loanId={detail.loan.id} loanStatus={loan.status} position={detail.recovery} recoveries={detail.recoveries} />}

      {detail.transactions.length > 0 && <LoanTransactionsCard loanId={detail.loan.id} transactions={detail.transactions} />}

      <Card title="Loan Timeline">
        <DataTable
          rows={detail.timeline}
          rowKey={(row) => row.id}
          columns={[
            { key: "created_at", header: "Date" },
            { key: "action", header: "Action", render: (row) => ACTION_LABELS[row.action] ?? row.action },
            { key: "status", header: "Status", value: (row) => `${row.from ?? ""} ${row.to ?? ""}`, render: (row) => (row.from && row.from !== row.to ? `${row.from} → ${row.to}` : row.to ?? "") },
            {
              key: "context",
              header: "Details",
              sortable: false,
              value: (row) => JSON.stringify(row.context ?? {}),
              render: (row) => Object.entries(row.context ?? {}).filter(([, value]) => value !== null && value !== "").map(([key, value]) => <div key={key}><small><b>{key.replace(/_/g, " ")}:</b> {String(value)}</small></div>),
            },
            { key: "user", header: "User" },
          ]}
        />
      </Card>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit loan" size="xl" submitLabel={loan.status === "returned" ? "Update & Resubmit" : "Update"} submitting={update.isPending} onSubmit={() => update.mutate(form, { onSuccess: () => setEditing(false) })}>
        <LoanFormFields form={form} setForm={setForm} categories={options?.data ?? []} groups={options?.groups ?? []} fieldError={update.fieldError} showInstalment />
      </Modal>

      <Modal open={allLoans} onClose={() => setAllLoans(false)} title="All Loans" size="xl">
        <DataTable
          rows={detail.customer_loans}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/no.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "loan_number", header: "Loan Ac", render: (row) => <Link href={`/loans/${row.id}`} onClick={() => setAllLoans(false)}>{row.loan_number}</Link> },
            { key: "category", header: "Loan Product" },
            { key: "interest_rate", header: "Loan Interest", render: (row) => percent(row.interest_rate) },
            { key: "amount_approved", header: "Amount Disbursed", render: (row) => money(row.withdrawn_at ? row.amount_approved : 0) },
            { key: "total_payable", header: "Principal + interest", render: (row) => money(row.withdrawn_at ? row.total_payable : 0) },
            { key: "duration_label", header: "Duration Type" },
            { key: "sessions", header: "Number of Repayment" },
            { key: "restoration", header: "Restoration", render: (row) => money(row.withdrawn_at ? row.restoration : 0) },
            { key: "status_label", header: "Status", render: (row) => <LoanStatusBadge loan={row} /> },
            { key: "withdrawn_at", header: "Withdrawal Date" },
            { key: "end_date", header: "End Date" },
          ]}
        />
      </Modal>
    </>
  );
}
