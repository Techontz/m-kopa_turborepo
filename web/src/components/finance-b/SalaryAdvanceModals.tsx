"use client";

import { useState } from "react";

import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { confirmAction } from "@/components/ui/notify";
import { money } from "@/lib/format";
import { useAction } from "@/lib/hooks";

import { sum } from "./FilterModal";
import type { SalaryAdvance } from "./types";

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
