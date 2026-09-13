"use client";

import { useState } from "react";

import type { Staff } from "@/components/hrm/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { useApi } from "@/lib/hooks";

interface BranchStaff {
  id: number;
  name: string;
  phone: string | null;
  region: string | null;
  employees: Staff[];
}

export default function BranchStaffPage() {
  const { data: branches, isLoading } = useApi<BranchStaff[]>("hrm/branches");
  const [viewing, setViewing] = useState<BranchStaff | null>(null);

  return (
    <>
      <PageHeader crumbs={["Branch & Employee"]} />
      <Card title="Branch List">
        <DataTable
          rows={branches}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "name", header: "Branch Name" },
            { key: "phone", header: "Branch Phone Number" },
            { key: "region", header: "Branch region" },
            { key: "action", header: "Action", sortable: false, render: (row) => <button type="button" className="btn btn-sm btn-icon btn-primary" onClick={() => setViewing(row)}><i className="icon-eye" /></button> },
          ]}
        />
      </Card>

      <Modal open={viewing !== null} onClose={() => setViewing(null)} title={viewing?.name} size="xl">
        <DataTable
          rows={viewing?.employees}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            // eslint-disable-next-line @next/next/no-img-element
            { key: "photo", header: "Photo", sortable: false, render: (row) => <img src={row.photo_url} className="img-thumbnail" alt="" style={{ width: 50, height: 50, objectFit: "cover" }} /> },
            { key: "full_name", header: "Name", className: "text-uppercase" },
            { key: "username", header: "Username" },
            { key: "phone", header: "Phone number" },
            { key: "position", header: "Position", className: "text-uppercase", render: (row) => row.role?.name ?? row.position },
            { key: "gender", header: "Gender" },
            { key: "status", header: "Status", render: (row) => <Badge tone={row.status === "active" ? "success" : "danger"}>{row.status}</Badge> },
          ]}
        />
      </Modal>
    </>
  );
}
