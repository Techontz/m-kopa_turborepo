"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { LoanRecoveryCard } from "@/components/loans/LoanRecoveryCard";
import type { RecoveryPosition } from "@/components/loans/recovery";
import { ProviderSelect } from "@/components/payments/ChannelProviderFields";
import { ReceiptModal } from "@/components/payments/ReceiptModal";
import type { Payment } from "@/components/payments/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface Outstanding {
  principal: number;
  penalty: number;
  interest: number;
  insurance: number;
  total: number;
}

interface TellerData {
  customer: { id: number; full_name: string; customer_code: string; phone: string; photo_url: string; branch: string | null };
  loan: {
    id: number;
    loan_number: string;
    reference_number: string | null;
    status: string;
    status_label: string;
    withdrawn_at: string | null;
    end_date: string | null;
    loan_amount: number;
    insurance: number;
    restoration: number;
    total_loan: number;
    amount_paid: number;
    remaining_debt: number;
    is_repayable: boolean;
  } | null;
  outstanding: Outstanding | null;
  pending_cash: number;
  available_to_deposit: number;
  /** A written-off loan whose split is known and not fully recovered: money is held pending Finance, then recovered. */
  accepts_recovery?: boolean;
  salary_advance: number;
  recovery_amount: number;
  recovery?: RecoveryPosition | null;
  penalty: number;
  awaiting_cash_out: boolean;
  cashbook: { opening: number; deposit: number; withdrawal: number; closing: number; pending_cash?: number };
  statement: { id: number; date: string; description: string; deposit: number; withdrawal: number; balance: number; remain: number; penalty: number; reversed?: boolean; reversal_reason?: string | null }[];
  receipts: Payment[];
}

interface DepositBody {
  depost: string;
  /** CASH goes to teller cash (banked later on a deposit slip); BANK and MNO are sent to Finance for approval. */
  p_method: "CASH" | "BANK" | "MNO";
  provider: string;
  recept: boolean;
}

const EMPTY_FORM: DepositBody = { depost: "", p_method: "CASH", provider: "", recept: true };

