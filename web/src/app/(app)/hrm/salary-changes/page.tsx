"use client";

import Link from "next/link";

import { BlockedApproveButton } from "@/components/finance/Approval";
import { statusTone } from "@/components/hrm/common";
import type { SalaryChange } from "@/components/hrm/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction, promptReason } from "@/components/ui/notify";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface Lists {
  pending: SalaryChange[];
  decided: SalaryChange[];
}

const columns: Column<SalaryChange>[] = [
  { key: "employee", header: "Staff name", render: (row) => <Link href={`/hrm/staff/${row.employee_id}`}>{row.employee}</Link> },
  { key: "current_salary", header: "Current salary", render: (row) => money(row.current_salary) },
  { key: "proposed_salary", header: "Proposed salary", render: (row) => money(row.proposed_salary) },
  { key: "proposed_values", header: "Structure", sortable: false, render: (row) => `${row.proposed_values.salary_type ?? ""}${row.proposed_values.commission_eligible === false ? " / no commission" : ""}` },
  { key: "reason", header: "Reason" },
  { key: "requested_by_name", header: "Proposed by" },
  { key: "approval_stage", header: "Approver", render: (row) => (row.approval_stage === "admin" ? "ADMIN (HR / own salary)" : "FINANCE") },
  { key: "created_at", header: "Date" },
];

/** Spec §32: salary changes proposed by HR wait for Finance (or Admin) approval. */
export default function SalaryChangesPage() {
  const { data, isLoading } = useApi<Lists>("hrm/salary-changes");
  const act = useAction<{ id: number; action: "approve" | "reject"; reason?: string }>("post", (body) => `hrm/salary-changes/${body.id}/${body.action}`);

  return (
    <>
      <PageHeader crumbs={["HRM", "Salary Changes"]} />
      <Card title="Salary changes waiting for approval">
        <DataTable
          rows={data?.pending}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            ...columns,
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  {!row.can_approve && row.approve_blocked_reason && <BlockedApproveButton reason={row.approve_blocked_reason} />}
                  {row.can_approve && (
                    <>
                      <button type="button" className="btn btn-sm btn-icon btn-success mr-1" title="Approve" disabled={act.isPending} onClick={async () => (await confirmAction("Approve this salary change?")) && act.mutate({ id: row.id, action: "approve" })}><i className="icon-like" /></button>
                      <button
                        type="button"
                        className="btn btn-sm btn-icon btn-danger"
                        title="Reject"
                        disabled={act.isPending}
                        onClick={async () => {
                          const reason = await promptReason("Reason for rejection");
                          if (reason !== null) {
                            act.mutate({ id: row.id, action: "reject", reason });
                          }
                        }}
                      >
                        <i className="icon-close" />
                      </button>
                    </>
                  )}
                </>
              ),
            },
          ]}
        />
      </Card>

      <Card title="Decided salary changes">
        <DataTable
          rows={data?.decided}
          rowKey={(row) => row.id}
          columns={[
            ...columns,
            { key: "status", header: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{row.status.toUpperCase()}</Badge> },
            { key: "decided", header: "Decided by", sortable: false, render: (row) => (row.approved_by_name ? `${row.approved_by_name} (${row.approved_at})` : `${row.rejected_by_name ?? ""} (${row.rejected_at ?? ""})${row.rejection_reason ? `: ${row.rejection_reason}` : ""}`) },
          ]}
        />
      </Card>
    </>
  );
}
