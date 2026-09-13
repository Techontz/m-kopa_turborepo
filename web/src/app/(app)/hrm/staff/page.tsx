"use client";

import Link from "next/link";
import { useState } from "react";

import { HeaderButton, statusTone } from "@/components/hrm/common";
import { EMPTY_STAFF, StaffForm, type StaffFormValues } from "@/components/hrm/StaffForm";
import type { Staff } from "@/components/hrm/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction } from "@/components/ui/notify";
import { useAuth } from "@/lib/auth";
import { useAction, useApi } from "@/lib/hooks";

export default function AllStaffPage() {
  const { can } = useAuth();
  const { data: staff, isLoading } = useApi<Staff[]>("hrm/staff");
  const [registering, setRegistering] = useState(false);
  const [form, setForm] = useState<StaffFormValues>(EMPTY_STAFF);

  const create = useAction<StaffFormValues>("post", "hrm/staff");
  const blockAll = useAction<{ block: boolean }>("post", "hrm/staff/block-all");
  const act = useAction<{ id: number; action: string }>("post", (body) => `hrm/staff/${body.id}/${body.action}`);
  const remove = useAction<{ id: number }>("delete", (body) => `hrm/staff/${body.id}`);
  const manageUsers = can("users.manage");

  return (
    <>
      <PageHeader crumbs={["All Employee"]} />

      <Card
        title="Employee List"
        actions={
          <>
            {manageUsers && <HeaderButton tone="success" icon="icon-key" title="Un Block Account" onClick={async () => (await confirmAction()) && blockAll.mutate({ block: false })} />}
            {manageUsers && <HeaderButton tone="danger" icon="icon-lock" title="Block Account" onClick={async () => (await confirmAction()) && blockAll.mutate({ block: true })} />}
            <HeaderButton icon="icon-plus" title="Register Employee" onClick={() => setRegistering(true)} />
          </>
        }
      >
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
              render: (row) => (
                <div className="profile-image">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={row.photo_url} className="img-thumbnail" alt="employee" style={{ width: 70, height: 70, objectFit: "cover" }} />
                </div>
              ),
            },
            { key: "employee_number", header: "Empl/ID" },
            { key: "full_name", header: "Name", className: "text-nowrap text-uppercase" },
            { key: "username", header: "Username" },
            { key: "phone", header: "Phone number" },
            { key: "branch", header: "Branch", className: "text-uppercase" },
            { key: "role", header: "Position", className: "text-uppercase", value: (row) => row.role?.name ?? row.position, render: (row) => row.role?.name ?? row.position },
            { key: "status", header: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{row.status.toUpperCase()}</Badge> },
            { key: "created_at", header: "Date", className: "text-nowrap" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  <Link href={`/hrm/staff/${row.id}`} className="btn btn-primary btn-sm mr-1" title="View"><i className="icon-eye" /></Link>
                  {manageUsers && (
                    <>
                      {row.status === "blocked" ? (
                        <button type="button" className="btn btn-success btn-sm mr-1" title="Un Block" onClick={() => act.mutate({ id: row.id, action: "block" })}><i className="icon-key" /></button>
                      ) : (
                        <button type="button" className="btn btn-danger btn-sm mr-1" title="Block" onClick={() => act.mutate({ id: row.id, action: "block" })}><i className="icon-lock" /></button>
                      )}
                      <Link href={`/hrm/staff/${row.id}#role`} className="btn btn-info btn-sm mr-1" title="Privilege (Role)"><i className="icon-arrow-right" /></Link>
                      <button type="button" className="btn btn-danger btn-sm mr-1" title="Delete" onClick={async () => (await confirmAction("Are you sure?")) && remove.mutate({ id: row.id })}><i className="icon-trash" /></button>
                      <button type="button" className="btn btn-danger btn-sm mr-1" title="Reject" onClick={async () => (await confirmAction("Are you sure to reject?")) && act.mutate({ id: row.id, action: "reject" })}><i className="icon-close" /></button>
                      <button type="button" className="btn btn-warning btn-sm" title="Reset password" onClick={async () => (await confirmAction()) && act.mutate({ id: row.id, action: "reset-password" })}><i className="icon-key" /></button>
                    </>
                  )}
                </>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={registering}
        onClose={() => setRegistering(false)}
        title="Register Employee"
        size="lg"
        submitLabel="Register"
        submitting={create.isPending}
        onSubmit={() => create.mutate(form, { onSuccess: () => { setRegistering(false); setForm(EMPTY_STAFF); } })}
      >
        <StaffForm form={form} setForm={setForm} fieldError={create.fieldError} registering />
      </Modal>
    </>
  );
}
