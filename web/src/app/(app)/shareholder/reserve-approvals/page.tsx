"use client";

import { useQuery } from "@tanstack/react-query";

import { ApprovalActions, ApprovalStatus, isPending } from "@/components/finance/Approval";
import type { BankTransfer } from "@/components/finance/types";
import { Tile } from "@/components/shareholders/Tile";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";

interface ReserveTransfers {
  data: BankTransfer[];
  hq_reserve_balance: number;
  investment_reserve_balance: number;
}

/**
 * Reserve approvals: HQ asks to send part of the HQ reserve to the Investment RESERVE A/C. Only Super Admin, Admin or a
 * shareholder may approve or reject; the money moves only on approval.
 */
export default function ShareholderReserveApprovalsPage() {
  const { can } = useAuth();
  const enabled = can("shareholder.portal");
  const { data, isLoading } = useQuery({
    queryKey: ["portal/shareholder/reserve-transfers"],
    queryFn: () => api.get<ReserveTransfers>("portal/shareholder/reserve-transfers"),
    enabled,
  });
  const rows = data?.data ?? [];
  const pending = rows.filter(isPending);

  return (
    <>
      <PageHeader crumbs={["Shareholder", "Reserve Approvals"]} />
      <div className="row sh-tiles">
        <Tile label="HQ reserve (TZS)" value={money(data?.hq_reserve_balance)} className="col-md-4" />
        <Tile label="Investment Reserve A/C (TZS)" value={money(data?.investment_reserve_balance)} tone="success" className="col-md-4" />
        <Tile label="Awaiting your decision (TZS)" value={money(pending.reduce((total, row) => total + row.amount, 0))} tone="warning" className="col-md-4" />
      </div>
      <Card title="HQ reserve → Investment Reserve A/C">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="thead-info">
              <tr><th>Date</th><th className="text-right">Amount</th><th>Reference</th><th>Requested by</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="text-center">Loading...</td></tr>}
              {!isLoading && rows.length === 0 && <tr><td colSpan={6} className="text-center text-muted">No reserve transfers yet</td></tr>}
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.transfer_date}</td>
                  <td className="text-right">{money(row.amount)}</td>
                  <td>{row.reference || "-"}</td>
                  <td>{row.employee ?? "—"}</td>
                  <td><ApprovalStatus row={row} /></td>
                  <td>
                    <ApprovalActions
                      row={row}
                      approvePath={`portal/shareholder/reserve-transfers/${row.id}/approve`}
                      rejectPath={`portal/shareholder/reserve-transfers/${row.id}/reject`}
                      description="HQ reserve → Investment Reserve A/C"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
