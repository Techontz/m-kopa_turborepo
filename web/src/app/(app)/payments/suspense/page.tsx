"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { PaymentFilterModal, SearchButton, total, type PaymentFilters } from "@/components/payments/PaymentFilterModal";
import type { Payment } from "@/components/payments/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { promptReason } from "@/components/ui/notify";
import { api } from "@/lib/api";
import { money, todayIso } from "@/lib/format";
import { useAction } from "@/lib/hooks";

interface LoanOption {
  value: string;
  label: string;
  written_off?: boolean;
  outstanding: { principal: number; penalty: number; interest: number; insurance: number; total: number };
}

const STATUSES = [
  { value: "suspense", label: "SUSPENSE (UNALLOCATED + FLAGGED)" },
  { value: "unallocated", label: "UNALLOCATED" },
  { value: "flagged", label: "FLAGGED" },
  { value: "allocated", label: "ALLOCATED" },
  { value: "refunded", label: "REFUNDED" },
  { value: "direct", label: "DIRECT PAYMENTS (WEBHOOK)" },
  { value: "all", label: "ALL" },
];

const EMPTY_CONFIRMED = { loan_id: "", amount: "", channel: "BANK", bank_account_id: "", transaction_id: "", reference: "", paid_on: todayIso(), note: "" };

const EMPTY_UNMATCHED = { amount: "", channel: "BANK", transaction_id: "", reference: "", phone: "", paid_on: todayIso(), note: "" };

