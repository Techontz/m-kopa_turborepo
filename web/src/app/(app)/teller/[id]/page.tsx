"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

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
  salary_advance: number;
  recovery_amount: number;
  penalty: number;
  awaiting_cash_out: boolean;
  cashbook: { opening: number; deposit: number; withdrawal: number; closing: number };
  statement: { id: number; date: string; description: string; deposit: number; withdrawal: number; balance: number; remain: number; penalty: number }[];
  receipts: Payment[];
}

interface DepositBody {
  depost: string;
  p_method: string;
  recept: boolean;
}

/** Teller → Customer Loan Information (live admin/data_with_depost/{customer}). */
export default function TellerCustomerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const { data, isLoading } = useApi<TellerData>(`teller/customers/${id}`);
  const [depositing, setDepositing] = useState(false);
  const [form, setForm] = useState<DepositBody>({ depost: "", p_method: "CASH", recept: true });
  const [receiptId, setReceiptId] = useState<number | null>(null);
  const deposit = useAction<DepositBody, { data: Payment; receipt: boolean }>("post", `teller/customers/${id}/deposit`);

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
                {loan?.is_repayable && can("payments.cash") && (
                  <button type="button" className="btn btn-sm btn-primary mr-1" onClick={() => setDepositing(true)}>Deposit</button>
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
              <tr><th>Phone Number</th><th>Withdrawal Date</th><th>End Date</th><th>Loan Amount</th><th>Insurelance</th><th>Restoration</th><th>Amount Paid</th><th>Remaining debt</th></tr>
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
        <Card title="Outstanding Balance (Principal → Penarty → Interest)">
          <div className="table-responsive">
            <table className="table table-hover table-custom mb-0">
              <thead className="thead-info">
                <tr><th>Principal</th><th>Penarty</th><th>Interest</th><th>Insurelance</th><th>Total</th><th>Pending Verification</th><th>Loan Status</th></tr>
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

      <div className="row">
        <div className="col-lg-6">
          <Card>
            <div className="table-responsive">
              <table className="table table-hover table-custom mb-0">
                <thead className="thead-info"><tr><th>Opening</th><th>Deposit</th><th>Withdrawal</th><th>Closing</th></tr></thead>
                <tbody>
                  <tr>
                    <td>{money(data?.cashbook.opening)}</td>
                    <td>{money(data?.cashbook.deposit)}</td>
                    <td>{money(data?.cashbook.withdrawal)}</td>
                    <td>{money(data?.cashbook.closing)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      <div className="m-b-20" style={{ width: 330 }}>
        <SelectBox placeholder="Search Customer" optionsUrl="options/customers" query={{ with_code: 1 }} onChange={(value) => value && router.push(`/teller/${value}`)} />
      </div>

      <Card>
        <div className="table-responsive">
          <table className="table table-hover table-custom">
            <thead className="thead-info"><tr><th>Date</th><th>Description</th><th>Deposit</th><th>Withdrawal</th><th>Balance</th><th>Remain Debit</th><th>Penalty</th></tr></thead>
            <tbody>
              {statement.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td>{row.description}</td>
                  <td>{money(row.deposit)}</td>
                  <td>{money(row.withdrawal)}</td>
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
        onSubmit={() =>
          deposit.mutate(form, {
            onSuccess: (result) => {
              setDepositing(false);
              setForm({ depost: "", p_method: "CASH", recept: true });
              if (result.receipt) {
                setReceiptId(result.data.id);
              }
            },
          })
        }
      >
        {data && (
          <div className="row clearfix">
            <div className="col-md-4 col-6"><span>Total Loan</span><input type="text" className="form-control" value={money(loan?.total_loan)} readOnly /></div>
            <div className="col-md-2 col-6"><span>Amount Paid</span><input type="text" className="form-control" value={money(loan?.amount_paid)} readOnly /></div>
            <div className="col-md-2 col-12"><span>Insurelance</span><input type="text" className="form-control" value={money(loan?.insurance)} readOnly /></div>
            <div className="col-md-4 col-12"><span>Remain Debit</span><input type="text" className="form-control" value={money(data.outstanding?.total)} readOnly /></div>
            <div className="col-md-4 col-12"><span>Salary advance</span><input type="text" className="form-control" value={money(data.salary_advance)} readOnly /></div>
            <div className="col-md-4 col-6"><span>Recovery Amount</span><input type="text" className="form-control" value={data.recovery_amount.toFixed(2)} readOnly style={{ color: "var(--mf-negative)" }} /></div>
            <div className="col-md-4 col-6"><span>Penart</span><input type="text" className="form-control" value={data.penalty.toFixed(2)} readOnly style={{ color: "var(--mf-negative)" }} /></div>
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
              <span>Select Account:</span>
              <select className="form-control" value={form.p_method} onChange={(e) => setForm({ ...form, p_method: e.target.value })} required>
                <option value="CASH">CASH</option>
              </select>
            </div>
            <div className="col-md-4 col-12">
              <br />
              <div className="d-flex align-items-center">
                <input type="checkbox" checked={form.recept} onChange={(e) => setForm({ ...form, recept: e.target.checked })} style={{ width: 19, height: 19 }} /> &nbsp;&nbsp; Do you wan`t recept?
              </div>
            </div>
            <div className="col-md-12 m-t-10">
              <small className="text-muted">Principal {money(data.outstanding?.principal)} · Penarty {money(data.outstanding?.penalty)} · Interest {money(data.outstanding?.interest)} — cash is held as PENDING VERIFICATION until Finance confirms the bank deposit.</small>
            </div>
          </div>
        )}
      </Modal>

      <ReceiptModal paymentId={receiptId} onClose={() => setReceiptId(null)} />
    </>
  );
}
