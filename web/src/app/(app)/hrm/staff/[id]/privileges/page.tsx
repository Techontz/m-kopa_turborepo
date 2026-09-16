"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import {
  applyPrivilegeChange,
  assignedPrivilegeRows,
  PRIVILEGE_MESSAGES,
  privilegeItemSource,
  privilegeItemStatus,
  privilegeKeysNotHeld,
  privilegeRows,
  type PermissionItem,
  type PrivilegeGroup,
  type PrivilegeRow,
} from "@/components/hrm/staffActions";
import { Badge } from "@/components/ui/Badge";
import { Loading } from "@/components/ui/Loading";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { confirmAction, notifyError, notifySuccess } from "@/components/ui/notify";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox, type Option } from "@/components/ui/SelectBox";
import { api } from "@/lib/api";
import { useAction, useApi } from "@/lib/hooks";

interface StaffPrivileges {
  employee: {
    id: number;
    employee_number: string | null;
    full_name: string;
    username: string | null;
    phone: string;
    branch: string | null;
    position: string;
    status: string;
    role: { id: number; key: string; name: string; scope: string } | null;
    zone_id: number | null;
  };
  privilege_groups: PrivilegeGroup[];
  catalogue: PermissionItem[];
  role_permissions: string[];
  granted: string[];
  revoked: string[];
  permissions: string[];
  can_edit: boolean;
  read_only_reason: string | null;
  actor_permissions: string[];
  can_change_role: boolean;
}

function RoleCard({ data }: { data: StaffPrivileges }) {
  const { employee } = data;
  const [form, setForm] = useState({ role_id: employee.role ? String(employee.role.id) : "", zone_id: employee.zone_id ? String(employee.zone_id) : "" });
  const { data: roles = [] } = useApi<(Option & { scope: string })[]>("hrm/options/roles");
  const assign = useAction<typeof form>("put", `settings/employees/${employee.id}/role`);
  const scope = roles.find((role) => role.value === form.role_id)?.scope;

  return (
    <Card title="Change Role">
      <form onSubmit={(e) => { e.preventDefault(); assign.mutate(form); }}>
        <div className="row">
          <Field label="Role:" required className="col-md-5" error={assign.fieldError("role_id")}>
            <SelectBox placeholder="Select Role" options={roles} value={form.role_id} onChange={(value) => setForm({ ...form, role_id: value ?? "" })} />
          </Field>
          {scope === "zone" && (
            <Field label="Zone:" required className="col-md-4" error={assign.fieldError("zone_id")}>
              <SelectBox placeholder="Select Zone" optionsUrl="hrm/options/zones" value={form.zone_id} onChange={(value) => setForm({ ...form, zone_id: value ?? "" })} />
            </Field>
          )}
          <div className="col-md-3 d-flex align-items-end mb-2">
            <button type="submit" className="btn btn-primary" disabled={assign.isPending || !form.role_id || form.role_id === String(employee.role?.id ?? "")}>
              <i className="icon-drawer" /> Save Role
            </button>
          </div>
        </div>
        <small className="text-muted">The role gives the default privileges; privileges added or removed on this page are kept when the role changes.</small>
      </form>
    </Card>
  );
}

function StaffInfo({ employee }: { employee: StaffPrivileges["employee"] }) {
  const rows: [string, string][] = [
    ["Employee ID", employee.employee_number ?? "—"],
    ["Name", employee.full_name],
    ["Username", employee.username || "—"],
    ["Phone", employee.phone],
    ["Role", employee.role?.name ?? "—"],
    ["Branch", employee.branch ?? "—"],
    ["Position", employee.position],
  ];

  return (
    <Card>
      <div className="row">
        {rows.map(([label, value]) => (
          <div key={label} className="col-6 col-md-4 col-lg mb-2 mb-lg-0">
            <small className="text-muted d-block">{label}</small>
            <strong className={label === "Name" || label === "Branch" ? "text-uppercase" : undefined}>{value}</strong>
          </div>
        ))}
        <div className="col-6 col-md-4 col-lg-auto">
          <small className="text-muted d-block">Status</small>
          <Badge tone={employee.status === "active" ? "success" : "danger"}>{employee.status.toUpperCase()}</Badge>
        </div>
      </div>
    </Card>
  );
}

