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
  operation_principal_balance: number;
}

/** The two legs of the reserve chain, as the row's own type names them. */
const MOVEMENT: Record<string, string> = {
  reserve_to_investment: "HQ reserve → Investment Reserve A/C",
  reserve_to_principal: "Investment Reserve A/C → Operation Principal",
};

const movement = (row: BankTransfer) => MOVEMENT[row.type] ?? "Reserve transfer";

/**
 * Reserve approvals, both legs: Finance asks to send part of the HQ reserve to the Investment RESERVE A/C, and the owners ask
 * to send reserve already in the Investment on to the OPERATION PRINCIPAL. Only Super Admin, Admin or a shareholder may
 * approve or reject either; the money moves only on approval.
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
        <Tile label="HQ reserve (TZS)" value={money(data?.hq_reserve_balance)} className="col-md-3" />
        <Tile label="Investment Reserve A/C (TZS)" value={money(data?.investment_reserve_balance)} tone="success" className="col-md-3" />
        <Tile label="Operation Principal (TZS)" value={money(data?.operation_principal_balance)} className="col-md-3" />
        <Tile label="Awaiting your decision (TZS)" value={money(pending.reduce((total, row) => total + row.amount, 0))} tone="warning" className="col-md-3" />
      </div>
      <Card title="Reserve transfers awaiting the owners">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="thead-info">
              <tr><th>Date</th><th>Movement</th><th className="text-right">Amount</th><th>Reference</th><th>Requested by</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} className="text-center">Loading...</td></tr>}
              {!isLoading && rows.length === 0 && <tr><td colSpan={7} className="text-center text-muted">No reserve transfers yet</td></tr>}
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.transfer_date}</td>
                  <td>{movement(row)}</td>
                  <td className="text-right">{money(row.amount)}</td>
                  <td>{row.reference || "-"}</td>
                  <td>{row.employee ?? "—"}</td>
                  <td><ApprovalStatus row={row} /></td>
                  <td>
                    <ApprovalActions
                      row={row}
                      approvePath={`portal/shareholder/reserve-transfers/${row.id}/approve`}
                      rejectPath={`portal/shareholder/reserve-transfers/${row.id}/reject`}
                      description={movement(row)}
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