/** Teller → Customer Loan Information (live admin/data_with_depost/{customer}). */
export default function TellerCustomerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const { data, isLoading } = useApi<TellerData>(`teller/customers/${id}`);
  const [depositing, setDepositing] = useState(false);
  const [form, setForm] = useState<DepositBody>(EMPTY_FORM);
  const [receiptId, setReceiptId] = useState<number | null>(null);
  const deposit = useAction<DepositBody, { data: Payment; receipt: boolean }>("post", `teller/customers/${id}/deposit`);
  const nonCash = form.p_method !== "CASH";
  const done = (paymentId: number) => {
    setDepositing(false);
    if (form.recept && paymentId) {
      setReceiptId(paymentId);
    }
    setForm(EMPTY_FORM);
  };
  const submitDeposit = () => {
    deposit.mutate({ ...form, depost: form.depost.replace(/[^\d]/g, "") }, { onSuccess: (result) => done(result.data.id) });
  };

  const loan = data?.loan;
  const statement = data?.statement ?? [];

  return (
    <>
      <PageHeader crumbs={["Teller", "Customer Loan Information"]} />

      <div className="card">
        <div className="body text-center">
          {data && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.customer.photo_url} className="img-thumbnail" alt="customer image" style={{ width: 135, height: 135, objectFit: "cover" }} />
              <br />
              <small>{data.customer.full_name}</small>
              <div className="m-t-10">
                {(loan?.is_repayable || data.accepts_recovery) && can("payments.cash") && (
                  <>
                    <button type="button" className="btn btn-sm btn-primary mr-1" onClick={() => { setForm(EMPTY_FORM); deposit.setErrors({}); setDepositing(true); }}>Deposit</button>
                  </>
                )}
                {data.awaiting_cash_out && (
                  <Link href="/loans/withdrawal" className="btn btn-sm btn-warning">Withdrawal</Link>
                )}
              </div>
            </>
          )}
          {isLoading && <p>Loading...</p>}
        </div>
      </div>

      <Card>
        <div className="table-responsive">
          <table className="table table-hover table-custom">
            <thead className="thead-info">
              <tr><th>Phone Number</th><th>Withdrawal Date</th><th>End Date</th><th>Loan Amount</th><th>Insurance</th><th>Restoration</th><th>Amount Paid</th><th>Remaining debt</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>{data?.customer.phone}</td>
                <td>{loan?.withdrawn_at ?? "YY-MM-DD"}</td>
                <td>{loan?.end_date ?? "YY-MM-DD"}</td>
                <td>{money(loan?.loan_amount)}</td>
                <td>{money(loan?.insurance)}</td>
                <td>{money(loan?.restoration)}</td>
                <td>{money(loan?.amount_paid)}</td>
                <td>{money(loan?.remaining_debt)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {data?.outstanding && (
        <Card title="Outstanding Balance (Principal → Penalty → Interest)">
          <div className="table-responsive">
            <table className="table table-hover table-custom mb-0">
              <thead className="thead-info">
                <tr><th>Principal</th><th>Penalty</th><th>Interest</th><th>Insurance</th><th>Total</th><th>Pending Verification</th><th>Loan Status</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>{money(data.outstanding.principal)}</td>
                  <td>{money(data.outstanding.penalty)}</td>
                  <td>{money(data.outstanding.interest)}</td>
                  <td>{money(data.outstanding.insurance)}</td>
                  <td><b>{money(data.outstanding.total)}</b></td>
                  <td>{money(data.pending_cash)}</td>
                  <td><Badge tone={loan?.is_repayable ? "success" : "info"}>{loan?.status_label}</Badge></td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {loan && data?.recovery && <LoanRecoveryCard loanId={loan.id} loanStatus={loan.status} position={data.recovery} />}

      <div className="row">
        <div className="col-lg-6">
          <Card>
            <div className="table-responsive">
              <table className="table table-hover table-custom mb-0">
                <thead className="thead-info"><tr><th>Opening</th><th>Deposit</th><th>Withdrawal</th><th>Closing</th><th>Pending Cash</th></tr></thead>
                <tbody>
                  <tr>
                    <td>{money(data?.cashbook.opening)}</td>
                    <td>{money(data?.cashbook.deposit)}</td>
                    <td>{money(data?.cashbook.withdrawal)}</td>
                    <td><b>{money(data?.cashbook.closing)}</b></td>
                    <td title="Teller cash receipts not yet confirmed by Finance — not included in Closing">{money(data?.cashbook.pending_cash)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <small className="text-muted">PRINCIPAL A/C ledger movements today — the HQ lending cash moved by this branch&apos;s loans. Pending cash (teller receipts awaiting Finance confirmation) is not part of the closing balance.</small>
          </Card>
        </div>
      </div>

      <div className="m-b-20" style={{ width: 330 }}>
        <SelectBox placeholder="Search Customer" optionsUrl="options/customers" query={{ with_code: 1 }} onChange={(value) => value && router.push(`/teller/${value}`)} />
      </div>

      <Card>
        <div className="table-responsive">
          <table className="table table-hover table-custom">
            <thead className="thead-info"><tr><th>Date</th><th>Description</th><th>Deposit</th><th>Withdrawal</th><th>Balance</th><th>Remaining Debt</th><th>Penalty</th></tr></thead>
            <tbody>
              {statement.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td>{row.reversed ? <><s className="text-muted">{row.description}</s> <span className="badge badge-danger" title={row.reversal_reason ?? ""}>REVERSED</span></> : row.description}</td>
                  <td>{row.reversed ? <s className="text-muted">{money(row.deposit)}</s> : money(row.deposit)}</td>
                  <td>{row.reversed ? <s className="text-muted">{money(row.withdrawal)}</s> : money(row.withdrawal)}</td>
                  <td>{money(row.balance)}</td>
                  <td>{money(row.remain)}</td>
                  <td>{money(row.penalty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {data && data.receipts.length > 0 && (
        <Card title="Cash Receipts">
          <div className="table-responsive">
            <table className="table table-hover table-custom mb-0">
              <thead className="thead-info"><tr><th>Receipt</th><th>Amount</th><th>Date</th><th>Teller</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {data.receipts.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.receipt_number}</td>
                    <td>{money(payment.amount)}</td>
                    <td>{payment.paid_on}</td>
                    <td>{payment.employee}</td>
                    <td><Badge tone={payment.status_badge}>{payment.status_label}</Badge></td>
                    <td><button type="button" className="btn btn-sm btn-icon btn-primary" onClick={() => setReceiptId(payment.id)}><i className="icon-printer" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={depositing && Boolean(data)}
        onClose={() => setDepositing(false)}
        size="lg"
        title={data && (
          <>
            {data.customer.full_name}
            <br />With Date: {loan?.withdrawn_at ?? "YY-MM-DD"} - End Date: {loan?.end_date ?? "YY-MM-DD"}
            <br /> End Deposit Amount : {money(data.available_to_deposit)}
          </>
        )}
        submitLabel="Deposit"
        submitting={deposit.isPending}
        onSubmit={submitDeposit}
      >
        {data && (
          <div className="row clearfix">
            <div className="col-md-4 col-6"><span>Total Loan</span><input type="text" className="form-control" value={money(loan?.total_loan)} readOnly /></div>
            <div className="col-md-2 col-6"><span>Amount Paid</span><input type="text" className="form-control" value={money(loan?.amount_paid)} readOnly /></div>
            <div className="col-md-2 col-12"><span>Insurance</span><input type="text" className="form-control" value={money(loan?.insurance)} readOnly /></div>
            <div className="col-md-4 col-12"><span>Remaining Debt</span><input type="text" className="form-control" value={money(data.outstanding?.total)} readOnly /></div>
            <div className="col-md-4 col-12"><span>Salary advance</span><input type="text" className="form-control" value={money(data.salary_advance)} readOnly /></div>
            <div className="col-md-4 col-6"><span>Recovery Amount</span><input type="text" className="form-control" value={data.recovery_amount.toFixed(2)} readOnly style={{ color: "var(--mf-negative)" }} /></div>
            <div className="col-md-4 col-6"><span>Penalty</span><input type="text" className="form-control" value={data.penalty.toFixed(2)} readOnly style={{ color: "var(--mf-negative)" }} /></div>
            <div className="col-md-6 col-6">
              <span style={{ color: "var(--mf-positive)" }}>Deposit Amount </span>
              <input
                className="form-control"
                autoComplete="off"
                placeholder="Enter Deposit Amount"
                style={{ color: "var(--mf-positive)" }}
                value={form.depost}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^\d]/g, "");
                  setForm({ ...form, depost: digits ? Number(digits).toLocaleString("en-US") : "" });
                }}
                required
              />
              {deposit.fieldError("depost") && <div className="field-error">{deposit.fieldError("depost")}</div>}
            </div>
            <div className="col-md-6 col-6">
              <span>Payment Method:</span>
              <select className="form-control" value={form.p_method} onChange={(e) => setForm({ ...form, p_method: e.target.value as DepositBody["p_method"], provider: "" })} required>
                <option value="CASH">CASH</option>
                <option value="BANK">BANK</option>
                <option value="MNO">MNO</option>
              </select>
              {deposit.fieldError("p_method") && <div className="field-error">{deposit.fieldError("p_method")}</div>}
            </div>
            {nonCash && (
              <ProviderSelect channel={form.p_method === "MNO" ? "MNO" : "BANK"} value={form.provider} onChange={(provider) => setForm({ ...form, provider })} error={deposit.fieldError("provider")} className="col-md-6 col-12 m-t-10" />
            )}
            <div className="col-md-4 col-12">
              <br />
              <div className="d-flex align-items-center">
                <input type="checkbox" checked={form.recept} onChange={(e) => setForm({ ...form, recept: e.target.checked })} style={{ width: 19, height: 19 }} /> &nbsp;&nbsp; Do you want a receipt?
              </div>
            </div>
            <div className="col-md-12 m-t-10">
              <small className="text-muted">
                {data.accepts_recovery ? "Written-off loan: the money becomes a recovery (Principal → Penalty → Interest → Insurance) once Finance confirms it." : `Principal ${money(data.outstanding?.principal)} · Penalty ${money(data.outstanding?.penalty)} · Interest ${money(data.outstanding?.interest)}`}
                {" — "}
                {nonCash ? `${form.p_method}` : "CASH"}: held as PENDING VERIFICATION until it is banked on a deposit slip (Teller → Bank Deposit) and Finance verifies the slip — then the loan is reduced.
              </small>
            </div>
          </div>
        )}
      </Modal>

      <ReceiptModal paymentId={receiptId} onClose={() => setReceiptId(null)} />
    </>
  );
}