function PrivilegeTables({ data }: { data: StaffPrivileges }) {
  const client = useQueryClient();
  const [permissions, setPermissions] = useState<string[]>(data.permissions);
  const [pending, setPending] = useState<string | null>(null);

  const rows = useMemo(() => privilegeRows(data.privilege_groups), [data.privilege_groups]);
  const assigned = assignedPrivilegeRows(data.privilege_groups, permissions);

  const change = async (item: PrivilegeRow, add: boolean) => {
    if (!add && !(await confirmAction(PRIVILEGE_MESSAGES.confirmRemove))) return;
    setPending(item.key);
    const ok = await applyPrivilegeChange(permissions, item, add, {
      send: (next) => api.put<{ data: StaffPrivileges }>(`hrm/staff/${data.employee.id}/privileges`, { permissions: next }).then((response) => response.data.permissions),
      setPermissions,
      onSuccess: notifySuccess,
      onError: notifyError,
    });
    setPending(null);
    if (ok) await client.invalidateQueries();
  };

  const blockedTitle = (item: PrivilegeRow, add: boolean): string | undefined => {
    if (!data.can_edit) return data.read_only_reason ?? undefined;
    const notHeld = privilegeKeysNotHeld(permissions, item, add, data.actor_permissions);
    return notHeld.length ? `You do not hold: ${notHeld.join(", ")}` : undefined;
  };

  const label = (item: PrivilegeRow) => (
    <>
      <span className="text-uppercase">{item.label}</span>
      {item.group !== data.privilege_groups[0]?.key && <small className="d-block text-muted">{item.groupLabel}</small>}
    </>
  );

  const listColumns: Column<PrivilegeRow>[] = [
    { key: "label", header: "Privilege", value: (item) => `${item.label} ${item.groupLabel}`, render: label, sortable: false },
    {
      key: "action",
      header: "Action",
      sortable: false,
      className: "text-nowrap",
      render: (item) => {
        const { status } = privilegeItemStatus(item, permissions);
        const blocked = blockedTitle(item, true);
        return (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={status === "full" || !!blocked || pending !== null}
            title={status === "full" ? "Already added" : blocked ?? `Add ${item.label}`}
            onClick={() => change(item, true)}
          >
            <i className={pending === item.key ? "fa fa-spinner fa-spin" : "icon-pencil"} /> {status === "full" ? "Added" : "Add"}
          </button>
        );
      },
    },
  ];

  const assignedColumns: Column<PrivilegeRow>[] = [
    { key: "sno", header: "S/No.", sortable: false, render: (_item, index) => `${index + 1}.` },
    {
      key: "label",
      header: "Privilege",
      sortable: false,
      value: (item) => `${item.label} ${item.groupLabel}`,
      render: (item) => {
        const { status, held, total } = privilegeItemStatus(item, permissions);
        const source = privilegeItemSource(item, permissions, data.role_permissions, data.granted);
        return (
          <>
            {label(item)}
            <span className="mf-priv-badges">
              {source === "role" ? <Badge tone="default">Role</Badge> : source === "granted" ? <Badge tone="success">Added</Badge> : <Badge tone="info">Role + Added</Badge>}
              {status === "partial" && <Badge tone="warning">Partial {held}/{total}</Badge>}
            </span>
          </>
        );
      },
    },
    {
      key: "action",
      header: "Action",
      sortable: false,
      render: (item) => {
        const blocked = blockedTitle(item, false);
        return (
          <button type="button" className="btn btn-danger btn-sm" disabled={!!blocked || pending !== null} title={blocked ?? `Remove ${item.label}`} aria-label={`Remove ${item.label}`} onClick={() => change(item, false)}>
            <i className={pending === item.key ? "fa fa-spinner fa-spin" : "icon-trash"} />
          </button>
        );
      },
    },
  ];

  const firstName = data.employee.full_name.split(" ")[0];

  return (
    <>
      {data.read_only_reason && <div className="alert alert-info">{data.read_only_reason}</div>}
      <div className="row clearfix">
        <div className="col-lg-6">
          <Card title="Privilege List" actions={<Link href="/hrm/staff" className="btn btn-primary btn-sm"><i className="icon-logout" /> Back</Link>}>
            <DataTable columns={listColumns} rows={rows} rowKey={(item) => item.key} />
          </Card>
        </div>
        <div className="col-lg-6">
          <Card title={`Privileges For (${firstName})`}>
            <DataTable columns={assignedColumns} rows={assigned} rowKey={(item) => item.key} emptyMessage="No privileges assigned" />
          </Card>
        </div>
      </div>
    </>
  );
}

/** HRM → All Active Staff → Privilege (live admin/privillage/:id): add or remove one employee's privileges. */
export default function StaffPrivilegesPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useApi<StaffPrivileges>(`hrm/staff/${id}/privileges`);

  return (
    <>
      <PageHeader crumbs={["Employee Privilege"]} />

      {error && (
        <Card>
          <div className="alert alert-danger mb-2">{error instanceof Error ? error.message : "Unable to load privileges"}</div>
          <Link href="/hrm/staff" className="btn btn-primary btn-sm"><i className="icon-logout" /> Back</Link>
        </Card>
      )}
      {isLoading && <Card><Loading /></Card>}

      {data && (
        <>
          <StaffInfo employee={data.employee} />
          <PrivilegeTables key={data.permissions.join(",")} data={data} />
          {data.can_change_role && <RoleCard key={`role-${data.employee.role?.id ?? 0}`} data={data} />}
        </>
      )}
    </>
  );
}
