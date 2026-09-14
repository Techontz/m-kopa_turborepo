"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { groupPermissions, privilegeChanges, privilegeSource, type PermissionItem, type PrivilegeSource } from "@/components/hrm/staffActions";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox, type Option } from "@/components/ui/SelectBox";
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

const SOURCE_BADGE: Record<Exclude<PrivilegeSource, "none">, [BadgeTone, string]> = {
  role: ["default", "Role"],
  granted: ["success", "Granted"],
  revoked: ["danger", "Revoked"],
};

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
        <small className="text-muted">Changing the role replaces the role permissions; the per-employee grants and revocations below are kept.</small>
      </form>
    </Card>
  );
}

function PrivilegesEditor({ data }: { data: StaffPrivileges }) {
  const [selected, setSelected] = useState<string[]>(data.permissions);
  const save = useAction<{ permissions: string[] }>("put", `hrm/staff/${data.employee.id}/privileges`);
  const groups = useMemo(() => groupPermissions(data.catalogue), [data.catalogue]);
  const pending = privilegeChanges(data.permissions, selected);
  const dirty = pending.granted.length + pending.revoked.length > 0;

  const toggle = (key: string) => setSelected((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));

  return (
    <Card
      title={<>Privileges <small className="text-muted">({data.permissions.length} of {data.catalogue.length} effective)</small></>}
      actions={data.can_edit && (
        <>
          {dirty && <button type="button" className="btn btn-default btn-sm mr-1" onClick={() => setSelected(data.permissions)}>Discard</button>}
          <button type="button" className="btn btn-primary btn-sm" disabled={save.isPending || !dirty} onClick={() => save.mutate({ permissions: selected })}>
            <i className="icon-drawer" /> Save{dirty ? ` (${pending.granted.length + pending.revoked.length})` : ""}
          </button>
        </>
      )}
    >
      {data.read_only_reason && <div className="alert alert-info">{data.read_only_reason}</div>}
      <p className="text-muted mb-3">
        Effective privileges = role permissions + <Badge tone="success">Granted</Badge> − <Badge tone="danger">Revoked</Badge>.
        {data.can_edit && " You can only grant or revoke privileges you hold yourself."}
      </p>
      <div className="row">
        {groups.map(([group, permissions]) => (
          <div key={group} className="col-md-6 col-lg-4 mb-3">
            <h6 className="text-uppercase mb-1">{group.replace("_", " ")}</h6>
            {permissions.map((permission) => {
              const held = data.actor_permissions.includes(permission.key);
              const source = privilegeSource(permission.key, data.role_permissions, data.granted, data.revoked);
              const changed = pending.granted.includes(permission.key) || pending.revoked.includes(permission.key);
              return (
                <div key={permission.key} className="d-flex align-items-start">
                  <label className="fancy-checkbox mb-0" title={held || !data.can_edit ? permission.key : `${permission.key} — you do not hold this privilege`}>
                    <input
                      type="checkbox"
                      disabled={!data.can_edit || !held || save.isPending}
                      checked={selected.includes(permission.key)}
                      onChange={() => toggle(permission.key)}
                    />{" "}
                    <span>{permission.label}</span>
                  </label>
                  <span className="ml-1 text-nowrap">
                    {source !== "none" && <Badge tone={SOURCE_BADGE[source][0]}>{SOURCE_BADGE[source][1]}</Badge>}
                    {changed && <> <Badge tone="warning">Unsaved</Badge></>}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {save.fieldError("permissions") && <div className="field-error">{save.fieldError("permissions")}</div>}
    </Card>
  );
}

/** HRM → All Active Staff → Privilege (live admin/privillage/:id): one employee's effective permissions. */
export default function StaffPrivilegesPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useApi<StaffPrivileges>(`hrm/staff/${id}/privileges`);
  const employee = data?.employee;

  const rows: [string, string][] = employee
    ? [
        ["Employee ID", employee.employee_number ?? "—"],
        ["Name", employee.full_name],
        ["Username", employee.username || "—"],
        ["Phone", employee.phone],
        ["Branch", employee.branch ?? "—"],
        ["Position", employee.position],
        ["Role", employee.role?.name ?? "—"],
      ]
    : [];

  return (
    <>
      <PageHeader crumbs={["All Employee", "Staff Privileges"]} right={<Link href="/hrm/staff" className="btn btn-primary btn-sm">Back</Link>} />

      {error && <div className="alert alert-danger">{error instanceof Error ? error.message : "Unable to load privileges"}</div>}
      {isLoading && <Card><p className="mb-0 text-muted">Loading…</p></Card>}

      {data && employee && (
        <>
          <Card title={<>Staff Privileges <Badge tone={employee.status === "active" ? "success" : "danger"}>{employee.status.toUpperCase()}</Badge></>}>
            <div className="table-responsive">
              <table className="table table-bordered mb-0">
                <tbody>
                  {rows.map(([label, value]) => (
                    <tr key={label}>
                      <th style={{ width: "30%" }}>{label}</th>
                      <td className={label === "Name" || label === "Branch" ? "text-uppercase" : undefined}>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {data.can_change_role && <RoleCard key={`role-${employee.role?.id ?? 0}`} data={data} />}
          <PrivilegesEditor key={data.permissions.join(",")} data={data} />
        </>
      )}
    </>
  );
}
