"use client";

import Link from "next/link";

import { STATUS_LABEL, STATUS_TONE, type PortalCapital, type PortalContribution } from "@/components/shareholders/portal";
import { Tile } from "@/components/shareholders/Tile";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction } from "@/components/ui/notify";
import { backendUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

/** My Capital + Capital History: every contribution of the signed-in shareholder with its approval status. */
export default function ShareholderCapitalPage() {
  const { can } = useAuth();
  const { data, isLoading } = useApi<PortalCapital>(can("shareholder.capital.view") ? "portal/shareholder/capital" : null);
  const cancel = useAction<{ id: number }>("post", (body) => `portal/shareholder/capital/${body.id}/cancel`);

  return (
    <>
      <PageHeader crumbs={["Shareholder", "My Capital"]} right={can("shareholder.capital.submit") && <Link href="/shareholder/capital/add" className="btn btn-primary btn-sm"><i className="icon-plus" /> Add Capital</Link>} />

      <div className="row sh-tiles">
        <Tile label="Approved capital (TZS)" value={money(data?.total_contributed)} tone="success" className="col-md-6" />
        <Tile label="Pending approval (TZS)" value={money(data?.pending_amount)} tone="warning" note="Not counted until approved by the finance team" className="col-md-6" />
      </div>

      <Card title="Capital History">
        <DataTable<PortalContribution>
          rows={data?.rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "date", header: "Date", render: (row) => row.date?.slice(0, 16) ?? "" },
            { key: "payment_method", header: "Method", render: (row) => `${row.payment_method}${row.bank_account ? ` · ${row.bank_account}` : ""}` },
            { key: "reference", header: "Reference", render: (row) => row.reference ?? "-" },
            { key: "amount", header: "Amount (TZS)", className: "text-right", render: (row) => money(row.amount) },
            {
              key: "status",
              header: "Status",
              render: (row) => (
                <>
                  <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                  {row.rejection_reason && <div className="small text-muted">Reason: {row.rejection_reason}</div>}
                </>
              ),
            },
            { key: "source", header: "Recorded by", render: (row) => (row.source === "shareholder" ? "Me (portal)" : "Company staff") },
            { key: "journal_reference", header: "Journal", render: (row) => row.journal_reference ?? "-" },
            {
              key: "actions",
              header: "",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  {row.receipt_endpoint && (
                    <a href={backendUrl(row.receipt_endpoint)} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-icon btn-info mr-1" title="View receipt"><i className="icon-paper-clip" /></a>
                  )}
                  {row.can_cancel && can("shareholder.capital.submit") && (
                    <button type="button" className="btn btn-sm btn-danger" disabled={cancel.isPending} onClick={async () => (await confirmAction("Cancel this pending contribution?")) && cancel.mutate({ id: row.id })}>
                      Cancel
                    </button>
                  )}
                </>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
