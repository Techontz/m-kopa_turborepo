import { payControl } from "./dividends";
import type { DividendAllocation } from "./types";

interface Props {
  row: Pick<DividendAllocation, "balance" | "share_holder">;
  canManage: boolean;
  onPay: () => void;
  onHistory: () => void;
}

/** Action cell: PAY DIVIDEND (managers, balance > 0) or a disabled PAID, and HISTORY for everyone who can view. */
export function AllocationActions({ row, canManage, onPay, onHistory }: Props) {
  const control = payControl(row, canManage);

  return (
    <div className="d-flex flex-column text-nowrap">
      {control === "pay" && (
        <button type="button" className="btn btn-sm btn-success mb-1" onClick={onPay} aria-label={`Pay dividend to ${row.share_holder ?? "shareholder"}`}>
          <i className="icon-wallet" /> PAY DIVIDEND
        </button>
      )}
      {control === "paid" && (
        <button type="button" className="btn btn-sm btn-outline-success mb-1" disabled aria-label="Fully paid">
          <i className="icon-check" /> PAID
        </button>
      )}
      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onHistory}>
        <i className="icon-list" /> HISTORY
      </button>
    </div>
  );
}
