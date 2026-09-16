"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { confirmAction } from "@/components/ui/notify";
import { money } from "@/lib/format";
import { useAction } from "@/lib/hooks";

import { sum } from "./FilterModal";
import type { SalaryAdvance, SalaryAdvanceFeeStatus } from "./types";

/** Label and tone of a salary advance fee status (C2: the fee is income only once collected). */
export function feeStatusBadge(status: SalaryAdvanceFeeStatus | undefined): { label: string; tone: "success" | "warning" | "default" } {
  switch (status) {
    case "collected":
      return { label: "FEE COLLECTED", tone: "success" };
    case "collected_at_approval":
      return { label: "FEE POSTED AT APPROVAL (LEGACY)", tone: "success" };
    case "uncollected":
      return { label: "FEE NOT COLLECTED", tone: "warning" };
    case "no_fee":
      return { label: "NO FEE", tone: "default" };
    default:
      return { label: "PENDING APPROVAL", tone: "default" };
  }
}

/** Fee amount, its collection status and — when it can still be collected — the COLLECT FEE action. */
export function FeeCell({ advance, canCollect, onCollect }: { advance: SalaryAdvance; canCollect: boolean; onCollect: (advance: SalaryAdvance) => void }) {
  const badge = feeStatusBadge(advance.fee_status);

  return (
    <>
      {money(advance.fee)}
      <div>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>
      {advance.fee_collected_by && <div className="text-muted small">by {advance.fee_collected_by}</div>}
      {canCollect && advance.fee_collectable && (
        <button type="button" className="btn btn-sm btn-outline-success mt-1 text-nowrap" onClick={() => onCollect(advance)}>
          <i className="icon-wallet" /> Collect Fee
        </button>
      )}
    </>
  );
}

/** Record the actual collection of an approved advance's fee: posts Dr LOAN FEE A/C / Cr FEE INCOME once. */
export function CollectFeeModal({ advance, onClose }: { advance: SalaryAdvance | null; onClose: () => void }) {
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const collect = useAction<{ id: number; method: string; reference: string }>("post", (body) => `salary-advance/advances/${body.id}/collect-fee`);

  const close = () => {
    setMethod("CASH");
    setReference("");
    collect.setErrors({});
    onClose();
  };

  return (
    <Modal
      open={advance !== null}
      onClose={close}
      title={`Collect Fee (${advance?.customer ?? ""})`}
      submitLabel="Collect Fee"
      submitting={collect.isPending}
      onSubmit={async () => {
        if (advance && (await confirmAction("Record fee collection?", `Collected ${money(advance.fee)} — posts Dr LOAN FEE A/C / Cr FEE INCOME.`))) {
          collect.mutate({ id: advance.id, method, reference }, { onSuccess: close });
        }
      }}
    >
      <p className="mb-2">Fee: <b>{money(advance?.fee ?? 0)}</b>. Record this only when the fee has actually been received.</p>
      <div className="row clearfix">
        <Field label="Method:" className="col-md-6" error={collect.fieldError("method") ?? collect.fieldError("fee")}>
          <select className="form-control" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="CASH">CASH</option>
            <option value="BANK">BANK</option>
            <option value="MOBILE">MOBILE</option>
          </select>
        </Field>
        <Field label="Reference:" className="col-md-6" error={collect.fieldError("reference")}>
          <input className="form-control" maxLength={100} value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

/** Live "Deposit History (customer)" modal. */
export function DepositHistoryModal({ advance, onClose }: { advance: SalaryAdvance | null; onClose: () => void }) {
  const payments = advance?.payments ?? [];

  return (
    <Modal open={advance !== null} onClose={onClose} title={`Deposit History (${advance?.customer ?? ""})`}>
      <div className="table-responsive">
        <table className="table table-hover dataTable table-custom">
          <thead className="thead-info">
            <tr>
              <th>S/No.</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr><td colSpan={4} className="text-center">No data available in table</td></tr>
            )}
            {payments.map((payment, index) => (
              <tr key={payment.id}>
                <td>{index + 1}.</td>
                <td>{money(payment.amount)}</td>
                <td>{payment.created_at}</td>
                <td />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td><b>TOTAL:</b></td>
              <td><b>{money(sum(payments, (payment) => payment.amount))}</b></td>
              <td />
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </Modal>
  );
}

/** Live "Deposit (customer) start Date / End Date" repayment modal. */
export function DepositModal({ advance, onClose }: { advance: SalaryAdvance | null; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const pay = useAction<{ id: number; amount: string }>("post", (body) => `salary-advance/advances/${body.id}/payments`);

  const close = () => {
    setAmount("");
    pay.setErrors({});
    onClose();
  };

  return (
    <Modal
      open={advance !== null}
      onClose={close}
      title={
        <>
          Deposit ({advance?.customer}) <br />start Date:{advance?.start_date} <br /> End Date: {advance?.end_date}
        </>
      }
      submitLabel="Deposit"
      submitting={pay.isPending}
      onSubmit={async () => {
        if (advance && (await confirmAction())) {
          pay.mutate({ id: advance.id, amount }, { onSuccess: close });
        }
      }}
    >
      <div className="row clearfix">
        <Field label="Amount:" className="col-md-12" error={pay.fieldError("amount")}>
          <input type="number" className="form-control" placeholder="Enter Amount" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
      </div>
    </Modal>
  );
}
