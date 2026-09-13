"use client";

import { Modal } from "@/components/ui/Modal";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

import { sum } from "./FilterModal";
import type { BranchBalance } from "./types";

/** Branch account balances modal (Agent "Balance", Insurance "Saving Deposit Balance"). */
export function BalanceModal({ open, onClose, title, path, totalLabel = "TOTAL" }: { open: boolean; onClose: () => void; title: string; path: string; totalLabel?: string }) {
  const { data: rows, isLoading } = useApi<BranchBalance[]>(open ? path : null);

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="table-responsive">
        <table className="table table-hover dataTable table-custom">
          <thead className="thead-info">
            <tr>
              <th>S/no.</th>
              <th>{path.startsWith("agent") ? "branch" : "Branch"}</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={3} className="mf-loading">Loading...</td></tr>
            )}
            {(rows ?? []).map((row, index) => (
              <tr key={row.branch_id}>
                <td>{index + 1}.</td>
                <td>{row.branch}</td>
                <td>{money(row.amount)}</td>
              </tr>
            ))}
            <tr>
              <td><b>{totalLabel}</b></td>
              <td />
              <td><b>{money(sum(rows, (row) => row.amount))}</b></td>
            </tr>
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
