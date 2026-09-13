"use client";

import Link from "next/link";

import type { Staff } from "@/components/hrm/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction } from "@/components/ui/notify";
import { useAuth } from "@/lib/auth";
import { useAction, useApi } from "@/lib/hooks";

export default function RejectedStaffPage() {
  const { can } = useAuth();
  const { data: staff, isLoading } = useApi<Staff[]>("hrm/staff", { status: "rejected" });
  const remove = useAction<{ id: number }>("delete", (body) => `hrm/staff/${body.id}`);

  return (
    <>
      <PageHeader crumbs={["Rejected Employee"]} />
      <Card title="Rejected Employee">
        <DataTable
          rows={staff}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            {
              key: "photo",
              header: "Photo",
              sortable: false,
              // eslint-disable-next-line @next/next/no-img-element
              render: (row) => <img src={row.photo_url} className="img-thumbnail" alt="employee" style={{ width: 70, height: 70, objectFit: "cover" }} />,
            },
            { key: "full_name", header: "Name", className: "text-uppercase" },
            { key: "username", header: "Username" },
            { key: "phone", header: "Phone number" },
            { key: "branch", header: "Branch", className: "text-uppercase" },
            { key: "position", header: "Position", className: "text-uppercase", render: (row) => row.role?.name ?? row.position },
            { key: "status", header: "Status", render: () => <Badge tone="danger">Rejected</Badge> },
            { key: "created_at", header: "Date" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  <Link href={`/hrm/staff/${row.id}`} className="btn btn-primary btn-sm mr-1" title="View"><i className="icon-eye" /></Link>
                  {can("users.manage") && (
                    <button type="button" className="btn btn-danger btn-sm" title="Delete" onClick={async () => (await confirmAction()) && remove.mutate({ id: row.id })}><i className="icon-trash" /></button>
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