/** Payments → Suspense Account: unmatched / overpaid money; Finance confirms ownership and allocates. */
export default function SuspensePage() {
  const [filters, setFilters] = useState<PaymentFilters>({});
  const [filtering, setFiltering] = useState(false);
  const [allocating, setAllocating] = useState<Payment | null>(null);
  const [allocation, setAllocation] = useState({ loan_id: "", amount: "" });
  const [recording, setRecording] = useState(false);
  const [unmatched, setUnmatched] = useState(EMPTY_UNMATCHED);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(EMPTY_CONFIRMED);

  const { data, isLoading } = useQuery({
    queryKey: ["payments/suspense", filters],
    queryFn: () => api.get<{ data: Payment[]; suspense_balance: number }>("payments/suspense", { ...filters }),
  });
  const { data: loanOptions } = useQuery({
    queryKey: ["payments/loan-options"],
    queryFn: () => api.get<{ data: LoanOption[] }>("payments/loan-options").then((response) => response.data),
    enabled: allocating !== null || confirming,
  });

  const allocate = useAction<{ id: number; loan_id: string; amount: string }>("post", (body) => `payments/suspense/${body.id}/allocate`);
  const flag = useAction<{ id: number; reason: string }>("post", (body) => `payments/suspense/${body.id}/flag`);
  const refund = useAction<{ id: number; reason: string }>("post", (body) => `payments/suspense/${body.id}/refund`);
  const record = useAction<typeof EMPTY_UNMATCHED>("post", "payments/unmatched");
  const recordConfirmed = useAction<typeof EMPTY_CONFIRMED>("post", "payments/confirmed");

  const rows = data?.data;
  const selectedLoan = loanOptions?.find((option) => option.value === allocation.loan_id);
  const confirmedLoan = loanOptions?.find((option) => option.value === confirmed.loan_id);

  const withReason = async (title: string, run: (reason: string) => void) => {
    const reason = await promptReason(title);
    if (reason) {
      run(reason);
    }
  };

  return (
    <>
      <PageHeader crumbs={["Payments", "Suspense Account"]} />

      <Card
        title={<>Suspense Account: <b>{money(data?.suspense_balance)}</b></>}
        actions={
          <>
            <button type="button" className="btn btn-success mr-1" onClick={() => { setConfirmed(EMPTY_CONFIRMED); recordConfirmed.setErrors({}); setConfirming(true); }}><i className="icon-check" /> Record Confirmed Payment</button>
            <button type="button" className="btn btn-primary mr-1" onClick={() => { setUnmatched(EMPTY_UNMATCHED); setRecording(true); }}><i className="icon-plus" /> Unmatched Payment</button>
            <Link href="/payments/branch-receipts" className="btn btn-outline-secondary mr-1">Branch Receipts</Link>
            <SearchButton onClick={() => setFiltering(true)} />
          </>
        }
      >
        <DataTable
          rows={rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "receipt_number", header: "Receipt" },
            { key: "channel", header: "Channel" },
            { key: "transaction_id", header: "Transaction ID" },
            { key: "reference", header: "Reference" },
            { key: "phone", header: "Phone Number" },
            { key: "customer", header: "Customer Name" },
            { key: "branch", header: "Branch Name", render: (row) => row.branch ?? "HEAD OFFICE" },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "unallocated_amount", header: "Unallocated", render: (row) => money(row.unallocated_amount) },
            { key: "paid_on", header: "Date" },
            { key: "status", header: "Status", render: (row) => <Badge tone={row.status_badge}>{row.status_label}</Badge> },
            {
              key: "note",
              header: "Comment",
              render: (row) => [row.note, row.flag_reason, row.rejection_reason, ...(row.allocations ?? []).map((item) => `${item.loan_number}: P ${money(item.principal)} / Pn ${money(item.penalty)} / I ${money(item.interest)}`)].filter(Boolean).join(" · "),
            },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) =>
                (row.status === "unallocated" || row.status === "flagged") && (
                  <>
                    {row.status === "unallocated" && (
                      <button type="button" className="btn btn-sm btn-icon btn-primary mr-1" title="Allocate" onClick={() => { setAllocating(row); setAllocation({ loan_id: "", amount: String(row.unallocated_amount) }); }}><i className="icon-pencil" /></button>
                    )}
                    <button type="button" className="btn btn-sm btn-icon btn-warning mr-1" title={row.status === "flagged" ? "Remove flag" : "Flag"} onClick={() => withReason(row.status === "flagged" ? "Remove flag" : "Flag payment", (reason) => flag.mutate({ id: row.id, reason }))}><i className="icon-flag" /></button>
                    <button type="button" className="btn btn-sm btn-icon btn-danger" title="Refund" disabled={refund.isPending} onClick={() => withReason("Refund payment", (reason) => refund.mutate({ id: row.id, reason }))}><i className={refund.isPending && refund.variables?.id === row.id ? "fa fa-spinner fa-spin" : "icon-action-undo"} /></button>
                  </>
                ),
            },
          ]}
          footer={
            <tr>
              <td><b>TOTAL</b></td>
              <td /><td /><td /><td /><td /><td /><td />
              <td><b>{money(total(rows, (row) => row.amount))}</b></td>
              <td><b>{money(total(rows, (row) => row.unallocated_amount))}</b></td>
              <td /><td /><td /><td />
            </tr>
          }
        />
      </Card>

      <Modal
        open={allocating !== null}
        onClose={() => setAllocating(null)}
        title={allocating && `Allocate ${allocating.receipt_number} — ${money(allocating.unallocated_amount)}`}
        size="lg"
        submitLabel="Allocate"
        submitting={allocate.isPending}
        onSubmit={() => allocating && allocate.mutate({ id: allocating.id, ...allocation }, { onSuccess: () => setAllocating(null) })}
      >
        <div className="row">
          <Field label="Customer / Loan:" required className="col-md-8" error={allocate.fieldError("loan_id")}>
            <SelectBox placeholder="Search Customer" options={loanOptions} value={allocation.loan_id} onChange={(value) => setAllocation({ ...allocation, loan_id: value ?? "" })} />
          </Field>
          <Field label="Amount:" required className="col-md-4" error={allocate.fieldError("amount")}>
            <input type="number" className="form-control" value={allocation.amount} onChange={(e) => setAllocation({ ...allocation, amount: e.target.value })} required />
          </Field>
          {selectedLoan && (
            <div className="col-md-12">
              {selectedLoan.written_off ? (
                <div className="alert alert-warning mb-0">
                  This loan is <b>WRITTEN OFF</b> (unrecovered <b>TZS {money(selectedLoan.outstanding.total)}</b>: principal {money(selectedLoan.outstanding.principal)} · penalty {money(selectedLoan.outstanding.penalty)} · interest {money(selectedLoan.outstanding.interest)} · insurance {money(selectedLoan.outstanding.insurance)}): recorded as write-off recovery, split Principal → Penalty → Interest (20% to interest reserve) → Insurance. The loan stays written off and its write-off is not changed; any amount above the unrecovered balance stays in suspense.
                </div>
              ) : (
                <table className="table table-custom mb-0">
                  <thead className="thead-info"><tr><th>Principal</th><th>Penalty</th><th>Interest</th><th>Insurance</th><th>Total</th></tr></thead>
                  <tbody>
                    <tr>
                      <td>{money(selectedLoan.outstanding.principal)}</td>
                      <td>{money(selectedLoan.outstanding.penalty)}</td>
                      <td>{money(selectedLoan.outstanding.interest)}</td>
                      <td>{money(selectedLoan.outstanding.insurance)}</td>
                      <td><b>{money(selectedLoan.outstanding.total)}</b></td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Record Confirmed Payment"
        size="lg"
        submitLabel="Confirm & Post"
        submitting={recordConfirmed.isPending}
        onSubmit={() => recordConfirmed.mutate(confirmed, { onSuccess: () => setConfirming(false) })}
      >
        <div className="row">
          <Field label="Customer / Loan:" required className="col-md-8" error={recordConfirmed.fieldError("loan_id")}>
            <SelectBox placeholder="Search Customer" options={loanOptions} value={confirmed.loan_id} onChange={(value) => setConfirmed({ ...confirmed, loan_id: value ?? "" })} />
          </Field>
          <Field label="Amount:" required className="col-md-4" error={recordConfirmed.fieldError("amount")}>
            <input type="number" className="form-control" value={confirmed.amount} onChange={(e) => setConfirmed({ ...confirmed, amount: e.target.value })} required />
          </Field>
          <Field label="Channel:" required className="col-md-4" error={recordConfirmed.fieldError("channel")}>
            <select className="form-control" value={confirmed.channel} onChange={(e) => setConfirmed({ ...confirmed, channel: e.target.value })}>
              {["BANK", "VODACOM", "AIRTEL", "TIGO", "HALOPESA", "MPESA", "CASH", "OTHER"].map((channel) => <option key={channel} value={channel}>{channel}</option>)}
            </select>
          </Field>
          <Field label="Bank account (blank = bank clearing):" className="col-md-4" error={recordConfirmed.fieldError("bank_account_id")}>
            <SelectBox placeholder="Bank clearing" optionsUrl="teller/bank-accounts" isClearable value={confirmed.bank_account_id} onChange={(value) => setConfirmed({ ...confirmed, bank_account_id: value ?? "" })} />
          </Field>
          <Field label="Date:" required className="col-md-4" error={recordConfirmed.fieldError("paid_on")}>
            <input type="date" className="form-control" value={confirmed.paid_on} onChange={(e) => setConfirmed({ ...confirmed, paid_on: e.target.value })} required />
          </Field>
          <Field label="Transaction ID:" className="col-md-4" error={recordConfirmed.fieldError("transaction_id")}>
            <input className="form-control" value={confirmed.transaction_id} onChange={(e) => setConfirmed({ ...confirmed, transaction_id: e.target.value })} />
          </Field>
          <Field label="Reference:" className="col-md-4" error={recordConfirmed.fieldError("reference")}>
            <input className="form-control" value={confirmed.reference} onChange={(e) => setConfirmed({ ...confirmed, reference: e.target.value })} />
          </Field>
          <Field label="Comment:" className="col-md-4" error={recordConfirmed.fieldError("note")}>
            <input className="form-control" value={confirmed.note} onChange={(e) => setConfirmed({ ...confirmed, note: e.target.value })} />
          </Field>
          <div className="col-md-12">
            <small className="text-muted">
              {confirmedLoan?.written_off
                ? `WRITTEN-OFF loan: recorded as a recovery (unrecovered TZS ${money(confirmedLoan.outstanding.total)}), split Principal → Penalty → Interest → Insurance.`
                : "Single step: the payment is CONFIRMED, received into suspense (Dr BANK / Cr SUSPENSE) and allocated to the loan (Principal → Penalty → Interest → Insurance) in one transaction."}
            </small>
          </div>
        </div>
      </Modal>

      <Modal
        open={recording}
        onClose={() => setRecording(false)}
        title="Unmatched Payment"
        size="lg"
        submitLabel="Save"
        submitting={record.isPending}
        onSubmit={() => record.mutate(unmatched, { onSuccess: () => setRecording(false) })}
      >
        <div className="row">
          <Field label="Amount:" required className="col-md-4" error={record.fieldError("amount")}>
            <input type="number" className="form-control" placeholder="Enter Amount" value={unmatched.amount} onChange={(e) => setUnmatched({ ...unmatched, amount: e.target.value })} required />
          </Field>
          <Field label="Channel:" required className="col-md-4" error={record.fieldError("channel")}>
            <select className="form-control" value={unmatched.channel} onChange={(e) => setUnmatched({ ...unmatched, channel: e.target.value })}>
              {["BANK", "VODACOM", "AIRTEL", "TIGO", "HALOPESA", "OTHER"].map((channel) => <option key={channel} value={channel}>{channel}</option>)}
            </select>
          </Field>
          <Field label="Date:" required className="col-md-4" error={record.fieldError("paid_on")}>
            <input type="date" className="form-control" value={unmatched.paid_on} onChange={(e) => setUnmatched({ ...unmatched, paid_on: e.target.value })} required />
          </Field>
          <Field label="Transaction ID:" className="col-md-4" error={record.fieldError("transaction_id")}>
            <input className="form-control" value={unmatched.transaction_id} onChange={(e) => setUnmatched({ ...unmatched, transaction_id: e.target.value })} />
          </Field>
          <Field label="Reference:" className="col-md-4" error={record.fieldError("reference")}>
            <input className="form-control" value={unmatched.reference} onChange={(e) => setUnmatched({ ...unmatched, reference: e.target.value })} />
          </Field>
          <Field label="Phone Number:" className="col-md-4" error={record.fieldError("phone")}>
            <input className="form-control" value={unmatched.phone} onChange={(e) => setUnmatched({ ...unmatched, phone: e.target.value })} />
          </Field>
          <Field label="Comment:" className="col-md-12" error={record.fieldError("note")}>
            <input className="form-control" value={unmatched.note} onChange={(e) => setUnmatched({ ...unmatched, note: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <PaymentFilterModal open={filtering} onClose={() => setFiltering(false)} onApply={setFilters} statuses={STATUSES} />
    </>
  );
}
