"use client";

import { useMemo, useState } from "react";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { useAuth } from "@/lib/auth";
import { useAction, useApi } from "@/lib/hooks";

interface Role {
  id: number;
  key: string;
  name: string;
  scope: "company" | "zone" | "branch";
  is_system: boolean;
  is_locked: boolean;
  permissions: string[];
  employees_count: number;
}

interface Permission {
  key: string;
  label: string;
  group: string;
}

const SCOPE_TONE: Record<Role["scope"], BadgeTone> = { company: "success", zone: "warning", branch: "info" };
const SCOPE_LABEL: Record<Role["scope"], string> = { company: "HQ (All branches)", zone: "Zone branches", branch: "Own branch" };

function PermissionEditor({ role, catalogue }: { role: Role; catalogue: Permission[] }) {
  const [selected, setSelected] = useState<string[]>(role.permissions);
  const save = useAction<{ permissions: string[] }>("put", `settings/roles/${role.id}/permissions`);

  const groups = useMemo(() => {
    const map = new Map<string, Permission[]>();
    catalogue.forEach((permission) => map.set(permission.group, [...(map.get(permission.group) ?? []), permission]));
    return [...map.entries()];
  }, [catalogue]);

  const toggle = (key: string) => setSelected((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));

  return (
    <Card
      title={<>Permissions / {role.name} <Badge tone={SCOPE_TONE[role.scope]}>{SCOPE_LABEL[role.scope]}</Badge></>}
      actions={!role.is_locked && <button type="button" className="btn btn-primary btn-sm" disabled={save.isPending} onClick={() => save.mutate({ permissions: selected })}><i className="icon-drawer" /> Save</button>}
    >
      {role.is_locked && <div className="alert alert-info">System Super Admin has full access and cannot be modified.</div>}
      <div className="row">
        {groups.map(([group, permissions]) => (
          <div key={group} className="col-md-6 col-lg-4 mb-3">
            <h6 className="text-uppercase mb-1">{group.replace("_", " ")}</h6>
            {permissions.map((permission) => (
              <div key={permission.key}>
                <label className="fancy-checkbox mb-0" title={permission.key}>
                  <input type="checkbox" disabled={role.is_locked} checked={selected.includes(permission.key)} onChange={() => toggle(permission.key)} /> <span>{permission.label}</span>
                </label>
              </div>
            ))}
          </div>
        ))}
      </div>
      {save.fieldError("permissions.0") && <div className="field-error">{save.fieldError("permissions.0")}</div>}
    </Card>
  );
}

function AssignRoleCard({ roles }: { roles: Role[] }) {
  const empty = { employee_id: "", role_id: "", zone_id: "" };
  const [form, setForm] = useState(empty);
  const assign = useAction<typeof empty>("put", (body) => `settings/employees/${body.employee_id}/role`);
  const role = roles.find((item) => String(item.id) === form.role_id);

  return (
    <Card title="Assign Staff Role">
      <form onSubmit={(e) => { e.preventDefault(); assign.mutate(form, { onSuccess: () => setForm(empty) }); }}>
        <div className="row">
          <Field label="Staff:" required className="col-md-4" error={assign.fieldError("employee_id")}>
            <SelectBox placeholder="Select Staff" optionsUrl="options/employees" value={form.employee_id} onChange={(value) => setForm({ ...form, employee_id: value ?? "" })} />
          </Field>
          <Field label="Role:" required className="col-md-4" error={assign.fieldError("role_id")}>
            <SelectBox placeholder="Select Role" options={roles.map((item) => ({ value: String(item.id), label: item.name }))} value={form.role_id} onChange={(value) => setForm({ ...form, role_id: value ?? "" })} />
          </Field>
          {role?.scope === "zone" && (
            <Field label="Zone:" required className="col-md-4" error={assign.fieldError("zone_id")}>
              <SelectBox placeholder="Select Zone" optionsUrl="settings/options/zones" value={form.zone_id} onChange={(value) => setForm({ ...form, zone_id: value ?? "" })} />
            </Field>
          )}
        </div>
        <div className="text-center m-t-20">
          <button type="submit" className="btn btn-primary" disabled={assign.isPending || !form.employee_id}><i className="icon-drawer" />Save</button>
        </div>
      </form>
    </Card>
  );
}

/** Documents: ACCOUNT OVERVIEW "ROLE CONTROL" — editable permission sets per role with data scope. */
export default function RolesPage() {
  const { can } = useAuth();
  const { data: roles, isLoading } = useApi<Role[]>("settings/roles");
  const { data: catalogue = [] } = useApi<Permission[]>("settings/permissions");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = roles?.find((role) => role.id === selectedId) ?? null;

  return (
    <>
      <PageHeader crumbs={["Setting", "Roles & Permissions"]} />
      <Card title="Role List">
        <DataTable
          rows={roles}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "name", header: "Role Name" },
            { key: "scope", header: "Data Scope", render: (row) => <Badge tone={SCOPE_TONE[row.scope]}>{SCOPE_LABEL[row.scope]}</Badge> },
            { key: "permissions", header: "Permissions", value: (row) => row.permissions.length },
            { key: "employees_count", header: "Staff" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              render: (row) => (
                <button type="button" className={`btn btn-sm btn-icon ${row.is_locked ? "btn-info" : "btn-primary"}`} onClick={() => setSelectedId(row.id)}>
                  <i className={row.is_locked ? "icon-eye" : "icon-pencil"} />
                </button>
              ),
            },
          ]}
        />
      </Card>
      {selected && <PermissionEditor key={`${selected.id}-${selected.permissions.join(",")}`} role={selected} catalogue={catalogue} />}
      {roles && (can("users.manage") || can("hrm.manage")) && <AssignRoleCard roles={roles} />}
    </>
  );
}
