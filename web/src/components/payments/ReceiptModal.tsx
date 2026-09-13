"use client";

import { Modal } from "@/components/ui/Modal";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface Receipt {
  receipt_number: string;
  company: string;
  customer: string | null;
  customer_code: string | null;
  branch: string | null;
  loan_number: string | null;
  amount: number;
  channel: string;
  paid_on: string;
  employee: string | null;
  status_label: string;
  outstanding: { principal: number; penalty: number; interest: number; insurance: number; total: number } | null;
}

/** Teller cash receipt ("Do you want a receipt?") — printable, marked PENDING_VERIFICATION until Finance confirms. */
export function ReceiptModal({ paymentId, onClose }: { paymentId: number | null; onClose: () => void }) {
  const { data: receipt } = useApi<Receipt>(paymentId ? `teller/receipts/${paymentId}` : null);

  return (
    <Modal open={paymentId !== null} onClose={onClose} title="Receipt">
      {receipt ? (
        <div id="mf-receipt">
          <h6 className="text-center mb-1">{receipt.company}</h6>
          <p className="text-center mb-2">RECEIPT No. {receipt.receipt_number}</p>
          <table className="table table-sm mb-2">
            <tbody>
              <tr><td>Customer</td><td>{receipt.customer} / {receipt.customer_code}</td></tr>
              <tr><td>Branch</td><td>{receipt.branch}</td></tr>
              <tr><td>Loan</td><td>{receipt.loan_number}</td></tr>
              <tr><td>Amount</td><td><b>{money(receipt.amount)}</b> ({receipt.channel})</td></tr>
              <tr><td>Date</td><td>{receipt.paid_on}</td></tr>
              <tr><td>Teller</td><td>{receipt.employee}</td></tr>
              <tr><td>Status</td><td>{receipt.status_label}</td></tr>
              {receipt.outstanding && <tr><td>Remaining Debt</td><td>{money(receipt.outstanding.total)}</td></tr>}
            </tbody>
          </table>
          <div className="text-center">
            <button type="button" className="btn btn-primary" onClick={() => window.print()}><i className="icon-printer" /> Print</button>
          </div>
        </div>
      ) : (
        <p>Loading...</p>
      )}
    </Modal>
  );
}
